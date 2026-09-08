import * as THREE from 'three';

const PREMIUM_IDS = new Set(['viper-black','aegis-sovereign','nova-imperium','eclipse-x','obsidian-one','celestial-crown']);

const STYLE = Object.freeze({
  falcon: { span: 5.9, sweep: 2.5, root: 2.2, tip: .72, body: 4.9, width: .92, height: .72, cockpit: [1.0,.52,1.72], engines: 2, armor: .72, edge: .82 },
  viper: { span: 6.35, sweep: 3.25, root: 1.85, tip: .42, body: 5.15, width: .72, height: .58, cockpit: [.86,.42,1.95], engines: 2, armor: .62, edge: .9 },
  aegis: { span: 6.65, sweep: 1.75, root: 2.7, tip: 1.12, body: 5.0, width: 1.12, height: .88, cockpit: [1.04,.58,1.52], engines: 4, armor: .92, edge: .68 },
  nova: { span: 6.15, sweep: 2.3, root: 2.2, tip: .72, body: 5.35, width: .96, height: .7, cockpit: [.94,.48,1.82], engines: 3, armor: .74, edge: .92 },
  'viper-black': { span: 6.55, sweep: 3.45, root: 1.9, tip: .34, body: 5.35, width: .72, height: .55, cockpit: [.86,.4,2.02], engines: 2, armor: .64, edge: 1 },
  'aegis-sovereign': { span: 6.85, sweep: 1.7, root: 2.82, tip: 1.18, body: 5.25, width: 1.18, height: .92, cockpit: [1.08,.58,1.6], engines: 4, armor: 1, edge: .82 },
  'nova-imperium': { span: 6.55, sweep: 2.25, root: 2.42, tip: .78, body: 5.55, width: 1.0, height: .72, cockpit: [.98,.5,1.9], engines: 3, armor: .8, edge: 1 },
  'eclipse-x': { span: 7.05, sweep: 3.55, root: 2.08, tip: .38, body: 5.55, width: .82, height: .58, cockpit: [.92,.43,2.08], engines: 3, armor: .72, edge: 1 },
  'obsidian-one': { span: 7.25, sweep: 2.95, root: 2.45, tip: .62, body: 5.7, width: .94, height: .62, cockpit: [.92,.42,2.08], engines: 4, armor: .86, edge: .88 },
  'celestial-crown': { span: 7.6, sweep: 2.35, root: 2.65, tip: .82, body: 5.9, width: 1.02, height: .7, cockpit: [1.02,.5,1.92], engines: 4, armor: .94, edge: 1 },
});

function hex(value, fallback = 0x22d3ee) {
  if (Number.isFinite(value)) return Number(value);
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value.replace('#',''), 16);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function shipKey(config = {}) {
  const id = String(config.id || '').toLowerCase();
  if (STYLE[id]) return id;
  const name = String(config.name || '').toLowerCase();
  if (name.includes('viper')) return config.premium ? 'viper-black' : 'viper';
  if (name.includes('aegis')) return config.premium ? 'aegis-sovereign' : 'aegis';
  if (name.includes('nova')) return config.premium ? 'nova-imperium' : 'nova';
  if (name.includes('eclipse')) return 'eclipse-x';
  if (name.includes('obsidian')) return 'obsidian-one';
  if (name.includes('celestial')) return 'celestial-crown';
  return 'falcon';
}

function planformGeometry(span, sweep, root, tip, thickness = .14) {
  const h = thickness / 2;
  const half = span / 2;
  const pts = [
    [-.42, -root * .5], [half, sweep - tip * .5], [half, sweep + tip * .5], [.32, root * .5],
  ];
  const positions = [];
  for (const y of [-h, h]) for (const [x,z] of pts) positions.push(x,y,z);
  const faces = [
    4,5,6, 4,6,7, 0,2,1, 0,3,2,
    0,1,5, 0,5,4, 1,2,6, 1,6,5,
    2,3,7, 2,7,6, 3,0,4, 3,4,7,
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(faces);
  geometry.computeVertexNormals();
  return geometry;
}

function mat(color, opts = {}) {
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness: opts.metalness ?? .86,
    roughness: opts.roughness ?? .2,
    clearcoat: opts.clearcoat ?? .5,
    clearcoatRoughness: opts.clearcoatRoughness ?? .16,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    transparent: Boolean(opts.transparent),
    opacity: opts.opacity ?? 1,
  });
}

