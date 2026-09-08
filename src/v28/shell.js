const $=(selector,root=document)=>root.querySelector(selector);
let warPromise=null;

function applyBranding(){
  document.title='WAE Neon Rider 3D · V28 Faction Warfare';
  const seal=$('.wae-game-seal small');
  const brand=$('.brand-seal span');
  const start=$('#start-screen .eyebrow');
  if(seal)seal.textContent='ORIGINAL GAME SEAL · V28';
  if(brand)brand.textContent='NEON RIDER · FACTION WARFARE V28';
  if(start)start.textContent='WAE V28 / FACTION WARFARE · MISSION DIRECTOR · WAR ROOM';
  document.body.classList.add('v28-faction-warfare');
}

function installLauncher(){
  const screen=$('#start-screen');
  if(!screen||screen.querySelector('[data-v28-war-room]'))return;
  const anchor=screen.querySelector('.v24-system-status')||screen.querySelector('.start-actions')||screen.lastElementChild;
  const button=document.createElement('button');
  button.type='button';
  button.className='v28-war-launcher';
  button.dataset.v28WarRoom='true';
  button.innerHTML='<span>◈</span><div><small>STRATEGIC COMMAND</small><strong>FACTION WAR ROOM</strong></div><em>V28</em>';
  anchor?.insertAdjacentElement('afterend',button);
}

async function loadWarDirector(){
  if(warPromise)return warPromise;
  warPromise=import('./war-director.js').then((module)=>{
    module.installWarDirector?.();
    return module;
  }).catch((error)=>{
    warPromise=null;
    console.error('[WAE V28] War Director failed to load',error);
    return null;
  });
  return warPromise;
}

async function openWarRoom(){
  const module=await loadWarDirector();
  module?.openWarRoom?.();
}

applyBranding();
installLauncher();
window.addEventListener('pageshow',()=>{applyBranding();installLauncher();});

const observer=new MutationObserver(()=>installLauncher());
observer.observe(document.body,{childList:true,subtree:true});

document.addEventListener('click',(event)=>{
  if(event.target.closest('[data-v28-war-room]'))openWarRoom();
  if(event.target.closest('#start-btn,#restart-btn,[data-v16-launch-squad]'))loadWarDirector();
},true);

for(const eventName of ['pointerenter','focusin','touchstart']){
  document.addEventListener(eventName,(event)=>{
    if(event.target.closest?.('[data-v28-war-room],#start-btn,#restart-btn'))loadWarDirector();
  },{capture:true,passive:eventName==='touchstart'});
}

const connection=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
if(!connection?.saveData&&!/2g/i.test(connection?.effectiveType||'')){
  const warm=()=>loadWarDirector();
  if('requestIdleCallback'in window)window.requestIdleCallback(warm,{timeout:4200});
  else window.setTimeout(warm,3200);
}
