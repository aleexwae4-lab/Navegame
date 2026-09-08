const PROFILE_KEY = 'wae_neon_rider_v19_raid_profile';
const RESCUE_WINDOW_MS = 11000;

let lastState = '';
let cachedStreak = 0;
let pendingUntil = 0;

function game() {
  return window.__waeNeonRiderGame;
}

function readProfile() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function cacheLiveStreak() {
  const profile = readProfile();
  cachedStreak = Math.max(cachedStreak, Math.max(0, Math.floor(Number(profile.streak) || 0)));
}

function restoreStreakAfterRevive() {
  if (!cachedStreak) return;
  const profile = readProfile();
  const current = Math.max(0, Math.floor(Number(profile.streak) || 0));
  if (current >= cachedStreak) return;
  profile.streak = cachedStreak;
  profile.bestStreak = Math.max(cachedStreak, Math.max(0, Math.floor(Number(profile.bestStreak) || 0)));
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch {}
}

function tick() {
  const state = game()?.state || '';
  if (state === 'playing') cacheLiveStreak();

  if (state === 'gameover' && lastState !== 'gameover') {
    pendingUntil = Date.now() + RESCUE_WINDOW_MS;
  }

  if (state === 'playing' && lastState === 'gameover' && pendingUntil > Date.now()) {
    restoreStreakAfterRevive();
    pendingUntil = 0;
  }

  if (pendingUntil && Date.now() >= pendingUntil) {
    pendingUntil = 0;
    cachedStreak = 0;
  }

  lastState = state;
}

window.setInterval(tick, 120);