function glow(color, opacity = .82) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
}

function add(group, geometry, material, position = [0,0,0], rotation = [0,0,0], scale = [1,1,1], name = '') {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.scale.set(...scale);
  if (name) mesh.name = name;
  group.add(mesh);
  return mesh;
}

function addEdge(group, accent, side, s) {
  const strip = add(group, new THREE.BoxGeometry(.075,.055,Math.max(1.2,s.sweep + s.tip)), glow(accent,.72), [side * (s.span * .34), .13, s.sweep * .53], [0, side * -.16, side * -.14]);
  strip.userData.v25Pulse = true;
  return strip;
}

function addEngine(group, x, z, accent, hull, size = 1) {
  const nozzle = new THREE.CylinderGeometry(.36*size,.46*size,.82*size,18);
  nozzle.rotateX(Math.PI/2);
  add(group, nozzle, hull.clone(), [x,-.08,z]);
  const ring = new THREE.TorusGeometry(.38*size,.055*size,8,28);
  add(group, ring, glow(accent,.9), [x,-.08,z+.42*size], [Math.PI/2,0,0]);
  const flameGeo = new THREE.ConeGeometry(.3*size,1.55*size,14);
  flameGeo.rotateX(-Math.PI/2);
  const flame = add(group, flameGeo, glow(accent,.66), [x,-.08,z+1.12*size]);
  flame.userData.v25Engine = true;
  return flame;
}

function addWeaponMounts(group, weapon = {}, accent = 0x22d3ee, s = STYLE.falcon) {
  const id = String(weapon.id || '').toLowerCase();
  const premium = Boolean(weapon.premium);
  const color = hex(weapon.accent, accent);
  const weaponMat = mat(0x0b1220,{metalness:.92,roughness:.16,emissive:color,emissiveIntensity:premium?.32:.16});
  let xs = [-s.span*.38,s.span*.38];
  if (id.includes('trident')) xs = [-s.span*.34,0,s.span*.34];
  if (id.includes('storm')) xs = [-s.span*.4,-s.span*.16,s.span*.16,s.span*.4];
  if (id.includes('eclipse')) xs = [0];
  if (id.includes('helix')) xs = [-.22,.22];
  if (id.includes('nova-destroyer')) xs = [-s.span*.33,s.span*.33];
  if (id.includes('singularity')) xs = [0];
  for (const x of xs) {
    const radius = id.includes('eclipse') || id.includes('singularity') ? .13 : .075;
    const length = id.includes('helix') ? 2.7 : id.includes('eclipse') ? 2.35 : 1.85;
    const barrel = new THREE.CylinderGeometry(radius,radius*1.08,length,12);
    barrel.rotateX(Math.PI/2);
    add(group, barrel, weaponMat.clone(), [x,.05,-1.65]);
    add(group, new THREE.SphereGeometry(radius*1.6,10,8), glow(color,.84), [x,.05,-2.58]);
  }
  if (id.includes('singularity')) {
    const core = add(group,new THREE.IcosahedronGeometry(.32,2),glow(color,.72),[0,.22,-1.02]);
    core.userData.v25Spin = 1.2;
    for (const r of [.52,.74]) {
      const ring = add(group,new THREE.TorusGeometry(r,.035,8,32),glow(color,.56),[0,.22,-1.02],[Math.PI/2,r,0]);
      ring.userData.v25Spin = r === .52 ? -1.1 : .82;
    }
  }
}

