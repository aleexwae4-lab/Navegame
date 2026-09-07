import * as THREE from 'three';
import { NeonRiderGame as LivingGalaxyGame } from '../v9/game.js';
import { CONFIG as V9_CONFIG } from '../v9/config.js';
import { CONFIG, MASTERY_RANKS } from './config.js';

function readJson(key) {
  try { return JSON.parse(localStorage.getItem(key) ?? '{}'); }
  catch { return {}; }
}

function masteryRankFor(xp) {
  let rank = MASTERY_RANKS[0];
  for (const candidate of MASTERY_RANKS) if (xp >= candidate.min) rank = candidate;
  return rank;
}

function mergeProfile(base) {
  const saved = readJson(CONFIG.profileKey);
  const source = Object.keys(saved).length ? saved : base;
  return {
    ...base,
    ...source,
    unlockedShips: Array.isArray(source.unlockedShips) ? source.unlockedShips : base.unlockedShips,
    unlockedWeapons: Array.isArray(source.unlockedWeapons) ? source.unlockedWeapons : base.unlockedWeapons,
    masteryXp: Math.max(0, Math.floor(Number(source.masteryXp) || 0)),
    masteryEvents: Math.max(0, Math.floor(Number(source.masteryEvents) || 0)),
    cleanSectors: Math.max(0, Math.floor(Number(source.cleanSectors) || 0)),
    masteryKillMilestone: Math.max(0, Math.floor(Number(source.masteryKillMilestone) || 0)),
    tutorialComplete: Boolean(source.tutorialComplete),
  };
}

export class NeonRiderGame extends LivingGalaxyGame {
  constructor(container, callbacks = {}) {
    super(container, callbacks);
    this.profile = mergeProfile(this.profile);
    this.launchGrace = 0;
    this.runDamage = 0;
    this.comboMasteryAwarded = false;
    this.coachTime = 0;
    this.coachIndex = 0;
    this.entryWarningDrones = new Set();
  }

  saveProfile() {
    const payload = JSON.stringify(this.profile);
    localStorage.setItem(CONFIG.profileKey, payload);
    localStorage.setItem(V9_CONFIG.profileKey, payload);
  }

  masteryRank() {
    return masteryRankFor(this.profile?.masteryXp ?? 0);
  }

  masterySnapshot() {
    const xp = this.profile?.masteryXp ?? 0;
    const rank = this.masteryRank();
    const ranks = MASTERY_RANKS;
    const index = Math.max(0, ranks.findIndex((candidate) => candidate.name === rank.name));
    const next = ranks[index + 1] ?? null;
    return {
      xp,
      rank: rank.name,
      next: next?.name ?? null,
      nextAt: next?.min ?? null,
      events: this.profile?.masteryEvents ?? 0,
      cleanSectors: this.profile?.cleanSectors ?? 0,
    };
  }

  metaSnapshot() {
    return {
      ...super.metaSnapshot(),
      masteryXp: this.profile.masteryXp ?? 0,
      masteryRank: this.masteryRank().name,
      masteryEvents: this.profile.masteryEvents ?? 0,
      cleanSectors: this.profile.cleanSectors ?? 0,
    };
  }

  snapshot() {
    return {
      ...super.snapshot(),
      mastery: this.masterySnapshot(),
      launchGrace: Math.max(0, this.launchGrace),
      meta: this.metaSnapshot(),
    };
  }

