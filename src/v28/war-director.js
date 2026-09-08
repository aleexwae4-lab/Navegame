const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const PROFILE_KEY='wae_neon_rider_v28_war_profile';
const STANCE_KEY='wae_neon_rider_v28_stance';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

const FACTIONS=Object.freeze({
  'cyan-void':Object.freeze({id:'helix-dominion',name:'DOMINIO HELIX',short:'HELIX',emblem:'◈',color:'#67e8f9',accent:'#22d3ee',doctrine:'VELOCIDAD VECTORIAL'}),
  'solar-storm':Object.freeze({id:'solar-foundry',name:'FORJA SOLAR',short:'FORJA',emblem:'☼',color:'#fdba74',accent:'#f97316',doctrine:'ARTILLERÍA TÉRMICA'}),
  'violet-rift':Object.freeze({id:'rift-covenant',name:'PACTO DE LA FALLA',short:'RIFT',emblem:'◇',color:'#e879f9',accent:'#d946ef',doctrine:'CAZADORES DE FASE'}),
  'emerald-front':Object.freeze({id:'verdant-legion',name:'LEGIÓN VERDANT',short:'VERDANT',emblem:'⬢',color:'#6ee7b7',accent:'#34d399',doctrine:'GUERRA DE DESGASTE'}),
});

const RANKS=Object.freeze([
  Object.freeze({min:0,name:'UNKNOWN'}),
  Object.freeze({min:8,name:'TRACKED'}),
  Object.freeze({min:20,name:'THREAT'}),
  Object.freeze({min:45,name:'NEMESIS'}),
  Object.freeze({min:80,name:'LEGEND'}),
]);

const STANCES=Object.freeze({
  stable:Object.freeze({id:'stable',name:'HOLD',reward:1,detail:'CONTROL DE LÍNEA'}),
  bounty:Object.freeze({id:'bounty',name:'HUNT',reward:1.15,detail:'CAZA PRIORITARIA'}),
  volatile:Object.freeze({id:'volatile',name:'ASSAULT',reward:1.3,detail:'OFENSIVA TOTAL'}),
});

const OPS=Object.freeze({
  'helix-dominion':Object.freeze([
    Object.freeze({id:'vector-intercept',name:'VECTOR INTERCEPT',brief:'Rompe la línea Helix antes de que cierre el corredor.',metric:'kills',base:7,reward:5}),
    Object.freeze({id:'break-the-spear',name:'BREAK THE SPEAR',brief:'Elimina unidades prioritarias de la punta de ataque.',metric:'priority',base:1,reward:7}),
    Object.freeze({id:'ghost-line',name:'GHOST LINE',brief:'Mantén la nave operativa bajo presión vectorial.',metric:'survive',base:18,reward:6}),
  ]),
  'solar-foundry':Object.freeze([
    Object.freeze({id:'foundry-silence',name:'SILENCE THE FOUNDRY',brief:'Destruye la artillería antes de la siguiente descarga térmica.',metric:'kills',base:8,reward:5}),
    Object.freeze({id:'sunbreaker',name:'SUNBREAKER',brief:'Caza un objetivo Elite o Mini-boss de la Forja.',metric:'priority',base:1,reward:8}),
    Object.freeze({id:'thermal-denial',name:'THERMAL DENIAL',brief:'Genera superioridad ofensiva antes del Guardián.',metric:'score',base:1400,reward:6}),
  ]),
  'rift-covenant':Object.freeze([
    Object.freeze({id:'oracle-hunt',name:'HUNT THE ORACLE',brief:'Localiza y elimina firmas prioritarias del Pacto.',metric:'priority',base:1,reward:8}),
    Object.freeze({id:'close-the-rift',name:'CLOSE THE RIFT',brief:'Acumula presión de combate para estabilizar el sector.',metric:'score',base:1500,reward:6}),
    Object.freeze({id:'phase-purge',name:'PHASE PURGE',brief:'Completa el objetivo táctico del sector.',metric:'objective',base:1,reward:7}),
  ]),
  'verdant-legion':Object.freeze([
    Object.freeze({id:'break-the-wall',name:'BREAK THE WALL',brief:'Desmantela la primera línea de la Legión Verdant.',metric:'kills',base:9,reward:6}),
    Object.freeze({id:'citadel-crack',name:'CITADEL CRACK',brief:'Derriba una unidad prioritaria de fortaleza.',metric:'priority',base:1,reward:8}),
    Object.freeze({id:'greenline-hold',name:'GREENLINE HOLD',brief:'Sostén el escudo mientras atraviesas la línea defensiva.',metric:'shield',base:16,reward:7}),
  ]),
});