function addSignature(group, key, accent, s, hull, trim, glass) {
  if (key.includes('aegis')) {
    for (const side of [-1,1]) {
      add(group,new THREE.BoxGeometry(1.12,.46,2.2),hull.clone(),[side*2.18,.02,.92],[0,side*.04,side*.03]);
      add(group,new THREE.BoxGeometry(.12,.09,2.0),trim.clone(),[side*2.7,.24,.72],[0,side*.06,side*.04]);
    }
  }
  if (key.includes('nova')) {
    const reactor = add(group,new THREE.TorusGeometry(.86,.095,12,44),trim.clone(),[0,.08,1.4],[Math.PI/2,0,0]);
    reactor.userData.v25Spin = .55;
  }
  if (key === 'eclipse-x') {
    for (const side of [-1,1]) {
      const blade = new THREE.ConeGeometry(.32,2.5,4); blade.rotateX(Math.PI/2);
      add(group,blade,hull.clone(),[side*3.12,.16,.42],[0,0,side*-.5],[.78,.5,1]);
    }
  }
  if (key === 'obsidian-one') {
    const halo = add(group,new THREE.TorusGeometry(1.42,.04,8,52),glow(accent,.38),[0,.02,.72],[Math.PI/2,0,0]);
    halo.userData.v25Spin = -.28;
  }
  if (key === 'celestial-crown') {
    for (const r of [1.28,1.7,2.08]) {
      const crown = add(group,new THREE.TorusGeometry(r,.035,8,52),glow(accent,.46),[0,.06,.72],[Math.PI/2,0,0]);
      crown.userData.v25Spin = .18+r*.08;
    }
    for (const side of [-1,1]) add(group,new THREE.ConeGeometry(.18,1.35,6),trim.clone(),[side*1.14,.72,-.08],[0,0,side*-.22]);
  }
  if (key === 'viper-black') {
    for (const side of [-1,1]) add(group,new THREE.BoxGeometry(.08,.09,2.7),trim.clone(),[side*2.8,.2,.6],[0,side*.12,side*-.22]);
  }
  if (PREMIUM_IDS.has(key)) {
    const badge = add(group,new THREE.TorusGeometry(.34,.025,8,28),glow(accent,.55),[0,.62,.24],[Math.PI/2,0,0]);
    badge.userData.v25Spin = .62;
  }
  glass.emissiveIntensity = key === 'obsidian-one' ? .34 : .46;
}

