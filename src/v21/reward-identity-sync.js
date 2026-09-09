const $ = (selector, root = document) => root.querySelector(selector);

let applying = false;
let observer = null;

function applyIdentity() {
  if (applying) return;
  const identity = window.__waeRewardForge?.getIdentity?.();
  const card = $('.v2112-prestige-card--crown');
  if (!identity || !card) return;
  applying = true;
  const strong = $('strong', card);
  const small = $('small', card);
  if (strong && strong.textContent !== identity.title) strong.textContent = identity.title;
  if (small && small.textContent !== identity.frame) small.textContent = identity.frame;
  applying = false;
}

function ensureObserver() {
  const strip = $('.v2112-prestige-strip');
  if (!strip || observer) return;
  observer = new MutationObserver(() => queueMicrotask(applyIdentity));
  observer.observe(strip, { childList: true, subtree: true, characterData: true });
}

function sync() {
  ensureObserver();
  applyIdentity();
}

window.setInterval(sync, 650);
window.addEventListener('pageshow', sync);
document.addEventListener('wae:rewards-changed', sync);
document.addEventListener('wae:v21-identity-changed', sync);
sync();
