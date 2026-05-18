import { useEffect, useState } from 'react';
import { fetchAvatarFromBackend } from '../../api/apiService';
import { TEAM, getDisplayName } from '../../features/allocation/team';

/*
  Store CENTRAL de avatares.

  Antes cada componente fazia o seu próprio fetch (Mural, Topics, Dashboard,
  useTeamAvatars, AllocationItem legado, sidebar nova...) — n duplicatas
  do mesmo request. Agora há UM cache module-level. Qualquer componente
  que chamar `useAvatar(username)` ou `useAvatarsMap()` lê do mesmo store.

  Fases:
   1. Init (lazy, no 1º hook): semeia cache de TEAM com sticky-cache do
      localStorage (URLs reais já vistas). Quem não tem sticky vai com
      fallback (ui-avatars.com) e dispara fetch async no backend.
   2. Cada fetch que volta com sucesso atualiza o cache E o sticky.
   3. Backend vazio → retries com backoff (até MAX_TRIES).

  Reaproveita a chave `sticky_avatar_v1_` do UserAvatar — assim qualquer
  imagem já cacheada em sessões anteriores vem instantânea no 1º render.
*/

const STICKY_PREFIX = 'sticky_avatar_v1_';
const STICKY_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_TRIES = 3;
const RETRY_DELAY_MS = 4000;

// Map<username, { url, status, attempts, fetchedAt }>
const cache = new Map();
const listeners = new Set();
let initialized = false;

function fallbackUrl(username) {
  const display = getDisplayName(username) || username || '?';
  const name = encodeURIComponent(display);
  return `https://ui-avatars.com/api/?name=${name}&background=random&color=fff&bold=true&format=svg&size=128`;
}

function normalizeKey(name) {
  return (name || '').trim().toLowerCase();
}

function readSticky(username) {
  const k = normalizeKey(username);
  if (!k) return null;
  try {
    const raw = localStorage.getItem(STICKY_PREFIX + k);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.url) return null;
    if (Date.now() - (parsed.t || 0) > STICKY_TTL_MS) return null;
    return parsed.url;
  } catch {
    return null;
  }
}

function writeSticky(username, url) {
  const k = normalizeKey(username);
  if (!k || !url) return;
  try {
    localStorage.setItem(
      STICKY_PREFIX + k,
      JSON.stringify({ url, t: Date.now() }),
    );
  } catch {
    // localStorage cheio — silencia.
  }
}

function notify() {
  listeners.forEach((fn) => {
    try { fn(); } catch { /* ignore */ }
  });
}

async function fetchOne(username) {
  const entry = cache.get(username);
  if (entry?.status === 'loading' || entry?.status === 'ok') return;
  const attempts = (entry?.attempts || 0) + 1;
  cache.set(username, { ...entry, status: 'loading', attempts });
  try {
    const av = await fetchAvatarFromBackend(username);
    if (av?.success && av.url) {
      cache.set(username, {
        url: av.url,
        status: 'ok',
        attempts,
        fetchedAt: Date.now(),
      });
      writeSticky(username, av.url);
      notify();
      return;
    }
    // backend retornou vazio — pode estar fazendo scraping. Retry.
    if (attempts < MAX_TRIES) {
      cache.set(username, { ...cache.get(username), status: 'retry' });
      setTimeout(() => fetchOne(username), RETRY_DELAY_MS * attempts);
    } else {
      // Esgotou: fica com fallback definitivo.
      cache.set(username, {
        url: cache.get(username)?.url || fallbackUrl(username),
        status: 'failed',
        attempts,
      });
      notify();
    }
  } catch {
    cache.set(username, {
      url: cache.get(username)?.url || fallbackUrl(username),
      status: 'failed',
      attempts,
    });
    notify();
  }
}

function init() {
  if (initialized) return;
  initialized = true;
  for (const member of TEAM) {
    const sticky = readSticky(member.username);
    if (sticky) {
      cache.set(member.username, {
        url: sticky,
        status: 'ok',
        attempts: 0,
        fetchedAt: Date.now(),
      });
    } else {
      cache.set(member.username, {
        url: fallbackUrl(member.username),
        status: 'idle',
        attempts: 0,
      });
      fetchOne(member.username);
    }
  }
  notify();
}

/* === API síncrona === */

export function getAvatar(username) {
  init();
  if (!username) return fallbackUrl('');
  const entry = cache.get(username);
  if (entry?.url) return entry.url;
  // Username fora do TEAM (autor de tópico aleatório, etc.) — popula
  // sob demanda. Sticky check primeiro pra evitar fetch.
  const sticky = readSticky(username);
  if (sticky) {
    cache.set(username, { url: sticky, status: 'ok', attempts: 0, fetchedAt: Date.now() });
    return sticky;
  }
  cache.set(username, { url: fallbackUrl(username), status: 'idle', attempts: 0 });
  fetchOne(username);
  return fallbackUrl(username);
}

export function preloadUser(username) {
  init();
  if (!username) return;
  if (!cache.has(username)) {
    const sticky = readSticky(username);
    if (sticky) {
      cache.set(username, { url: sticky, status: 'ok', attempts: 0, fetchedAt: Date.now() });
      notify();
    } else {
      cache.set(username, { url: fallbackUrl(username), status: 'idle', attempts: 0 });
      fetchOne(username);
    }
  }
}

/* === Hooks reativos === */

export function useAvatar(username) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const fn = () => setTick((t) => t + 1);
    listeners.add(fn);
    init();
    if (username) preloadUser(username);
    return () => { listeners.delete(fn); };
  }, [username]);
  return getAvatar(username);
}

export function useAvatarsMap() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const fn = () => setTick((t) => t + 1);
    listeners.add(fn);
    init();
    return () => { listeners.delete(fn); };
  }, []);
  // Retorna um Map<username, url> só com TEAM (consumers comuns).
  const result = new Map();
  for (const member of TEAM) {
    const entry = cache.get(member.username);
    result.set(member.username, entry?.url || fallbackUrl(member.username));
  }
  return result;
}
