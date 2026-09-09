import { createClient } from '@supabase/supabase-js';

const REWARD_KEY = 'wae_neon_rider_v21_reward_forge';
const ROOM_RE = /^[A-Z0-9]{4,8}$/;
const env = {
  url: String(import.meta.env.VITE_WAE_SUPABASE_URL ?? '').replace(/\/$/, ''),
  key: String(import.meta.env.VITE_WAE_SUPABASE_PUBLISHABLE_KEY ?? ''),
};

const bridge = {
  client: null,
  channel: null,
  room: '',
  profiles: new Map(),
  syncTimer: 0,
};

function safeJson(key, fallback = {}) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value && typeof value === 'object' ? value : fallback;
  } catch {
    return fallback;
  }
}

function currentRoom() {
  try {
    const room = String(new URL(window.location.href).searchParams.get('squad') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    return ROOM_RE.test(room) ? room : '';
  } catch {
    return '';
  }
}

function localIdentity() {
  const forge = window.__waeRewardForge?.getIdentity?.();
  const stored = safeJson(REWARD_KEY, {});
  const equipped = stored.equipped || {};
  const callsign = String(localStorage.getItem('wae_neon_rider_callsign') || 'PILOTO').slice(0, 18);
  const playerId = String(sessionStorage.getItem('wae_neon_rider_player_id') || '').slice(0, 80);
  return {
    playerId,
    callsign,
    title: String(forge?.title || equipped.title || 'PILOT').replace(/[^A-Z0-9 _-]/gi, '').slice(0, 28),
    badge: String(forge?.badge || equipped.badge || '').replace(/[^A-Z0-9 _-]/gi, '').slice(0, 28),
    badgeIcon: String(forge?.badgeIcon || '').slice(0, 2),
    updatedAt: Date.now(),
  };
}

function client() {
  if (!env.url || !env.key) return null;
  if (!bridge.client) {
    bridge.client = createClient(env.url, env.key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      realtime: { params: { eventsPerSecond: 8 } },
    });
  }
  return bridge.client;
}

function syncPresence() {
  const state = bridge.channel?.presenceState?.() || {};
  bridge.profiles.clear();
  for (const entries of Object.values(state)) {
    for (const entry of entries || []) {
      if (!entry?.callsign) continue;
      bridge.profiles.set(String(entry.callsign), {
        title: String(entry.title || 'PILOT').slice(0, 28),
        badge: String(entry.badge || '').slice(0, 28),
        badgeIcon: String(entry.badgeIcon || '').slice(0, 2),
      });
    }
  }
  decorateRoster();
}

function decorateRoster() {
  const roster = document.querySelector('[data-v16-roster]');
  if (!roster) return;
  for (const row of roster.querySelectorAll('.v16-roster-player')) {
    const name = row.querySelector('strong')?.textContent?.trim();
    if (!name) continue;
    row.querySelector('.v2114-squad-reward')?.remove();
    const profile = bridge.profiles.get(name);
    if (!profile) continue;
    const emptyBadge = !profile.badge || /SIN INSIGNIA/i.test(profile.badge);
    const emptyTitle = !profile.title || /^PILOT$/i.test(profile.title);
    if (emptyBadge && emptyTitle) continue;
    const tag = document.createElement('em');
    tag.className = 'v2114-squad-reward';
    const parts = [];
    if (!emptyBadge) parts.push(`${profile.badgeIcon || '✦'} ${profile.badge}`.trim());
    if (!emptyTitle) parts.push(profile.title);
    tag.textContent = parts.join(' · ');
    row.querySelector('div')?.append(tag);
  }
}

async function disconnect() {
  if (bridge.channel) {
    try { await bridge.channel.untrack(); } catch {}
    try { await bridge.client?.removeChannel(bridge.channel); } catch {}
  }
  bridge.channel = null;
  bridge.room = '';
  bridge.profiles.clear();
  decorateRoster();
}

async function connect(room) {
  if (!room || room === bridge.room || !client()) return;
  await disconnect();
  bridge.room = room;
  const channel = client().channel(`wae-neon-squad-cosmetics:${room}`, {
    config: { presence: { key: localIdentity().playerId || `cos-${Math.random().toString(36).slice(2)}` } },
  });
  bridge.channel = channel;
  channel
    .on('presence', { event: 'sync' }, syncPresence)
    .on('presence', { event: 'join' }, syncPresence)
    .on('presence', { event: 'leave' }, syncPresence);
  channel.subscribe(async (status) => {
    if (status !== 'SUBSCRIBED' || bridge.channel !== channel) return;
    try { await channel.track(localIdentity()); } catch {}
    syncPresence();
  });
}

async function refreshIdentity() {
  if (!bridge.channel || !bridge.room) return;
  try { await bridge.channel.track(localIdentity()); } catch {}
}

async function syncRoom() {
  const room = currentRoom();
  if (!room && bridge.room) await disconnect();
  else if (room && room !== bridge.room) await connect(room);
  decorateRoster();
}

bridge.syncTimer = window.setInterval(syncRoom, 700);
window.addEventListener('pageshow', syncRoom);
window.addEventListener('beforeunload', () => bridge.channel?.untrack?.());
document.addEventListener('wae:rewards-changed', refreshIdentity);
document.addEventListener('wae:achievement-unlocked', syncRoom);
syncRoom();

window.__waeRewardSquadBridge = Object.freeze({
  refresh: refreshIdentity,
  getProfiles: () => [...bridge.profiles.entries()],
});
