// Puente seguro entre la interfaz (app/index.html) y el proceso principal.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desk', {
  state: () => ipcRenderer.invoke('desk:state'),
  pin: (on) => ipcRenderer.invoke('desk:pin', !!on),
  full: (on) => ipcRenderer.invoke('desk:full', !!on),
  hide: () => ipcRenderer.send('desk:hide'),
  onState: (cb) => ipcRenderer.on('desk:state', (_e, s) => cb(s)),
});
