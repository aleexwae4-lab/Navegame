import { NeonRiderGame as CinematicGame } from '../v8/game.js';
import { CONFIG as V8_CONFIG } from '../v8/config.js';
import { CAMPAIGN_RANKS, CONFIG, FACTIONS, SIDE_OBJECTIVES } from './config.js';

function readJson(key) {
  try { return JSON.parse(localStorage.getItem(key) ?? '{}'); }
  catch { return {}; }
}

function safeFactionVictories(value) {
  const base = {};
  for (const faction of Object.values(FACTIONS)) base[faction.id] = Math.max(0, Math.floor(Number(value?.[faction.id]) || 0));
  return base;
}

function mergeProfile(base) {
  const saved = readJson(CONFIG.profileKey);
  const source = Object.keys(saved).length ? saved : base;
  return {
    ...base,
    ...source,
    unlockedShips: Array.isArray(source.unlockedShips) ? source.unlockedShips : base.unlockedShips,
    unlockedWeapons: Array.isArray(source.unlockedWeapons) ? source.unlockedWeapons : base.unlockedWeapons,
    campaignRenown: Math.max(0, Math.floor(Number(source.campaignRenown) || 0)),
    sideObjectivesCompleted: Math.max(0, Math.floor(Number(source.sideObjectivesCompleted) || 0)),
    campaignVictories: Math.max(0, Math.floor(Number(source.campaignVictories) || 0)),
    factionVictories: safeFactionVictories(source.factionVictories),
  };
}

function rankForRenown(renown) {
  let rank = CAMPAIGN_RANKS[0];
  for (const candidate of CAMPAIGN_RANKS) if (renown >= candidate.min) rank = candidate;
  return rank;
}

export class NeonRiderGame extends CinematicGame {
  constructor(container, callbacks = {}) {
    super(container, callbacks);
    this.profile = mergeProfile(this.profile);
    this.currentFaction = FACTIONS[this.currentBiome?.id] ?? FACTIONS['cyan-void'];
    this.sideObjective = null;
    this.objectiveBaseline = {};
    this.objectiveShieldTime = 0;
    this.factionEnemySpeedApplied = 1;
    this.prepareSectorCampaign(true);
  }

  saveProfile() {
    const payload = JSON.stringify(this.profile);
    localStorage.setItem(CONFIG.profileKey, payload);
    localStorage.setItem(V8_CONFIG.profileKey, payload);
  }

  campaignRank() {
    return rankForRenown(this.profile?.campaignRenown ?? 0);
  }

  campaignChapter() {
    return Math.floor((Math.max(1, this.profile?.bestSector ?? this.sector ?? 1) - 1) / CONFIG.campaign.chapterEvery) + 1;
  }

  metaSnapshot() {
    return {
      ...super.metaSnapshot(),
      campaignRenown: this.profile.campaignRenown ?? 0,
      sideObjectivesCompleted: this.profile.sideObjectivesCompleted ?? 0,
      campaignVictories: this.profile.campaignVictories ?? 0,
      factionVictories: { ...(this.profile.factionVictories ?? safeFactionVictories()) },
      campaignRank: this.campaignRank().name,
      campaignChapter: this.campaignChapter(),
    };
  }

  resetEngagementState() {
    super.resetEngagementState();
    this.sideObjective = null;
    this.objectiveBaseline = {};
    this.objectiveShieldTime = 0;
    this.factionEnemySpeedApplied = 1;
    this.currentFaction = FACTIONS[this.currentBiome?.id] ?? FACTIONS['cyan-void'];
  }

  objectiveSnapshot() {
    if (!this.sideObjective) return null;
    return {
      id: this.sideObjective.id,
      name: this.sideObjective.name,
      description: this.sideObjective.description,
      target: this.sideObjective.target,
      progress: Math.min(this.sideObjective.target, this.sideObjective.progress ?? 0),
      complete: Boolean(this.sideObjective.complete),
      rewardCores: this.sideObjective.rewardCores,
      rewardRenown: this.sideObjective.rewardRenown,
    };
  }

  snapshot() {
    const state = super.snapshot();
    return {
      ...state,
      campaign: {
        faction: this.currentFaction,
        objective: this.objectiveSnapshot(),
        rank: this.campaignRank().name,
        renown: this.profile.campaignRenown ?? 0,
        chapter: this.campaignChapter(),
      },
      meta: this.metaSnapshot(),
    };
  }

  applyFaction() {
    const faction = FACTIONS[this.currentBiome?.id] ?? FACTIONS['cyan-void'];
    this.currentFaction = faction;
    if (this.runMods) {
      const previous = this.factionEnemySpeedApplied || 1;
      this.runMods.enemySpeed = (this.runMods.enemySpeed / previous) * faction.enemySpeed;
      this.factionEnemySpeedApplied = faction.enemySpeed;
    }
    this.callbacks.onFaction?.(faction);
  }

  applyBiome(sector = this.sector) {
    super.applyBiome(sector);
    this.applyFaction();
  }

  chooseObjective() {
    let pool = SIDE_OBJECTIVES.filter((objective) => !(objective.id === 'elite' && this.sector < 2));
    if (pool.length === 0) pool = [...SIDE_OBJECTIVES];
    const offset = (this.sector + (this.profile?.campaignRenown ?? 0)) % pool.length;
    const rotated = [...pool.slice(offset), ...pool.slice(0, offset)];
    return rotated[Math.floor(Math.random() * Math.min(3, rotated.length))];
  }

