import { useEffect, useState } from 'react';
import { fetchAvatarFromBackend } from '../../api/apiService';
import { TEAM, getDisplayName } from './team';

/*
  Pré-carrega URLs de avatar pra cada membro do TEAM. Retorna um Map
  { username -> url } populado em duas fases:

   1. Inicial — todos começam com fallback (ui-avatars.com) pra a UI ter
      algo pintado no 1º render.
   2. Após mount — pra cada membro tenta `fetchAvatarFromBackend`. Se vier
      success+url, sobrescreve o fallback com a foto real da Alura. Se vier
      vazio (success:false ou url:null), tenta de novo até MAX_TRIES vezes
      com delay — o backend pode estar fazendo scraping da 1ª vez.

  Importante: as URLs do ui-avatars são tratadas como placeholder pelo
  UserAvatar (ver PLACEHOLDER_PATTERNS), então NÃO são gravadas no sticky
  cache. Nas próximas sessões, sempre tenta a real primeiro.
*/

const MAX_TRIES = 3;
const RETRY_DELAY_MS = 4000;

function fallbackUrl(username) {
  const name = encodeURIComponent(getDisplayName(username) || username);
  return `https://ui-avatars.com/api/?name=${name}&background=random&color=fff&bold=true&format=svg&size=128`;
}

function clearAvatarCache(username) {
  try {
    const key = `alura_avatar_v1_${String(username).toLowerCase().trim()}`;
    localStorage.removeItem(key);
  } catch { /* ignore */ }
}

async function tryFetchReal(username, tryIndex) {
  // Limpa cache antes de cada nova tentativa (exceto a 1ª) pra forçar o
  // backend a chamar a Alura de novo — pode ser que o scraping tenha
  // completado nesse meio tempo.
  if (tryIndex > 0) clearAvatarCache(username);
  try {
    const av = await fetchAvatarFromBackend(username);
    return av?.success && av.url ? av.url : null;
  } catch {
    return null;
  }
}

export function useTeamAvatars() {
  const [avatarsMap, setAvatarsMap] = useState(() => {
    // Inicializa com fallback pra todo mundo — assim o 1º render já tem foto.
    const m = new Map();
    for (const member of TEAM) m.set(member.username, fallbackUrl(member.username));
    return m;
  });

  useEffect(() => {
    let cancelled = false;

    // Pra cada usuário, faz até MAX_TRIES tentativas (com delay) e atualiza
    // o map quando achar foto real. Cada um corre em paralelo.
    const runUser = async (username) => {
      for (let i = 0; i < MAX_TRIES; i++) {
        if (cancelled) return;
        const url = await tryFetchReal(username, i);
        if (cancelled) return;
        if (url) {
          setAvatarsMap((prev) => {
            // Não substitui se já tem URL real igual (evita re-render).
            if (prev.get(username) === url) return prev;
            const next = new Map(prev);
            next.set(username, url);
            return next;
          });
          return; // achou, encerra retries
        }
        if (i < MAX_TRIES - 1) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        }
      }
      // Sem real após N tentativas — fica com fallback (já estava).
    };

    Promise.all(TEAM.map((m) => runUser(m.username)));

    return () => { cancelled = true; };
  }, []);

  return avatarsMap;
}
