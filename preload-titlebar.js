/* Barra de título, tela de abertura e "Sem conexão" (páginas locais do app). Só estas ações, nada de Node. */
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('acShell', {
  back: () => ipcRenderer.send('ac:back'),
  forward: () => ipcRenderer.send('ac:forward'),
  reload: () => ipcRenderer.send('ac:reload'),
  home: () => ipcRenderer.send('ac:home'),
  installUpdate: () => ipcRenderer.send('ac:update'),
  info: () => ipcRenderer.invoke('ac:info'),
  on: (channel, cb) => {
    if (!['ac:nav', 'ac:title', 'ac:section'].includes(channel)) return;
    ipcRenderer.on(channel, (_e, data) => cb(data));
  }
});
