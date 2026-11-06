// Exposes a small, safe API to the page. The web version doesn't have this,
// so the page checks for window.pmc before using it.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('pmc', {
  isDesktop: true,
  // Opens the print preview window. `name` is the suggested PDF file name.
  printPreview: (name) => ipcRenderer.invoke('print-preview', String(name || 'check')),
  // Saves the check as a PDF without opening the preview.
  savePdf: (name) => ipcRenderer.invoke('save-pdf', String(name || 'check')),
  // Check register stored in an .xlsx file
  register: {
    choose: (mode) => ipcRenderer.invoke('register-choose', mode),
    read: (file) => ipcRenderer.invoke('register-read', file),
    create: (file, entries) => ipcRenderer.invoke('register-create', file, entries),
    append: (file, entry) => ipcRenderer.invoke('register-append', file, entry),
    update: (file, id, patch) => ipcRenderer.invoke('register-update', file, id, patch),
    remove: (file, id) => ipcRenderer.invoke('register-remove', file, id),
    show: (file) => ipcRenderer.invoke('register-show', file),
    open: (file) => ipcRenderer.invoke('register-open', file)
  }
})
