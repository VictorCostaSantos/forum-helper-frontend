import { useAvatarsMap } from '../../shared/avatars/avatarStore';

/*
  Thin wrapper sobre o avatarStore central. Mantém a API antiga
  (`Map<username, url>`) pra os consumers existentes não quebrarem.

  Toda a lógica de fetch/retry/sticky-cache vive no store agora —
  qualquer componente do app pode chamar `useAvatar(username)` ou
  `useAvatarsMap()` direto e compartilhar o mesmo cache.
*/
export function useTeamAvatars() {
  return useAvatarsMap();
}