  createReusableResources() {
    super.createReusableResources();
    this.resources.v10WarningGeometry = new THREE.TorusGeometry(1.55, 0.055, 6, 28);
    this.resources.v10WarningMaterial = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
    });
    this.resources.v10ShotGeometry = new THREE.TorusGeometry(0.72, 0.05, 6, 24);
    this.resources.v10ShotMaterial = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
  }

  awardMastery(amount, label) {
    const points = Math.max(0, Math.floor(Number(amount) || 0));
    if (!points) return;
    const previousRank = this.masteryRank().name;
    this.profile.masteryXp = (this.profile.masteryXp ?? 0) + points;
    this.profile.masteryEvents = (this.profile.masteryEvents ?? 0) + 1;
    this.saveProfile();
    const nextRank = this.masteryRank().name;
    this.callbacks.onMastery?.({
      amount: points,
      label,
      mastery: this.masterySnapshot(),
      rankUp: nextRank !== previousRank,
    });
    this.callbacks.onMeta?.(this.metaSnapshot());
    if (nextRank !== previousRank) this.callbacks.onAnnounce?.(`MAESTRÍA · ${nextRank}`);
  }

  decorateEntryWarning(drone) {
    if (!drone || drone.userData.v10EntryWarning) return;
    const ring = new THREE.Mesh(this.resources.v10WarningGeometry, this.resources.v10WarningMaterial);
    ring.rotation.x = Math.PI / 2;
    ring.position.z = 1.55;
    drone.add(ring);
    drone.userData.v10EntryWarning = ring;
    drone.userData.v10EntryWarningTimer = CONFIG.mastery.entryTelegraphSeconds;
    drone.userData.fireTimer = Math.max(drone.userData.fireTimer ?? 0, CONFIG.mastery.entryTelegraphSeconds + 0.25);
    this.entryWarningDrones.add(drone);
  }

  spawnDrone(forceElite = false) {
    const before = this.drones.length;
    super.spawnDrone(forceElite);
    if (this.drones.length <= before) return;
    const drone = this.drones[this.drones.length - 1];
    this.decorateEntryWarning(drone);
  }

  syncEntryWarnings(delta) {
    for (const drone of [...this.entryWarningDrones]) {
      if (!drone?.parent || !this.drones.includes(drone)) {
        this.entryWarningDrones.delete(drone);
        continue;
      }
      drone.userData.v10EntryWarningTimer -= delta;
      const ring = drone.userData.v10EntryWarning;
      if (ring) {
        ring.rotation.z += delta * 5.5;
        const progress = 1 - Math.max(0, drone.userData.v10EntryWarningTimer) / CONFIG.mastery.entryTelegraphSeconds;
        ring.scale.setScalar(0.75 + progress * 0.5);
      }
      if (drone.userData.v10EntryWarningTimer <= 0) {
        if (ring) drone.remove(ring);
        drone.userData.v10EntryWarning = null;
        this.entryWarningDrones.delete(drone);
      }
    }
  }

  syncShotTelegraphs() {
    for (const drone of this.drones) {
      if (!drone?.parent || drone.userData.v10EntryWarningTimer > 0) continue;
      const timer = Number(drone.userData.fireTimer);
      const shouldWarn = Number.isFinite(timer) && timer > 0 && timer <= CONFIG.mastery.shotTelegraphSeconds && drone.position.z > -68 && drone.position.z < 3;
      let ring = drone.userData.v10ShotWarning;
      if (shouldWarn && !ring) {
        ring = new THREE.Mesh(this.resources.v10ShotGeometry, this.resources.v10ShotMaterial);
        ring.rotation.x = Math.PI / 2;
        ring.position.z = 1.45;
        drone.add(ring);
        drone.userData.v10ShotWarning = ring;
      }
      if (!shouldWarn && ring) {
        drone.remove(ring);
        drone.userData.v10ShotWarning = null;
      }
      if (shouldWarn && ring) ring.rotation.z += 0.18;
    }
  }

  cleanupShotTelegraphs() {
    for (const drone of this.drones) {
      const ring = drone.userData.v10ShotWarning;
      if (!ring) continue;
      const timer = Number(drone.userData.fireTimer);
      if (!Number.isFinite(timer) || timer > CONFIG.mastery.shotTelegraphSeconds) {
        drone.remove(ring);
        drone.userData.v10ShotWarning = null;
      }
    }
  }

  damageShip(damage, position) {
    const before = this.shield;
    const scaledDamage = this.launchGrace > 0 ? damage * CONFIG.mastery.launchDamageScale : damage;
    super.damageShip(scaledDamage, position);
    const taken = Math.max(0, before - this.shield);
    if (taken <= 0) return;
    this.runDamage += taken;
    this.triggerCinematic?.('ship-hit', 0.08);
    this.callbacks.onImpact?.({
      damage: taken,
      grace: this.launchGrace > 0,
      shield: this.shield,
    });
  }

  completeSideObjective() {
    const wasComplete = Boolean(this.sideObjective?.complete);
    super.completeSideObjective();
    if (!wasComplete && this.sideObjective?.complete) {
      this.awardMastery(CONFIG.mastery.rewards.objective, 'OBJETIVO COMPLETADO');
    }
  }

  registerDroneKill(position) {
    const minibossesBefore = this.profile.minibossesDefeated ?? 0;
    super.registerDroneKill(position);

    if ((this.profile.minibossesDefeated ?? 0) > minibossesBefore) {
      this.awardMastery(CONFIG.mastery.rewards.miniboss, 'MINI-BOSS DESTRUIDO');
    }

    const milestone = Math.floor((this.profile.totalKills ?? 0) / CONFIG.mastery.killMilestoneEvery);
    if (milestone > (this.profile.masteryKillMilestone ?? 0)) {
      this.profile.masteryKillMilestone = milestone;
      this.awardMastery(CONFIG.mastery.rewards.killMilestone, `${milestone * CONFIG.mastery.killMilestoneEvery} BAJAS`);
    }
  }

  defeatBoss() {
    const damageBeforeVictory = this.runDamage;
    super.defeatBoss();
    this.awardMastery(CONFIG.mastery.rewards.guardian, 'GUARDIÁN DERROTADO');
    if (damageBeforeVictory <= 0.01) {
      this.profile.cleanSectors = (this.profile.cleanSectors ?? 0) + 1;
      this.awardMastery(CONFIG.mastery.rewards.cleanSector, 'SECTOR PERFECTO');
    }
    this.runDamage = 0;
    this.comboMasteryAwarded = false;
  }

  emitCoach() {
    if (this.profile.tutorialComplete) return;
    const timeline = CONFIG.mastery.coachTimeline;
    while (this.coachIndex < timeline.length && this.coachTime >= timeline[this.coachIndex].at) {
      const step = timeline[this.coachIndex];
      this.callbacks.onCoach?.({ text: step.text, index: this.coachIndex, total: timeline.length });
      this.coachIndex += 1;
    }
    if (this.coachIndex >= timeline.length && this.coachTime >= timeline[timeline.length - 1].at + 2.4) {
      this.profile.tutorialComplete = true;
      this.saveProfile();
      this.callbacks.onCoach?.({ text: 'LISTO · AHORA JUEGA A TU MANERA', complete: true });
    }
  }

  async start() {
    await super.start();
    this.launchGrace = CONFIG.mastery.launchGraceSeconds;
    this.runDamage = 0;
    this.comboMasteryAwarded = false;
    this.coachTime = 0;
    this.coachIndex = 0;
    this.entryWarningDrones.clear();
    this.callbacks.onCoach?.({ text: 'PROTECCIÓN DE LANZAMIENTO ACTIVA' });
    this.callbacks.onHud?.(this.snapshot());
  }

  updatePlaying(delta, elapsed) {
    this.launchGrace = Math.max(0, this.launchGrace - delta);
    this.coachTime += delta;
    this.syncShotTelegraphs();

    super.updatePlaying(delta, elapsed);
    if (this.state !== 'playing') return;

    this.syncEntryWarnings(delta);
    this.cleanupShotTelegraphs();
    this.emitCoach();

    if (!this.comboMasteryAwarded && (this.combo ?? 0) >= CONFIG.mastery.comboTarget) {
      this.comboMasteryAwarded = true;
      this.awardMastery(CONFIG.mastery.rewards.combo, `COMBO ${CONFIG.mastery.comboTarget}`);
    }
  }

  clearEntities() {
    this.entryWarningDrones?.clear?.();
    super.clearEntities();
  }

  endGame() {
    this.saveProfile();
    super.endGame();
  }
}
