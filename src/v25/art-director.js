import * as THREE from 'three';
import { createSignatureShipModel, animateSignatureShip, disposeSignatureShip } from './ship-art.js';

const RAID_KEY='wae_neon_rider_v19_raid_profile';
const hangar={renderer:null,scene:null,camera:null,root:null,model:null,relics:null,raf:0,last:performance.now(),drag:false,dragX:0,rotationY:.34,targetY:.34,resize:null,canvas:null,panel:null};
let gameInstalled=false;
let legacyBase=[];

function game(){return window.__waeNeonRiderGame;}
function safeJson(key,fallback={}){try{const value=JSON.parse(localStorage.getItem(key)||'null');return value&&typeof value==='object'?value:fallback;}catch{return fallback;}}

function currentShipConfig(){
  const g=game();
  const ship=g?.getShip?.()||{id:'falcon',name:'FALCON MK-I',accent:0x22d3ee};
  const weapon=g?.getWeapon?.()||{id:'pulse',name:'PULSE TWIN'};
  return {...ship,weapon};
}

function hideLegacyShip(){
  const g=game();
  if(!g?.ship) return;
  if(!legacyBase.length){
    legacyBase=[...g.ship.children].filter((child)=>child!==g.loadoutVisualGroup&&!child.userData?.v25Signature&&!String(child.name||'').startsWith('WAE_V24'));
  }
  for(const child of legacyBase) child.visible=false;
  if(g.loadoutVisualGroup) g.loadoutVisualGroup.visible=false;
}

function remasterGameplayShip(){
  const g=game();
  if(!g?.ship) return;
  hideLegacyShip();
  if(g.__waeV25ArtGroup) disposeSignatureShip(g.__waeV25ArtGroup);
  const config=currentShipConfig();
  const model=createSignatureShipModel(config,{mode:'game',weapon:config.weapon});
  model.name='WAE_V25_GAMEPLAY_SHIP';
  g.ship.add(model);
  g.__waeV25ArtGroup=model;
}

export function installArtDirector(){
  const g=game();
  if(!g||gameInstalled||g.__waeV25ArtDirector) return false;
  gameInstalled=true;
  g.__waeV25ArtDirector=true;
  const baseApply=typeof g.applyLoadoutVisual==='function'?g.applyLoadoutVisual.bind(g):null;
  const baseUpdate=typeof g.updatePlaying==='function'?g.updatePlaying.bind(g):null;
  if(baseApply){
    g.applyLoadoutVisual=()=>{
      baseApply();
      hideLegacyShip();
      remasterGameplayShip();
    };
  }
  if(baseUpdate){
    g.updatePlaying=(delta,elapsed)=>{
      baseUpdate(delta,elapsed);
      if(g.__waeV25ArtGroup) animateSignatureShip(g.__waeV25ArtGroup,delta,elapsed,g.input);
    };
  }
  remasterGameplayShip();
  window.__waeV25RemasterShip=remasterGameplayShip;
  window.dispatchEvent(new CustomEvent('wae:v25-art-ready'));
  return true;
}

function buildRelics(root){
  const profile=safeJson(RAID_KEY,{});
  const inventory=profile.inventory&&typeof profile.inventory==='object'?profile.inventory:{};
  const defs=[['helix',0x22d3ee],['forge',0xf97316],['seer',0xd946ef],['bastion',0x34d399]];
  const owned=defs.filter(([id])=>Number(inventory[id]?.count)>0);
  const group=new THREE.Group();
  owned.forEach(([id,color],index)=>{
    const material=new THREE.MeshStandardMaterial({color:0x07111f,emissive:color,emissiveIntensity:.9,metalness:.72,roughness:.18});
    const geometry=id==='seer'?new THREE.TorusKnotGeometry(.22,.06,44,8):id==='forge'?new THREE.IcosahedronGeometry(.3,1):id==='bastion'?new THREE.DodecahedronGeometry(.3,0):new THREE.OctahedronGeometry(.3,1);
    const relic=new THREE.Mesh(geometry,material);
    const angle=(index/Math.max(1,owned.length))*Math.PI*2;
    relic.position.set(Math.cos(angle)*3.4,.7+Math.sin(angle*2)*.25,Math.sin(angle)*2.1);
    relic.userData.v25RelicAngle=angle;
    group.add(relic);
  });
  root.add(group);
  return group;
}

function rebuildHangarModel(){
  if(!hangar.root) return;
  if(hangar.model) disposeSignatureShip(hangar.model);
  if(hangar.relics){
    hangar.relics.traverse((node)=>{node.geometry?.dispose?.();node.material?.dispose?.();});
    hangar.root.remove(hangar.relics);
  }
  const config=currentShipConfig();
  hangar.model=createSignatureShipModel(config,{mode:'hangar',weapon:config.weapon});
  hangar.model.scale.multiplyScalar(.82);
  hangar.model.position.y=.15;
  hangar.root.add(hangar.model);
  hangar.relics=buildRelics(hangar.root);
}

