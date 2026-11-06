// Exposes a small, safe API to the page. The web version doesn't have this,
// so the page checks for window.pmc before using it.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('pmc', {
  isDesktop: true,
  // Opens the print preview window. `name` is the suggested PDF file name.
  printPreview: (name) => ipcRenderer.invoke('print-preview', String(name || 'check'))
})
