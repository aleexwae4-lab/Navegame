const state={installed:false,baseUpdate:null};

function game(){return window.__waeNeonRiderGame;}

function moveToEnd(parent,child){
  const index=parent?.children?.indexOf(child)??-1;
  if(index<0||index===parent.children.length-1) return;
  parent.children.splice(index,1);
  parent.children.push(child);
}

function moveToFront(parent,child){
  const index=parent?.children?.indexOf(child)??-1;
  if(index<=0) return;
  parent.children.splice(index,1);
  parent.children.unshift(child);
}

function normalizeDrone(drone){
  if(!drone?.children?.length) return;
  const skin=drone.children.find((child)=>child?.name==='WAE_V26_ENEMY_SKIN');
  if(!skin) return;

  for(const child of [...drone.children]){
    if(child===skin) continue;
    if(child.visible===false) drone.remove(child);
  }

  const eliteRing=drone.children.find((child)=>{
    if(child===skin||child.geometry?.type!=='TorusGeometry') return false;
    const radius=Number(child.geometry?.parameters?.radius);
    return Number.isFinite(radius)&&Math.abs(radius-1.62)<0.08;
  });
  if(eliteRing) moveToEnd(drone,eliteRing);
}

function normalizeBoss(boss){
  if(!boss?.children?.length) return;
  const skin=boss.children.find((child)=>child?.name==='WAE_V26_GUARDIAN_SKIN');
  if(!skin) return;
  for(const child of [...boss.children]){
    if(child===skin) continue;
    if(child.visible===false) boss.remove(child);
  }
  moveToFront(boss,skin);
}

function normalizeShared(){
  const g=game();
  const root=g?.scene?.getObjectByName?.('WAE_V17_SHARED_BATTLEFIELD');
  if(!root) return;
  for(const entity of root.children){
    if(entity.name?.startsWith('V17_drone_')) normalizeDrone(entity);
    else if(entity.name?.startsWith('V17_boss_')) normalizeBoss(entity);
  }
}

function normalizeAll(){
  const g=game();
  if(!g) return;
  for(const drone of g.drones||[]) normalizeDrone(drone);
  if(g.boss) normalizeBoss(g.boss);
  normalizeShared();
}

export function installV26CompatibilityNormalizer(){
  const g=game();
  if(!g||state.installed||g.__waeV26CompatNormalizer) return false;
  state.installed=true;
  g.__waeV26CompatNormalizer=true;
  state.baseUpdate=typeof g.updatePlaying==='function'?g.updatePlaying.bind(g):null;
  if(state.baseUpdate){
    g.updatePlaying=(delta,elapsed)=>{
      state.baseUpdate(delta,elapsed);
      normalizeAll();
    };
  }
  normalizeAll();
  return true;
}
