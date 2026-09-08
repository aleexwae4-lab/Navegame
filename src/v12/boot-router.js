const DEFAULT_STACK = '15';
const STACK_PARAM = 'stack';
const VALID_STACKS = new Set(['15','16','17','18','19','20','21','22','23','24','25','26','27','28']);

const loaders = {
  '15': () => import('../v15/boot.js'),
  '16': () => import('../v16/boot.js'),
  '17': () => import('../v17/boot.js'),
  '18': () => import('../v18/boot.js'),
  '19': () => import('../v19/boot.js'),
  '20': () => import('../v20/boot.js'),
  '21': () => import('../v21/boot.js'),
  '22': () => import('../v22/boot.js'),
  '23': () => import('../v23/boot.js'),
  '24': () => import('../v24/boot.js'),
  '25': () => import('../v25/boot.js'),
  '26': () => import('../v26/boot.js'),
  '27': () => import('../v27/boot.js'),
  '28': () => import('../v28/boot.js'),
};

function selectedStack() {
  const value = new URLSearchParams(location.search).get(STACK_PARAM) || DEFAULT_STACK;
  return VALID_STACKS.has(value) ? value : DEFAULT_STACK;
}

function recoveryUrl() {
  const url = new URL(location.href);
  url.searchParams.set(STACK_PARAM, DEFAULT_STACK);
  url.searchParams.set('recover', String(Date.now()));
  return url.toString();
}

function installFailureScreen(stack, error) {
  document.documentElement.dataset.waeBootState = 'failed';
  document.documentElement.dataset.waeBootStack = stack;
  console.error(`[WAE BOOT] Canary V${stack} failed`, error);

  let panel = document.querySelector('#wae-boot-diagnostic');
  if (!panel) {
    panel = document.createElement('section');
    panel.id = 'wae-boot-diagnostic';
    panel.setAttribute('role', 'alert');
    panel.style.cssText = [
      'position:fixed','inset:0','z-index:99999','display:grid','place-items:center',
      'padding:24px','background:rgba(1,5,16,.96)','color:#eef7ff','font-family:system-ui,sans-serif'
    ].join(';');
    document.body.append(panel);
  }

  const message = String(error?.message || error || 'Unknown boot failure').slice(0, 220);
  panel.innerHTML = `
    <div style="width:min(560px,100%);padding:24px;border:1px solid rgba(70,220,255,.35);border-radius:24px;background:linear-gradient(180deg,rgba(10,24,48,.96),rgba(3,8,20,.98));box-shadow:0 24px 80px rgba(0,0,0,.55)">
      <small style="display:block;letter-spacing:.18em;color:#63e8ff;font-weight:800">WAE BOOT DIAGNOSTIC</small>
      <h1 style="margin:10px 0 6px;font-size:clamp(28px,8vw,48px)">CANARY V${stack} FALLÓ</h1>
      <p style="opacity:.82;line-height:1.5">El núcleo V15 permanece intacto. Este fallo quedó aislado antes de convertirse en producción estable.</p>
      <code style="display:block;margin:16px 0;padding:12px;border-radius:12px;background:#020712;color:#ffcf7a;white-space:pre-wrap;word-break:break-word">${message.replace(/[&<>]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</code>
      <button id="wae-return-stable" type="button" style="width:100%;min-height:54px;border:0;border-radius:18px;font-weight:900;letter-spacing:.08em;background:linear-gradient(90deg,#56e7ff,#2eafff);color:#03111f">VOLVER A CORE V15</button>
    </div>`;
  panel.querySelector('#wae-return-stable')?.addEventListener('click', () => location.replace(recoveryUrl()), { once: true });
}

function markSuccess(stack) {
  document.documentElement.dataset.waeBootState = 'ready';
  document.documentElement.dataset.waeBootStack = stack;
  sessionStorage.setItem('wae_last_good_stack', stack);
  window.__waeBootStack = stack;
}

export async function bootSelectedStack() {
  const stack = selectedStack();
  document.documentElement.dataset.waeBootState = 'loading';
  document.documentElement.dataset.waeBootStack = stack;

  try {
    await loaders[stack]();
    markSuccess(stack);
  } catch (error) {
    installFailureScreen(stack, error);
  }
}

bootSelectedStack();
