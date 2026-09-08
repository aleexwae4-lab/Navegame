const $=(selector,root=document)=>root.querySelector(selector);
let artPromise=null;

function applyBranding(){
  document.title='WAE Neon Rider 3D · V26 Enemy Remaster';
  const seal=$('.wae-game-seal small');
  const brand=$('.brand-seal span');
  const start=$('#start-screen .eyebrow');
  if(seal) seal.textContent='ORIGINAL GAME SEAL · V26';
  if(brand) brand.textContent='NEON RIDER · ENEMY REMASTER V26';
  if(start) start.textContent='WAE V26 / ENEMY ART · GUARDIAN REMASTER · DAMAGE STATES';
  document.body.classList.add('v26-art-direction');
}

function installArtMark(){
  const status=$('.v24-system-status');
  if(!status||status.querySelector('[data-v26-art-mark]')) return;
  const mark=document.createElement('span');
  mark.dataset.v26ArtMark='true';
  mark.textContent='ENEMY REMASTER · V26';
  status.append(mark);
}

async function loadEnemyArt(){
  if(artPromise) return artPromise;
  artPromise=import('./enemy-art.js').then((module)=>{
    module.installEnemyArtDirector?.();
    return module;
  }).catch((error)=>{
    artPromise=null;
    console.error('[WAE V26] Enemy Art Director failed to load',error);
    return null;
  });
  return artPromise;
}

applyBranding();
installArtMark();
window.addEventListener('pageshow',()=>{applyBranding();installArtMark();});
window.addEventListener('wae:v26-enemy-art-ready',installArtMark);

document.addEventListener('click',(event)=>{
  if(event.target.closest('#start-btn,#restart-btn,[data-v16-launch-squad]')) loadEnemyArt();
},true);

for(const eventName of ['pointerenter','focusin','touchstart']){
  document.addEventListener(eventName,(event)=>{
    if(event.target.closest?.('#start-btn,#restart-btn,[data-v16-launch-squad]')) loadEnemyArt();
  },{capture:true,passive:eventName==='touchstart'});
}

const connection=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
if(!connection?.saveData&&!/2g/i.test(connection?.effectiveType||'')){
  const warm=()=>loadEnemyArt();
  if('requestIdleCallback'in window) window.requestIdleCallback(warm,{timeout:3800});
  else window.setTimeout(warm,3000);
}
