// API for the print preview window's buttons.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('preview', {
  print: () => ipcRenderer.invoke('preview-print'),
  savePdf: () => ipcRenderer.invoke('preview-save-pdf'),
  close: () => ipcRenderer.invoke('preview-close')
})
