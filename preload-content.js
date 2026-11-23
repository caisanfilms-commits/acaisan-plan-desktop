/* Roda isolado ao lado da ACAISAN PLAN (contextIsolation). Não expõe nada perigoso ao site:
   só avisa a barra de título qual tela está aberta e informa ao site que ele está no app de computador. */
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('acaisanDesktop', { app: 'ACAISAN PLAN', platform: process.platform });

const NAMES = {
  dashboard: 'Painel', requests: 'Solicitações', quotes: 'Orçamentos', projects: 'Projetos', clients: 'Clientes',
  finance: 'Financeiro', calendar: 'Agenda', creativeStudio: 'Studio Neural', creativeStudioPreview: 'Studio Neural', settings: 'Configurações'
};
let last = null;
function report() {
  let label = '';
  if (location.pathname.startsWith('/present')) label = 'ACAISAN PRESENT';
  else {
    const page = document.querySelector('.page.active[id]');
    const gate = document.getElementById('acGlobalGate');
    // a tela de login é position: fixed (offsetParent fica null), por isso conferimos o display e a área ocupada
    const gateOn = gate && getComputedStyle(gate).display !== 'none' && getComputedStyle(gate).visibility !== 'hidden' && gate.getClientRects().length > 0;
    if (gateOn) label = 'Entrar';
    else if (page) label = NAMES[page.id] || '';
  }
  if (label !== last) { last = label; ipcRenderer.send('ac:section', label); }
}
let pending = 0;
const soon = () => { if (!pending) pending = setTimeout(() => { pending = 0; report(); }, 200); };
window.addEventListener('DOMContentLoaded', () => {
  report();
  new MutationObserver(soon).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
});
