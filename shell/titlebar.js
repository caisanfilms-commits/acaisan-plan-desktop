'use strict';
(function () {
  const $ = id => document.getElementById(id);
  const S = window.acShell;
  $('back').addEventListener('click', () => S.back());
  $('forward').addEventListener('click', () => S.forward());
  $('reload').addEventListener('click', () => S.reload());
  $('home').addEventListener('click', () => S.home());
  $('update').addEventListener('click', () => S.installUpdate());
  // duplo clique na barra maximiza/restaura (comportamento nativo da área arrastável)
  S.on('ac:nav', st => {
    $('back').disabled = !st.canBack;
    $('forward').disabled = !st.canForward;
    $('reload').classList.toggle('is-spinning', !!st.loading);
    $('dot').className = 'tb__dot' + (st.online ? (st.loading ? ' is-loading' : ' is-on') : ' is-off');
    if (!st.online) $('section').textContent = 'Sem conexão';
    $('update').hidden = !st.updateReady;
  });
  S.on('ac:section', label => { if (label) $('section').textContent = label; });
  S.info().then(i => { document.body.dataset.version = i.version; $('section').title = 'Versão ' + i.version; });
})();
