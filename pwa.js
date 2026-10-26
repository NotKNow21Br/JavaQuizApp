/* Installazione PWA: nessuna dipendenza, nessuna modifica ai quiz o agli invii. */
(() => {
  'use strict';
  const DISMISS_KEY = 'java-passo-passo-install-dismissed';
  const scriptURL = document.currentScript?.src || new URL('./pwa.js', document.baseURI).href;
  let installPrompt = null;
  let banner = null;
  let helpDialog = null;
  let installed = false;
  const displayMode = window.matchMedia('(display-mode: standalone)');
  const isStandalone = () => installed || displayMode.matches || navigator.standalone === true;
  const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const dismissed = () => { try { return sessionStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; } };

  function removeBanner() {
    if (banner) { banner.remove(); banner = null; }
  }
  function showBanner() {
    if (isStandalone() || dismissed()) { removeBanner(); return; }
    if (banner || !document.querySelector('#main')) return;
    banner = document.createElement('section');
    banner.className = 'install-banner';
    banner.setAttribute('aria-label', 'Installa Java sul telefono');
    banner.innerHTML = '<div class="install-banner-copy"><strong>Java, a portata di tocco.</strong><p>Aggiungi lezioni e quiz alla schermata Home del telefono.</p></div><button type="button" class="install-button" data-pwa-install>Installa l’app</button><button type="button" class="install-dismiss" data-pwa-dismiss aria-label="Chiudi invito">×</button>';
    document.querySelector('#main').before(banner);
    banner.querySelector('[data-pwa-install]').addEventListener('click', requestInstall);
    banner.querySelector('[data-pwa-dismiss]').addEventListener('click', () => {
      try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* Il pulsante funziona anche senza storage. */ }
      removeBanner();
    });
  }

  function showInstructions() {
    if (isStandalone()) { removeBanner(); return; }
    if (helpDialog) helpDialog.remove();
    helpDialog = document.createElement('dialog');
    helpDialog.className = 'pwa-install-dialog';
    helpDialog.setAttribute('aria-labelledby', 'pwa-install-title');
    const ios = isIOS();
    const android = /Android/.test(navigator.userAgent);
    const instructions = ios ? [
      'Apri questo sito in Safari sul tuo iPhone o iPad.',
      'Tocca Condividi: il quadrato con la freccia verso l’alto.',
      'Scorri le azioni e scegli “Aggiungi alla schermata Home”. Se presente, lascia attivo “Apri come app web”.',
      'Tocca “Aggiungi”. Ritroverai l’icona Java nella schermata Home.'
    ] : android ? [
      'Apri il menu del browser, solitamente i tre puntini in alto a destra.',
      'Scegli “Installa app” oppure “Aggiungi a schermata Home”. Il nome può variare in base al browser.',
      'Conferma l’aggiunta e apri Java dalla nuova icona. Se l’opzione non compare, prova Chrome o Edge aggiornato.'
    ] : [
      'Apri il menu del browser e cerca “Installa app” o “Aggiungi alla schermata Home”.',
      'In Chrome o Edge puoi trovare anche un’icona di installazione nella barra degli indirizzi.',
      'Conferma nella finestra del browser. Se l’opzione non è disponibile, puoi continuare a usare tutti i quiz da questo sito.'
    ];
    helpDialog.innerHTML = '<div class="pwa-dialog-header"><h2 id="pwa-install-title">Aggiungi Java alla schermata Home</h2><button type="button" class="pwa-dialog-close" aria-label="Chiudi istruzioni">×</button></div><p class="pwa-dialog-intro">Segui questi passaggi nel browser. Questa finestra mostra le istruzioni: l’installazione si completa dal menu del dispositivo.</p><ol class="pwa-install-steps">' + instructions.map(text => '<li>' + text + '</li>').join('') + '</ol><p class="pwa-dialog-note">I progressi restano in questo browser. Per inviare gli errori e i risultati al tutor serve una connessione Internet.</p><button type="button" class="pwa-dialog-done">Ho capito</button>';
    document.body.append(helpDialog);
    const close = () => { if (typeof helpDialog?.close === 'function' && helpDialog.open) helpDialog.close(); else helpDialog?.remove(); };
    helpDialog.querySelector('.pwa-dialog-close').addEventListener('click', close);
    helpDialog.querySelector('.pwa-dialog-done').addEventListener('click', close);
    helpDialog.addEventListener('click', event => { if (event.target === helpDialog) { const r = helpDialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) close(); } });
    if (typeof helpDialog.showModal === 'function') helpDialog.showModal();
    else { helpDialog.setAttribute('open', ''); helpDialog.setAttribute('role', 'dialog'); helpDialog.setAttribute('aria-modal', 'true'); helpDialog.querySelector('.pwa-dialog-close').focus(); }
  }

  async function requestInstall() {
    if (isStandalone()) { removeBanner(); return; }
    if (!installPrompt) { showInstructions(); return; }
    const event = installPrompt;
    installPrompt = null;
    const button = banner?.querySelector('[data-pwa-install]');
    if (button) button.disabled = true;
    try {
      // prompt() resta nel gesto dell’utente: niente timer o richieste automatiche.
      await event.prompt();
      const choice = await event.userChoice;
      if (choice?.outcome === 'accepted' && banner) {
        banner.querySelector('.install-banner-copy p').textContent = 'Completa l’installazione seguendo le indicazioni del browser.';
      }
    } catch {
      showInstructions();
    } finally {
      if (button) button.disabled = false;
    }
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    showBanner();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    installPrompt = null;
    removeBanner();
    if (helpDialog?.open && typeof helpDialog.close === 'function') helpDialog.close();
  });
  const displayChanged = () => { if (isStandalone()) removeBanner(); else showBanner(); };
  if (typeof displayMode.addEventListener === 'function') displayMode.addEventListener('change', displayChanged);
  else if (typeof displayMode.addListener === 'function') displayMode.addListener(displayChanged);

  function registerWorker() {
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
    if (!('serviceWorker' in navigator) || !window.isSecureContext || (location.protocol !== 'https:' && !loopback)) return;
    navigator.serviceWorker.register(new URL('./sw.js', scriptURL).href, {scope:new URL('./', scriptURL).pathname}).catch(() => {
      // Installazione/offline non disponibili: lezioni, quiz e resoconti continuano online.
    });
  }
  function init() { showBanner(); registerWorker(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