export function createSignatureShipModel(config = {}, { mode = 'game', weapon = null } = {}) {
  const key = shipKey(config);
  const s = STYLE[key] || STYLE.falcon;
  const accent = hex(config.accent, key === 'celestial-crown' ? 0xfde68a : 0x22d3ee);
  const premium = Boolean(config.premium || PREMIUM_IDS.has(key));
  const dark = key === 'obsidian-one' || key === 'viper-black';
  const group = new THREE.Group();
  group.name = `WAE_V25_SIGNATURE_${key.toUpperCase()}`;
  group.userData.v25Signature = true;
  group.userData.v25Key = key;

  const hull = mat(dark ? 0x03060b : premium ? 0x09101c : 0x172033,{metalness:.94,roughness:premium?.16:.21,clearcoat:.68});
  const panel = mat(dark ? 0x0a0f17 : 0x263247,{metalness:.84,roughness:.28,clearcoat:.34});
  const trim = mat(accent,{metalness:.72,roughness:.2,emissive:accent,emissiveIntensity:premium?.56:.26});
  const glass = mat(0x071526,{metalness:.3,roughness:.08,clearcoat:1,emissive:accent,emissiveIntensity:.42,transparent:true,opacity:.88});

  const fuselage = new THREE.CylinderGeometry(s.width*.56,s.width*.86,s.body,18,1,false);
  fuselage.rotateX(Math.PI/2);
  add(group,fuselage,hull,[0,0,.15],[0,0,0],[1,s.height,1]);

  const nose = new THREE.ConeGeometry(s.width*.9,2.0,18); nose.rotateX(Math.PI/2);
  add(group,nose,hull.clone(),[0,0,-2.72],[0,0,0],[1,s.height*.95,1]);

  const keel = add(group,new THREE.BoxGeometry(.38,.24,s.body*.92),panel.clone(),[0,-.38,.42]);
  keel.rotation.z = .02;

  const wing = planformGeometry(s.span,s.sweep,s.root,s.tip,.16+(s.armor-.6)*.09);
  add(group,wing,hull.clone(),[0,-.08,-.05]);
  const underWing = planformGeometry(s.span*.9,s.sweep*.88,s.root*.72,s.tip*.8,.09);
  add(group,underWing,panel.clone(),[0,-.22,.2]);

  const canopy = add(group,new THREE.SphereGeometry(.72,24,14),glass,[0,.54,-.62],[0,0,0],s.cockpit);
  canopy.name = 'V25_CANOPY';
  add(group,new THREE.BoxGeometry(.075,.07,2.15),trim.clone(),[0,.8,-.72]);
  for (const side of [-1,1]) addEdge(group,accent,side,s);

  const shoulderGeo = new THREE.CylinderGeometry(.18,.34,2.25,12); shoulderGeo.rotateX(Math.PI/2);
  for (const side of [-1,1]) add(group,shoulderGeo,panel.clone(),[side*s.span*.27,.02,.75],[0,side*.12,0]);

  const engineXs = s.engines === 2 ? [-.82,.82] : s.engines === 3 ? [-1.15,0,1.15] : [-1.55,-.52,.52,1.55];
  for (const x of engineXs) addEngine(group,x,2.18,accent,panel,s.engines===4?.84:1);

  addSignature(group,key,accent,s,hull,trim,glass);
  addWeaponMounts(group,weapon || config.weapon || {},accent,s);

  const reactor = add(group,new THREE.IcosahedronGeometry(.24,premium?1:0),glow(accent,.74),[0,-.02,1.38]);
  reactor.userData.v25Pulse = true;
  const light = new THREE.PointLight(accent,mode === 'hangar' ? 9 : premium ? 5.4 : 3.8,mode === 'hangar' ? 15 : 10,2);
  light.position.set(0,.35,1.35);
  group.add(light);

  group.scale.setScalar(mode === 'hangar' ? .88 : .98);
  if (mode === 'hangar') group.rotation.x = -.06;
  return group;
}

export function animateSignatureShip(group, delta, elapsed, input = null) {
  if (!group?.userData?.v25Signature) return;
  const right = Number(input?.right) - Number(input?.left);
  const up = Number(input?.up) - Number(input?.down);
  group.rotation.z += ((-right*.075) - group.rotation.z) * Math.min(1,delta*7);
  group.rotation.x += ((up*.025) - group.rotation.x) * Math.min(1,delta*6);
  group.traverse((node) => {
    if (node.userData?.v25Engine && node.material) {
      const pulse = .9 + Math.sin(elapsed*16 + node.position.x)*.1;
      node.scale.z = pulse;
      node.material.opacity = .54 + pulse*.13;
    }
    if (node.userData?.v25Pulse && node.material) node.material.opacity = .62 + Math.sin(elapsed*3.4)*.12;
    const spin = Number(node.userData?.v25Spin);
    if (Number.isFinite(spin) && spin) {
      node.rotation.z += delta*spin;
      node.rotation.y += delta*spin*.24;
    }
  });
}

export function disposeSignatureShip(group) {
  if (!group) return;
  group.traverse((node) => {
    node.geometry?.dispose?.();
    if (Array.isArray(node.material)) node.material.forEach((m) => m?.dispose?.());
    else node.material?.dispose?.();
  });
  group.parent?.remove(group);
}
