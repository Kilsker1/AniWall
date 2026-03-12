const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('aniwall', {
  minimize:      ()      => ipcRenderer.send('win-minimize'),
  maximize:      ()      => ipcRenderer.send('win-maximize'),
  close:         ()      => ipcRenderer.send('win-close'),
  download:      (url)   => ipcRenderer.invoke('download-image', url),
  downloadTemp:  (url)   => ipcRenderer.invoke('download-temp-image', url), // <-- NEW
  revealFile:    (p)     => ipcRenderer.invoke('reveal-file', p),
  getSettings:   ()      => ipcRenderer.invoke('get-settings'),
  setSettings:   (data)  => ipcRenderer.invoke('set-settings', data),
  getMonitors:   ()      => ipcRenderer.invoke('get-monitors'),
  setWallpaper:  (opts)  => ipcRenderer.invoke('set-wallpaper', opts),
  saveImageData: (data)  => ipcRenderer.invoke('save-image-data', data),
  getFavorites:  ()      => ipcRenderer.invoke('get-favorites'),
  saveFavorites: (data)  => ipcRenderer.invoke('save-favorites', data),
});