  prepareSectorCampaign(force = false) {
    if (!force && this.sideObjective?.sector === this.sector) return;
    const definition = this.chooseObjective();
    this.sideObjective = { ...definition, sector: this.sector, progress: 0, complete: false };
    this.objectiveShieldTime = 0;
    this.objectiveBaseline = {
      score: this.score ?? 0,
      missiles: this.profile?.missilesFired ?? 0,
      elites: this.profile?.eliteKills ?? 0,
    };
    this.callbacks.onObjective?.(this.objectiveSnapshot());
    this.callbacks.onFaction?.(this.currentFaction);
  }

  completeSideObjective() {
    if (!this.sideObjective || this.sideObjective.complete) return;
    this.sideObjective.complete = true;
    this.sideObjective.progress = this.sideObjective.target;
    this.profile.cores += this.sideObjective.rewardCores;
    this.profile.campaignRenown = (this.profile.campaignRenown ?? 0) + this.sideObjective.rewardRenown;
    this.profile.sideObjectivesCompleted = (this.profile.sideObjectivesCompleted ?? 0) + 1;
    this.saveProfile();
    this.addHeat(24);
    this.callbacks.onAnnounce?.(`OBJETIVO COMPLETO · +${this.sideObjective.rewardCores} CORE${this.sideObjective.rewardCores > 1 ? 'S' : ''} · +${this.sideObjective.rewardRenown} RENOMBRE`);
    this.callbacks.onObjective?.(this.objectiveSnapshot());
    this.callbacks.onMeta?.(this.metaSnapshot());
    this.callbacks.onHud?.(this.snapshot());
  }

  updateSideObjective(delta) {
    if (!this.sideObjective || this.sideObjective.complete || this.state !== 'playing') return;
    let progress = this.sideObjective.progress ?? 0;
    if (this.sideObjective.id === 'combo') progress = Math.max(progress, this.combo ?? 0);
    else if (this.sideObjective.id === 'elite') progress = (this.profile.eliteKills ?? 0) - (this.objectiveBaseline.elites ?? 0);
    else if (this.sideObjective.id === 'missile') progress = (this.profile.missilesFired ?? 0) - (this.objectiveBaseline.missiles ?? 0);
    else if (this.sideObjective.id === 'score') progress = Math.max(0, (this.score ?? 0) - (this.objectiveBaseline.score ?? 0));
    else if (this.sideObjective.id === 'shield') {
      const threshold = this.getMaxShield() * 0.7;
      this.objectiveShieldTime = this.shield >= threshold ? this.objectiveShieldTime + delta : 0;
      progress = this.objectiveShieldTime;
    }
    this.sideObjective.progress = Math.max(0, progress);
    if (this.sideObjective.progress >= this.sideObjective.target) this.completeSideObjective();
  }

  fireEnemy(origin, speed, spread = 0) {
    const resolvedSpeed = Number.isFinite(speed) ? speed : CONFIG.drone.bulletSpeed;
    const multiplier = this.currentFaction?.bulletSpeed ?? 1;
    super.fireEnemy(origin, resolvedSpeed * multiplier, spread);
  }

  damageShip(damage, position) {
    super.damageShip(damage * (this.currentFaction?.damage ?? 1), position);
  }

  spawnDrone(forceElite = false) {
    super.spawnDrone(forceElite);
    const drone = this.drones[this.drones.length - 1];
    if (!drone || drone.userData.elite || this.sector < CONFIG.elite.minSector) return;
    if (Math.random() < (this.currentFaction?.eliteBonus ?? 0)) this.promoteElite(drone);
  }

  activateMissile() {
    const fired = super.activateMissile();
    if (fired) this.updateSideObjective(0);
    return fired;
  }

  registerDroneKill(position) {
    super.registerDroneKill(position);
    this.updateSideObjective(0);
  }

  defeatBoss() {
    const defeatedFaction = this.currentFaction ?? FACTIONS['cyan-void'];
    super.defeatBoss();
    this.profile.campaignVictories = (this.profile.campaignVictories ?? 0) + 1;
    this.profile.factionVictories ??= safeFactionVictories();
    this.profile.factionVictories[defeatedFaction.id] = (this.profile.factionVictories[defeatedFaction.id] ?? 0) + 1;
    this.profile.campaignRenown = (this.profile.campaignRenown ?? 0) + 1;
    this.saveProfile();
    this.callbacks.onCampaign?.({
      faction: defeatedFaction,
      rank: this.campaignRank().name,
      chapter: this.campaignChapter(),
      renown: this.profile.campaignRenown,
    });
    this.callbacks.onMeta?.(this.metaSnapshot());
  }

  async start() {
    await super.start();
    this.applyFaction();
    this.prepareSectorCampaign(true);
    this.callbacks.onCampaign?.({ faction: this.currentFaction, rank: this.campaignRank().name, chapter: this.campaignChapter(), renown: this.profile.campaignRenown ?? 0 });
    this.callbacks.onHud?.(this.snapshot());
  }

  updatePlaying(delta, elapsed) {
    super.updatePlaying(delta, elapsed);
    if (this.state !== 'playing') return;
    if (this.sideObjective?.sector !== this.sector) this.prepareSectorCampaign();
    this.updateSideObjective(delta);
  }

  endGame() {
    this.saveProfile();
    super.endGame();
  }
}
