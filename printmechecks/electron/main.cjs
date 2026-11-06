// Electron entry point: runs Print Me Checks as a local desktop app.
// Everything (fonts, Bootstrap, MICR font) is bundled, so the app works
// fully offline and your account numbers never leave the machine.
const { app, BrowserWindow, Menu, shell, ipcMain, dialog } = require('electron')
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

ipcMain.handle('print-preview', async (event, name) => {
  const owner = BrowserWindow.fromWebContents(event.sender)
  closePreview()
  const pdf = await event.sender.printToPDF({
    ...PRINT_OPTIONS,
    printBackground: false,
    preferCSSPageSize: true
  })
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
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Save check as PDF',
    defaultPath: path.join(app.getPath('documents'), `${name}.pdf`),
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  })
  if (canceled || !filePath) return
  fs.writeFileSync(filePath, pdf)
  closePreview()
})

ipcMain.handle('preview-close', () => closePreview())

// Minimal menu: keeps standard shortcuts (copy/paste, zoom, reload)
// without a cluttered menu bar. Ctrl+P is handled by the page itself.
const menu = Menu.buildFromTemplate([
  { role: 'fileMenu' },
  { role: 'editMenu' },
  {
    label: 'View',
    submenu: [
      { role: 'reload' },
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
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
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