const state={installed:false,current:null,lastSector:0,lastScore:0,lastObjectiveComplete:false,base:{},hud:null};

function game(){return window.__waeNeonRiderGame;}
function factionFor(g=game()){return FACTIONS[String(g?.currentBiome?.id||'cyan-void')]||FACTIONS['cyan-void'];}
function hash(text){let h=2166136261;for(let i=0;i<text.length;i+=1){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function safeJson(key,fallback={}){try{const parsed=JSON.parse(localStorage.getItem(key)||'null');return parsed&&typeof parsed==='object'?parsed:fallback;}catch{return fallback;}}
function baseMap(value=0){const result={};for(const faction of Object.values(FACTIONS))result[faction.id]=Math.max(0,Number(value?.[faction.id])||Number(value)||0);return result;}
function loadProfile(){const p=safeJson(PROFILE_KEY,{});return{standing:baseMap(p.standing),control:baseMap(p.control),operations:Math.max(0,Math.floor(Number(p.operations)||0)),victories:Math.max(0,Math.floor(Number(p.victories)||0)),warMarks:Math.max(0,Math.floor(Number(p.warMarks)||0)),bestControl:Math.max(0,Number(p.bestControl)||0),history:Array.isArray(p.history)?p.history.slice(0,16):[],lastMission:p.lastMission&&typeof p.lastMission==='object'?p.lastMission:null};}
function saveProfile(p){try{localStorage.setItem(PROFILE_KEY,JSON.stringify(p));}catch{}}
function rankFor(value){let rank=RANKS[0];for(const candidate of RANKS)if(value>=candidate.min)rank=candidate;return rank;}
function stance(){const id=String(localStorage.getItem(STANCE_KEY)||'stable');return STANCES[id]||STANCES.stable;}
function setStance(id){const next=STANCES[id]||STANCES.stable;try{localStorage.setItem(STANCE_KEY,next.id);}catch{}return next;}
function warPhase(profile){const total=Object.values(profile.control).reduce((a,b)=>a+b,0);if(total>=260)return'ASCENDANCY';if(total>=150)return'DOMINION';if(total>=70)return'ESCALATION';return'FRONTIER';}

function targetFor(op,g,profile){const sector=Math.max(1,Number(g?.sector)||1);const rep=profile.standing[factionFor(g).id]||0;const veteran=Math.min(3,Math.floor(rep/30));if(op.metric==='kills')return op.base+Math.min(5,Math.floor(sector/3))+veteran;if(op.metric==='priority')return op.base+(sector>=8?1:0);if(op.metric==='score')return op.base+Math.min(1200,(sector-1)*120);if(op.metric==='survive'||op.metric==='shield')return op.base+Math.min(10,Math.floor(sector/4)*2);return op.base;}
function chooseOperation(g,force=false){if(!g)return null;if(!force&&state.current?.sector===g.sector)return state.current;const faction=factionFor(g);const profile=loadProfile();const pool=OPS[faction.id]||OPS['helix-dominion'];const route=stance();let index=hash(`${faction.id}|${g.sector}|${profile.operations}|${route.id}`)%pool.length;if(route.id==='bounty'){const p=pool.findIndex((item)=>item.metric==='priority');if(p>=0)index=p;}const def=pool[index];const target=targetFor(def,g,profile);state.current={...def,sector:g.sector,factionId:faction.id,factionName:faction.name,factionShort:faction.short,emblem:faction.emblem,color:faction.color,progress:0,target,complete:false,reward:Math.max(1,Math.round(def.reward*route.reward)),route:route.id,startedAt:Date.now(),baselineScore:Number(g.score)||0,baselineMissiles:Number(g.profile?.missilesFired)||0};state.lastObjectiveComplete=Boolean(g.sideObjective?.complete);renderAll();return state.current;}

function operationProgress(g,delta){const op=state.current;if(!op||op.complete||op.sector!==g.sector)return;if(op.metric==='score')op.progress=Math.max(op.progress,Math.max(0,(Number(g.score)||0)-op.baselineScore));else if(op.metric==='survive'){if((Number(g.shield)||0)>0)op.progress+=delta;}else if(op.metric==='shield'){const max=Math.max(1,Number(g.getMaxShield?.())||100);op.progress=(Number(g.shield)||0)>=max*.62?op.progress+delta:Math.max(0,op.progress-delta*.35);}else if(op.metric==='objective'){if(g.sideObjective?.complete&&!state.lastObjectiveComplete)op.progress=op.target;state.lastObjectiveComplete=Boolean(g.sideObjective?.complete);}op.progress=clamp(op.progress,0,op.target);if(op.progress>=op.target)completeOperation(g);}

function addControl(profile,factionId,amount){profile.control[factionId]=clamp((profile.control[factionId]||0)+amount,0,100);profile.bestControl=Math.max(profile.bestControl,profile.control[factionId]);}
function completeOperation(g){const op=state.current;if(!op||op.complete)return;op.complete=true;op.progress=op.target;const profile=loadProfile();const bonus=op.route==='volatile'?2:op.route==='bounty'?1:0;profile.operations+=1;profile.warMarks+=op.reward;profile.standing[op.factionId]=(profile.standing[op.factionId]||0)+op.reward+bonus;addControl(profile,op.factionId,4+bonus);profile.lastMission={id:op.id,name:op.name,factionId:op.factionId,sector:op.sector,at:Date.now(),reward:op.reward};profile.history=[profile.lastMission,...profile.history].slice(0,16);saveProfile(profile);g.addHeat?.(18);g.callbacks?.onAnnounce?.(`WAR OP COMPLETE · ${op.name} · +${op.reward} MARKS`);window.dispatchEvent(new CustomEvent('wae:v28-war-update',{detail:{profile,operation:{...op}}}));renderAll();}

function registerKill(g,position){const op=state.current;if(!op||op.complete)return;let priority=false;try{priority=Boolean(g.findMinibossAt?.(position)||g.findEliteAt?.(position));}catch{}if(op.metric==='kills')op.progress+=1;else if(op.metric==='priority'&&priority)op.progress+=1;op.progress=clamp(op.progress,0,op.target);if(op.progress>=op.target)completeOperation(g);else renderHud();}

function registerBossVictory(g){const faction=factionFor(g);const profile=loadProfile();profile.victories+=1;profile.warMarks+=4;profile.standing[faction.id]=(profile.standing[faction.id]||0)+6;addControl(profile,faction.id,12);profile.history=[{id:'guardian-victory',name:`${faction.short} GUARDIAN DOWN`,factionId:faction.id,sector:g.sector,at:Date.now(),reward:4},...profile.history].slice(0,16);saveProfile(profile);window.dispatchEvent(new CustomEvent('wae:v28-war-update',{detail:{profile}}));renderAll();}

function ensureHud(){let hud=$('#v28-war-hud');if(hud)return hud;hud=document.createElement('aside');hud.id='v28-war-hud';hud.className='v28-war-hud hidden';hud.innerHTML=`<span data-v28-emblem>◈</span><div><small data-v28-faction>WARFRONT</small><strong data-v28-op>OPERATION</strong><i><b data-v28-fill></b></i></div><em data-v28-value>0/0</em>`;$('#app')?.append(hud);state.hud=hud;return hud;}
function renderHud(){const g=game();const op=state.current;const hud=ensureHud();const visible=g?.state==='playing'&&op&&op.sector===g.sector&&!op.complete&&!g.boss;hud.classList.toggle('hidden',!visible);if(!visible)return;const percent=clamp((op.progress/Math.max(1,op.target))*100,0,100);$('[data-v28-emblem]',hud).textContent=op.emblem;$('[data-v28-faction]',hud).textContent=`${op.factionShort} WARFRONT`;$('[data-v28-op]',hud).textContent=op.name;$('[data-v28-fill]',hud).style.width=`${percent}%`;$('[data-v28-value]',hud).textContent=op.metric==='score'?`${Math.round(op.progress)}/${op.target}`:`${Math.floor(op.progress)}/${op.target}`;hud.style.setProperty('--v28-accent',op.color);}

function ensureWarRoom(){let modal=$('#v28-war-room');if(modal)return modal;modal=document.createElement('section');modal.id='v28-war-room';modal.className='v28-war-room hidden';modal.innerHTML=`<div class="v28-war-shell" role="dialog" aria-modal="true" aria-label="Faction War Room"><button class="v28-close" type="button" data-v28-close>×</button><header><div><span>WAE STRATEGIC COMMAND</span><h2>FACTION WAR ROOM</h2><p>Persistent war intelligence · operations · sector control</p></div><div class="v28-phase"><small>WAR PHASE</small><strong data-v28-phase>FRONTIER</strong></div></header><div class="v28-war-summary"><article><span>WAR MARKS</span><strong data-v28-marks>0</strong></article><article><span>OPERATIONS</span><strong data-v28-ops>0</strong></article><article><span>GUARDIANS</span><strong data-v28-victories>0</strong></article><article><span>STANCE</span><strong data-v28-stance>HOLD</strong></article></div><div class="v28-faction-grid" data-v28-factions></div><section class="v28-strategy"><div><span>NEXT ROUTE DOCTRINE</span><strong>SELECT STRATEGIC STANCE</strong></div><div class="v28-stance-buttons"><button type="button" data-v28-stance-id="stable">HOLD</button><button type="button" data-v28-stance-id="bounty">HUNT</button><button type="button" data-v28-stance-id="volatile">ASSAULT</button></div></section><div class="v28-history" data-v28-history></div></div>`;document.body.append(modal);modal.addEventListener('click',(event)=>{if(event.target===modal||event.target.closest('[data-v28-close]'))modal.classList.add('hidden');const btn=event.target.closest('[data-v28-stance-id]');if(btn){setStance(btn.dataset.v28StanceId);if(state.current&&!state.current.complete&&game()?.state!=='playing')chooseOperation(game(),true);renderWarRoom();}});return modal;}

function factionCard(faction,profile){const standing=profile.standing[faction.id]||0;const control=profile.control[faction.id]||0;const rank=rankFor(standing).name;return `<article class="v28-faction-card" style="--faction:${faction.color}"><div class="v28-faction-head"><b>${faction.emblem}</b><div><span>${faction.name}</span><strong>${rank}</strong></div></div><p>${faction.doctrine}</p><div class="v28-meter"><div><span>WAE CONTROL</span><em>${Math.round(control)}%</em></div><i><b style="width:${control}%"></b></i></div><div class="v28-faction-foot"><span>WAR REPUTATION</span><strong>${Math.round(standing)}</strong></div></article>`;}
function renderWarRoom(){const modal=ensureWarRoom();const profile=loadProfile();$('[data-v28-phase]',modal).textContent=warPhase(profile);$('[data-v28-marks]',modal).textContent=String(profile.warMarks);$('[data-v28-ops]',modal).textContent=String(profile.operations);$('[data-v28-victories]',modal).textContent=String(profile.victories);$('[data-v28-stance]',modal).textContent=stance().name;$('[data-v28-factions]',modal).innerHTML=Object.values(FACTIONS).map((f)=>factionCard(f,profile)).join('');$$('[data-v28-stance-id]',modal).forEach((btn)=>btn.classList.toggle('active',btn.dataset.v28StanceId===stance().id));const history=$('[data-v28-history]',modal);history.innerHTML=profile.history.length?`<span>RECENT WAR LOG</span>${profile.history.slice(0,6).map((item)=>`<article><b>${item.name}</b><small>SECTOR ${item.sector||'—'} · +${item.reward||0} · ${new Date(item.at).toLocaleDateString()}</small></article>`).join('')}`:'<span>RECENT WAR LOG</span><p>No operations recorded yet.</p>';}
export function openWarRoom(){const modal=ensureWarRoom();renderWarRoom();modal.classList.remove('hidden');}
function renderAll(){renderHud();if(!$('#v28-war-room')?.classList.contains('hidden'))renderWarRoom();}

export function installWarDirector(){const g=game();if(!g||state.installed||g.__waeV28WarDirector)return false;state.installed=true;g.__waeV28WarDirector=true;state.base.update=typeof g.updatePlaying==='function'?g.updatePlaying.bind(g):null;state.base.start=typeof g.start==='function'?g.start.bind(g):null;state.base.reset=typeof g.resetEngagementState==='function'?g.resetEngagementState.bind(g):null;state.base.kill=typeof g.registerDroneKill==='function'?g.registerDroneKill.bind(g):null;state.base.boss=typeof g.defeatBoss==='function'?g.defeatBoss.bind(g):null;state.base.route=typeof g.chooseRoute==='function'?g.chooseRoute.bind(g):null;
  if(state.base.kill)g.registerDroneKill=(position)=>{registerKill(g,position);return state.base.kill(position);};
  if(state.base.boss)g.defeatBoss=(...args)=>{const faction=factionFor(g);const result=state.base.boss(...args);registerBossVictory({...g,currentBiome:g.currentBiome,currentFaction:faction});return result;};
  if(state.base.route)g.chooseRoute=(id,...args)=>{const result=state.base.route(id,...args);if(result){setStance(id);if(state.current&&!state.current.complete)state.current.route=id;}return result;};
  if(state.base.reset)g.resetEngagementState=(...args)=>{state.current=null;state.lastSector=0;return state.base.reset(...args);};
  if(state.base.start)g.start=async(...args)=>{const result=await state.base.start(...args);chooseOperation(g,true);return result;};
  if(state.base.update)g.updatePlaying=(delta,elapsed)=>{state.base.update(delta,elapsed);if(g.state!=='playing'){renderHud();return;}if(state.lastSector!==g.sector){state.lastSector=g.sector;chooseOperation(g,true);}operationProgress(g,delta);renderHud();};
  chooseOperation(g,true);ensureHud();ensureWarRoom();window.__waeOpenWarRoom=openWarRoom;window.dispatchEvent(new CustomEvent('wae:v28-war-ready'));return true;}
