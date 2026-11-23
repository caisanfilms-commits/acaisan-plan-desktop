'use strict';
document.getElementById('retry').addEventListener('click', () => window.acShell.reload());
window.addEventListener('online', () => window.acShell.reload());
// tenta de novo a cada 20 s enquanto estiver sem conexão
setInterval(() => { if (navigator.onLine) window.acShell.reload(); }, 20000);
