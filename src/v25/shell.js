const $=(selector,root=document)=>root.querySelector(selector);
let directorPromise=null;
let directorReady=false;

function applyBranding(){
  document.title='WAE Neon Rider 3D · V25 Signature Fleet';
  const seal=$('.wae-game-seal small');
  const brand=$('.brand-seal span');
  const start=$('#start-screen .eyebrow');
  if(seal) seal.textContent='ORIGINAL GAME SEAL · V25';
  if(brand) brand.textContent='NEON RIDER · SIGNATURE FLEET V25';
  if(start) start.textContent='WAE V25 / ART DIRECTION · SHIP REMASTER · SIGNATURE FLEET';
  document.body.classList.add('v25-art-direction');
}

function installArtMark(){
  const status=$('.v24-system-status');
  if(status&&!status.querySelector('[data-v25-art-mark]')){
    const mark=document.createElement('span');
    mark.dataset.v25ArtMark='true';
    mark.textContent='SIGNATURE FLEET · V25';
    status.append(mark);
  }
}

async function loadDirector(){
  if(directorPromise) return directorPromise;
  directorPromise=import('./art-director.js').then((module)=>{
    directorReady=true;
    module.installArtDirector?.();
    document.body.classList.add('v25-art-ready');
    return module;
  }).catch((error)=>{
    directorPromise=null;
    directorReady=false;
    console.error('[WAE V25] Art Director failed to load',error);
    return null;
  });
  return directorPromise;
}

async function mountHangar(){
  const module=await loadDirector();
  if(!module) return;
  let attempts=0;
  const tryMount=()=>{
    attempts+=1;
    const panel=$('#v21-identity-hangar');
    if(panel&&!panel.classList.contains('hidden')){
      module.mountHangarStage?.();
      return;
    }
    if(attempts<12) window.setTimeout(tryMount,50);
  };
  tryMount();
}

function watchHangar(){
  const observer=new MutationObserver(()=>{
    const panel=$('#v21-identity-hangar');
    if(!panel||!directorReady) return;
    directorPromise?.then((module)=>{
      if(panel.classList.contains('hidden')) module?.stopHangarStage?.();
      else module?.mountHangarStage?.();
    });
  });
  observer.observe(document.body,{subtree:true,attributes:true,attributeFilter:['class'],childList:true});
}

applyBranding();
installArtMark();
watchHangar();

window.addEventListener('pageshow',()=>{applyBranding();installArtMark();});
window.addEventListener('wae:v25-art-ready',installArtMark);

document.addEventListener('click',(event)=>{
  if(event.target.closest('[data-v21-hangar]')) mountHangar();
  if(event.target.closest('#start-btn,#restart-btn,[data-v16-launch-squad]')) loadDirector();
},true);

for(const eventName of ['pointerenter','focusin','touchstart']){
  document.addEventListener(eventName,(event)=>{
    if(event.target.closest?.('[data-v21-hangar],#start-btn,#restart-btn')) loadDirector();
  },{capture:true,passive:eventName==='touchstart'});
}

const connection=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
if(!connection?.saveData&&!/2g/i.test(connection?.effectiveType||'')){
  const warm=()=>loadDirector();
  if('requestIdleCallback'in window) window.requestIdleCallback(warm,{timeout:3600});
  else window.setTimeout(warm,2800);
}
