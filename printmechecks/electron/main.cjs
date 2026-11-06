// Electron entry point: runs Print Me Checks as a local desktop app.
// Everything (fonts, Bootstrap, MICR font) is bundled, so the app works
// fully offline and your account numbers never leave the machine.
const { app, BrowserWindow, Menu, shell, ipcMain, dialog, session } = require('electron')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { pathToFileURL } = require('url')
const { checkForUpdates } = require('./updater.cjs')

let mainWin = null

function createWindow () {
  const win = new BrowserWindow({
    width: 1400,
    height: 1000,
    minWidth: 900,
    title: 'Print Me Checks',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs')
    }
  })
  mainWin = win
  win.on('closed', () => { mainWin = null })

  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))

  // Check GitHub for a newer version once the window is showing.
  win.webContents.once('did-finish-load', () => checkForUpdates(win))

  // Open any external links in the default browser, never inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) {
      event.preventDefault()
      if (/^https?:/.test(url)) shell.openExternal(url)
    }
  })
}

// ---------- Print preview ----------
// Electron can't show Chrome's print preview, and the Windows print dialog
// has none. So we render the check to a PDF with the same print styles the
// printer will use, and show that PDF in a preview window.

// Letter, no margins: the check's print CSS (@page margin 0 + fixed scale)
// lays the check out for exactly this.
const PRINT_OPTIONS = { pageSize: 'Letter', margins: { marginType: 'none' } }

let preview = null // { win, pdfPath, pdf, name }

function closePreview () {
  if (!preview) return
  const { win, pdfPath } = preview
  preview = null
  if (!win.isDestroyed()) win.destroy()
  fs.rm(pdfPath, { force: true }, () => {})
}

function renderPdf (contents) {
  return contents.printToPDF({ ...PRINT_OPTIONS, printBackground: false, preferCSSPageSize: true })
}

async function askAndSavePdf (parent, pdf, name) {
  const { canceled, filePath } = await dialog.showSaveDialog(parent, {
    title: 'Save check as PDF',
    defaultPath: path.join(app.getPath('documents'), `${name}.pdf`),
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  })
  if (canceled || !filePath) return false
  fs.writeFileSync(filePath, pdf)
  return true
}

// Save as PDF straight from the main window (no preview).
ipcMain.handle('save-pdf', async (event, name) => {
  const owner = BrowserWindow.fromWebContents(event.sender)
  const pdf = await renderPdf(event.sender)
  return askAndSavePdf(owner, pdf, safeName(name))
})

ipcMain.handle('print-preview', async (event, name) => {
  const owner = BrowserWindow.fromWebContents(event.sender)
  closePreview()
  const pdf = await renderPdf(event.sender)
  const pdfPath = path.join(os.tmpdir(), `printmechecks-preview-${Date.now()}.pdf`)
  fs.writeFileSync(pdfPath, pdf)

  const win = new BrowserWindow({
    parent: owner,
    modal: true,
    width: 900,
    height: 1000,
    minWidth: 600,
    minHeight: 500,
    title: 'Print Preview',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      plugins: true, // Chromium's built-in PDF viewer
      preload: path.join(__dirname, 'preview-preload.cjs')
    }
  })
  win.setMenu(null)
  preview = { win, pdfPath, pdf, name: safeName(name) }
  win.on('closed', () => { if (preview && preview.win === win) closePreview() })
  win.once('ready-to-show', () => win.show())
  await win.loadFile(path.join(__dirname, 'preview.html'), {
    query: { pdf: pathToFileURL(pdfPath).href }
  })
})

function safeName (name) {
  return String(name).replace(/[<>:"/\\|?*\x00-\x1f]/g, '').trim() || 'check'
}

ipcMain.handle('preview-print', async () => {
  if (!preview || !mainWin) return
  const target = mainWin.webContents
  // Opens the Windows print dialog for the check page itself. Printing the
  // page (not the PDF) keeps text and the MICR font sharp.
  const ok = await new Promise(resolve => {
    target.print({ ...PRINT_OPTIONS, silent: false, printBackground: false }, (success, reason) => {
      if (!success && reason !== 'cancelled') console.error('print failed:', reason)
      resolve(success)
    })
  })
  if (ok) closePreview()
})

ipcMain.handle('preview-save-pdf', async () => {
  if (!preview) return
  const { win, pdf, name } = preview
  if (await askAndSavePdf(win, pdf, name)) closePreview()
})

ipcMain.handle('preview-close', () => closePreview())

// ---------- Register .xlsx file ----------
// Results come back as { ok, data } or { ok: false, error } so the page can
// show a readable message.
const register = require('./register.cjs')

function wrap (fn) {
  return async (event, ...args) => {
    try {
      return { ok: true, data: await fn(event, ...args) }
    } catch (err) {
      const missing = err && (err.code === 'ENOENT' || /File not found/.test(err.message))
      return { ok: false, missing, error: missing ? 'The register file wasn\'t found. It may have been moved, renamed, or not synced yet.' : String(err && err.message || err) }
    }
  }
}

ipcMain.handle('register-read', wrap((e, file) => register.read(file)))
ipcMain.handle('register-create', wrap((e, file, entries) => register.create(file, entries)))
ipcMain.handle('register-append', wrap((e, file, entry) => register.append(file, entry)))
ipcMain.handle('register-update', wrap((e, file, id, patch) => register.update(file, id, patch)))
ipcMain.handle('register-remove', wrap((e, file, id) => register.remove(file, id)))
ipcMain.handle('register-choose', wrap(async (event, mode) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  const filters = [{ name: 'Excel workbook', extensions: ['xlsx'] }]
  if (mode === 'new') {
    const r = await dialog.showSaveDialog(win, {
      title: 'Create check register',
      defaultPath: path.join(app.getPath('documents'), 'Check Register.xlsx'),
      filters
    })
    return r.canceled ? null : r.filePath
  }
  const r = await dialog.showOpenDialog(win, { title: 'Open check register', properties: ['openFile'], filters })
  return r.canceled ? null : r.filePaths[0]
}))
ipcMain.handle('register-show', (e, file) => { if (typeof file === 'string') shell.showItemInFolder(file) })
ipcMain.handle('register-open', async (e, file) => (typeof file === 'string' && /\.xlsx$/i.test(file) ? shell.openPath(file) : 'not an .xlsx file'))

// Minimal menu: keeps standard shortcuts (copy/paste, reload)
// without a cluttered menu bar. Ctrl+P is handled by the page itself.
const menu = Menu.buildFromTemplate([
  { role: 'fileMenu' },
  { role: 'editMenu' },
  {
    label: 'View',
    submenu: [
      // Ctrl +/-/0 zoom the check itself (handled by the page)
      { role: 'reload' },
      { type: 'separator' },
      { role: 'togglefullscreen' },
      { role: 'toggleDevTools' }
    ]
  },
  {
    label: 'Help',
    submenu: [
      {
        label: 'Releases on GitHub',
        click: () => shell.openExternal('https://github.com/Azurehawke/printmechecks/releases')
      },
      { type: 'separator' },
      { label: `Version ${app.getVersion()}`, enabled: false }
    ]
  }
])
Menu.setApplicationMenu(menu)

app.whenReady().then(() => {
  // Let the Text tab list the fonts installed on this computer.
  session.defaultSession.setPermissionRequestHandler((wc, permission, callback) => {
    callback(['local-fonts', 'clipboard-sanitized-write', 'fullscreen'].includes(permission))
  })
  session.defaultSession.setPermissionCheckHandler((wc, permission) =>
    ['local-fonts', 'clipboard-sanitized-write', 'fullscreen'].includes(permission))
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
