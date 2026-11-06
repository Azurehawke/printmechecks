// Update checks against GitHub Releases on Azurehawke/printmechecks.
//
// On startup the app asks GitHub whether a newer release exists. If so, it
// offers to download it. After a download the app closes and stays closed
// until you start it again.
//
//   Installed copy: the update installs silently as the app closes.
//   Portable copy:  the new portable .exe is saved next to the current one.
//
// No network or update errors are ever shown at startup: if you're offline
// the app just opens normally.
const { app, dialog, shell, net } = require('electron')
const fs = require('fs')
const path = require('path')

const OWNER = 'Azurehawke'
const REPO = 'printmechecks'
const RELEASES_URL = `https://github.com/${OWNER}/${REPO}/releases`

function log (...args) {
  console.log('[updater]', ...args)
}

// Compare dotted versions like 1.2.10 vs 1.2.9. Ignores a leading "v".
function isNewer (latest, current) {
  const a = String(latest).replace(/^v/, '').split(/[.-]/).map(n => parseInt(n, 10) || 0)
  const b = String(current).replace(/^v/, '').split(/[.-]/).map(n => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] || 0) > (b[i] || 0)) return true
    if ((a[i] || 0) < (b[i] || 0)) return false
  }
  return false
}

async function askToDownload (win, version, notes) {
  const { response } = await dialog.showMessageBox(win, {
    type: 'info',
    title: 'Update available',
    message: `Print Me Checks ${version} is available.`,
    detail:
      `You have version ${app.getVersion()}.` +
      (notes ? `\n\nWhat's new:\n${notes}` : '') +
      '\n\nDownload it now? The app will close when the download finishes. ' +
      'Start it again to use the new version.',
    buttons: ['Download', 'Not now', 'View on GitHub'],
    defaultId: 0,
    cancelId: 1,
    noLink: true
  })
  if (response === 2) shell.openExternal(`${RELEASES_URL}/tag/v${version}`)
  return response === 0
}

function plainNotes (notes) {
  if (!notes) return ''
  const text = Array.isArray(notes) ? notes.map(n => n.note).join('\n') : String(notes)
  return text.replace(/<[^>]+>/g, '').trim().slice(0, 600)
}

function setProgress (win, fraction) {
  if (win && !win.isDestroyed()) {
    win.setProgressBar(fraction)
    win.setTitle(fraction >= 0 ? `Print Me Checks: downloading update ${Math.round(fraction * 100)}%` : 'Print Me Checks')
  }
}

// ---------- Installed (NSIS) copy: electron-updater ----------

function checkInstalled (win) {
  const { autoUpdater } = require('electron-updater')
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.logger = { info: log, warn: log, error: log, debug: () => {} }

  autoUpdater.on('update-available', async (info) => {
    const yes = await askToDownload(win, info.version, plainNotes(info.releaseNotes))
    if (!yes) return
    setProgress(win, 0)
    autoUpdater.downloadUpdate().catch(err => failed(win, err))
  })

  autoUpdater.on('download-progress', (p) => setProgress(win, p.percent / 100))

  autoUpdater.on('update-downloaded', async (info) => {
    setProgress(win, -1)
    await dialog.showMessageBox(win, {
      type: 'info',
      title: 'Update downloaded',
      message: `Version ${info.version} has been downloaded.`,
      detail: 'Print Me Checks will now close and install the update. Start it again when you are ready.',
      buttons: ['OK'],
      noLink: true
    })
    // isSilent = true: no installer windows. isForceRunAfter = false: the
    // app stays closed until you start it again.
    autoUpdater.quitAndInstall(true, false)
  })

  autoUpdater.checkForUpdates().catch(err => log('check failed:', err.message))
}

// ---------- Portable copy: download the new portable exe ----------

async function fetchJson (url) {
  const res = await net.fetch(url, { headers: { Accept: 'application/vnd.github+json' } })
  if (!res.ok) throw new Error(`GitHub returned ${res.status}`)
  return res.json()
}

async function checkPortable (win, portableExePath) {
  let release
  try {
    release = await fetchJson(`https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`)
  } catch (err) {
    log('check failed:', err.message)
    return
  }
  const version = String(release.tag_name || '').replace(/^v/, '')
  if (!version || !isNewer(version, app.getVersion())) return

  const asset = (release.assets || []).find(a => /portable.*\.exe$/i.test(a.name))
  if (!asset) {
    log('release has no portable exe')
    return
  }

  const yes = await askToDownload(win, version, plainNotes(release.body))
  if (!yes) return

  const dir = path.dirname(portableExePath)
  const dest = path.join(dir, asset.name)
  const partial = dest + '.download'
  try {
    setProgress(win, 0)
    const res = await net.fetch(asset.browser_download_url)
    if (!res.ok) throw new Error(`download failed (${res.status})`)
    const total = Number(res.headers.get('content-length')) || asset.size || 0
    const out = fs.createWriteStream(partial)
    let got = 0
    const reader = res.body.getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      got += value.length
      if (!out.write(Buffer.from(value))) await new Promise(r => out.once('drain', r))
      if (total) setProgress(win, got / total)
    }
    await new Promise((resolve, reject) => out.end(err => (err ? reject(err) : resolve())))
    if (asset.size && fs.statSync(partial).size !== asset.size) throw new Error('download was incomplete')
    fs.renameSync(partial, dest)
  } catch (err) {
    try { fs.unlinkSync(partial) } catch {}
    return failed(win, err)
  }
  setProgress(win, -1)

  await dialog.showMessageBox(win, {
    type: 'info',
    title: 'Update downloaded',
    message: `Version ${version} has been downloaded.`,
    detail:
      `Saved as:\n${dest}\n\nPrint Me Checks will now close. Start the new file to use the new version. ` +
      'You can delete the old one afterwards. Your saved checks carry over.',
    buttons: ['OK'],
    noLink: true
  })
  shell.showItemInFolder(dest)
  app.quit()
}

async function failed (win, err) {
  setProgress(win, -1)
  log('update failed:', err && err.message)
  const { response } = await dialog.showMessageBox(win, {
    type: 'warning',
    title: 'Update failed',
    message: 'The update could not be downloaded.',
    detail: `${err && err.message ? err.message : err}\n\nYou can keep using this version, or download the update from GitHub.`,
    buttons: ['OK', 'Open GitHub'],
    noLink: true
  })
  if (response === 1) shell.openExternal(RELEASES_URL)
}

function checkForUpdates (win) {
  // Nothing to update while developing (npm run app).
  if (!app.isPackaged || process.env.PMC_DISABLE_UPDATES) return
  const portable = process.env.PORTABLE_EXECUTABLE_FILE
  if (portable) checkPortable(win, portable)
  else checkInstalled(win)
}

module.exports = { checkForUpdates, isNewer }