function resizeHangar(){
  if(!hangar.canvas||!hangar.renderer||!hangar.camera) return;
  const rect=hangar.canvas.getBoundingClientRect();
  if(!rect.width||!rect.height) return;
  hangar.renderer.setSize(rect.width,rect.height,false);
  hangar.camera.aspect=rect.width/rect.height;
  hangar.camera.updateProjectionMatrix();
}

function animateHangar(now=performance.now()){
  hangar.raf=0;
  if(!hangar.panel||hangar.panel.classList.contains('hidden')||!hangar.renderer) return;
  const dt=Math.min(.05,Math.max(.001,(now-hangar.last)/1000));
  hangar.last=now;
  if(!hangar.drag) hangar.targetY+=dt*.14;
  hangar.rotationY+=(hangar.targetY-hangar.rotationY)*Math.min(1,dt*7);
  if(hangar.model){
    hangar.model.rotation.y=hangar.rotationY;
    animateSignatureShip(hangar.model,dt,now/1000,null);
  }
  if(hangar.relics){
    hangar.relics.rotation.y-=dt*.14;
    hangar.relics.children.forEach((node,index)=>{node.rotation.x+=dt*(.34+index*.05);node.rotation.y+=dt*(.48+index*.04);});
  }
  hangar.renderer.render(hangar.scene,hangar.camera);
  hangar.raf=requestAnimationFrame(animateHangar);
}

function startHangarLoop(){
  if(hangar.raf) cancelAnimationFrame(hangar.raf);
  hangar.last=performance.now();
  hangar.raf=requestAnimationFrame(animateHangar);
}

export function mountHangarStage(){
  const panel=document.querySelector('#v21-identity-hangar');
  const stage=panel?.querySelector('.v21-visual-stage');
  if(!panel||!stage) return false;
  hangar.panel=panel;
  if(!hangar.renderer){
    const canvas=document.createElement('canvas');
    canvas.className='v25-signature-canvas';
    canvas.setAttribute('aria-label','V25 Signature Ship 3D');
    stage.append(canvas);
    const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:window.devicePixelRatio<=1.5,powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.55));
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.16;
    const scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(34,1,.1,100);
    camera.position.set(0,2.45,11.8);
    camera.lookAt(0,.15,0);
    const root=new THREE.Group(); scene.add(root);
    scene.add(new THREE.HemisphereLight(0xcffafe,0x020617,2.4));
    const key=new THREE.PointLight(0x67e8f9,34,20,2);key.position.set(4.5,5.5,6);scene.add(key);
    const rim=new THREE.PointLight(0xc084fc,28,18,2);rim.position.set(-5,2,-4);scene.add(rim);
    const warm=new THREE.PointLight(0xfde68a,12,14,2);warm.position.set(0,-2,4);scene.add(warm);
    const floor=new THREE.Mesh(new THREE.CylinderGeometry(3.45,3.7,.18,72),new THREE.MeshStandardMaterial({color:0x020617,emissive:0x0e7490,emissiveIntensity:.18,metalness:.9,roughness:.25}));
    floor.position.y=-1.7;root.add(floor);
    for(const radius of [2.9,3.35]){
      const ring=new THREE.Mesh(new THREE.TorusGeometry(radius,.026,8,72),new THREE.MeshBasicMaterial({color:radius<3?0x67e8f9:0xc084fc,transparent:true,opacity:.34}));
      ring.rotation.x=Math.PI/2;ring.position.y=-1.58;root.add(ring);
    }
    hangar.renderer=renderer;hangar.scene=scene;hangar.camera=camera;hangar.root=root;hangar.canvas=canvas;
    canvas.addEventListener('pointerdown',(event)=>{hangar.drag=true;hangar.dragX=event.clientX;canvas.setPointerCapture?.(event.pointerId);});
    canvas.addEventListener('pointermove',(event)=>{if(!hangar.drag)return;const dx=event.clientX-hangar.dragX;hangar.dragX=event.clientX;hangar.targetY+=dx*.012;});
    const stop=()=>{hangar.drag=false;};canvas.addEventListener('pointerup',stop);canvas.addEventListener('pointercancel',stop);
    hangar.resize=new ResizeObserver(resizeHangar);hangar.resize.observe(canvas);
  }
  document.body.classList.add('v25-hangar-remastered');
  rebuildHangarModel();
  resizeHangar();
  startHangarLoop();
  return true;
}

export function stopHangarStage(){
  if(hangar.raf) cancelAnimationFrame(hangar.raf);
  hangar.raf=0;
}

window.addEventListener('wae:v21-identity-changed',()=>{if(hangar.panel&&!hangar.panel.classList.contains('hidden')) rebuildHangarModel();});
window.addEventListener('beforeunload',()=>{stopHangarStage();hangar.renderer?.dispose?.();});
