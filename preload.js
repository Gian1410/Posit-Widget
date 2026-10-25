const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('positWindow', {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  close: () => ipcRenderer.invoke('window:close'),
  createNewPosit: () => ipcRenderer.invoke('window:create-new-posit'),
  setAlwaysOnTop: (value) => ipcRenderer.invoke('window:set-always-on-top', value),
  getAlwaysOnTop: () => ipcRenderer.invoke('window:get-always-on-top'),
  getBounds: () => ipcRenderer.invoke('window:get-bounds'),
  setBounds: (bounds) => ipcRenderer.invoke('window:set-bounds', bounds),
  saveNoteToFile: (note) => ipcRenderer.invoke('note:save-to-file', note),
  openNoteFromFile: () => ipcRenderer.invoke('note:open-from-file')
});
