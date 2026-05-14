import React, { useState } from 'react';
import UserAvatar from '../../shared/components/UserAvatar';
import AddPersonPopover from './AddPersonPopover';
import { avatarFallbackUrl, getDisplayName, isAdmin, isPlaceholder } from './team';

/*
  Stack de avatares sobrepostos (-8px margin-left) + botão "+" no fim.

  - `usernames`: lista de quem está alocado nessa instância
  - `onTogglePerson`: handler chamado com username quando o usuário marca/desmarca
                     no popover OU clica em um avatar pra remover.
  - `variant`: "current" (32px, colorido) ou "next" (24px, grayscale + opaco)
  - `canManage`: se false, esconde botão + e desativa click nos avatares

  Confirmação de remoção é inline no avatar (segundo click). Pra trocas mais
  finas (em massa), usar o popover do botão +.
*/
function Facepile({
  usernames = [],
  onTogglePerson,
  variant = 'current',
  canManage = true,
  emptyLabel = null,
  avatarsMap = null,         // Map<username, url> preloaded (backend ou fallback)
  highlightedUser = null,    // quando setado, esmaece TODOS os outros
  loadByUser = null,         // passa pro popover pra mostrar alerta de carga
  stationsByUser = null,     // pro tooltip rico do avatar
  currentUsername = '',      // pra restringir remoção a si mesmo (não-admin)
}) {
  // Filtra placeholder "vago" — internamente representa "card vazio".
  const realUsernames = usernames.filter((u) => !isPlaceholder(u));
  const userIsAdmin = isAdmin(currentUsername);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [confirmingUser, setConfirmingUser] = useState(null);
  const size = variant === 'next' ? 24 : 32;

  const PESO_LABEL = { 1: 'baixa', 2: 'média', 3: 'alta' };
  const buildTooltip = (username) => {
    const name = getDisplayName(username);
    const load = loadByUser?.get?.(username);
    const sts  = stationsByUser?.get?.(username) || [];
    const lines = [name];
    if (load) {
      lines.push(`Carga: ${load.pct}% · ${load.points} pontos`);
    }
    if (sts.length > 0) {
      lines.push('—');
      for (const st of sts) {
        const p = Number(st.currentShift?.peso) || 0;
        lines.push(`${st.name} (${PESO_LABEL[p] || '?'})`);
      }
    }
    return lines.join('\n');
  };

  // Não-admin só consegue remover ele mesmo. Admin pode remover qualquer um.
  const canRemove = (username) => userIsAdmin || username === currentUsername;

  const handleAvatarClick = async (e, username) => {
    e.stopPropagation();
    if (!canManage || !canRemove(username)) return;
    if (confirmingUser === username) {
      setConfirmingUser(null);
      try {
        await onTogglePerson?.(username);
      } catch (err) {
        // Backend pode rejeitar (ex: validate "min 1 responsável"). Mostra
        // a mensagem mais útil que conseguir extrair.
        const data = err?.response?.data;
        const msg = (Array.isArray(data?.detalhes) && data.detalhes[0])
          || data?.erro
          || data?.message
          || err?.message
          || 'Erro ao remover.';
        window.__showToast?.(msg, 'error');
      }
      return;
    }
    setConfirmingUser(username);
    // Reset depois de 2.5s sem confirmar.
    setTimeout(() => setConfirmingUser((u) => (u === username ? null : u)), 2500);
  };

  if (realUsernames.length === 0 && !canManage) {
    return <span className="alloc-facepile__empty">{emptyLabel || '—'}</span>;
  }

  return (
    <div className={`alloc-facepile alloc-facepile--${variant}`}>
      {realUsernames.length === 0 && canManage ? (
        <span className="alloc-facepile__empty">Vago</span>
      ) : null}
      {realUsernames.map((u) => {
        const isHighlighted = highlightedUser === u;
        const isDimmedOther = Boolean(highlightedUser) && !isHighlighted;
        return (
          <button
            key={u}
            type="button"
            className={[
              'alloc-facepile__btn',
              confirmingUser === u ? 'is-confirming' : '',
              isHighlighted ? 'is-highlighted' : '',
              isDimmedOther ? 'is-dimmed' : '',
            ].filter(Boolean).join(' ')}
            onClick={(e) => handleAvatarClick(e, u)}
            disabled={!canManage}
            data-tooltip={confirmingUser === u ? null : buildTooltip(u)}
            title={confirmingUser === u
              ? `Click pra confirmar remoção de ${getDisplayName(u)}`
              : null}
          >
            <UserAvatar
              name={getDisplayName(u)}
              src={avatarsMap?.get?.(u) || avatarFallbackUrl(u)}
              size={size}
              cacheKey={u}
              className="alloc-facepile__img"
            />
            {confirmingUser === u ? (
              <span className="alloc-facepile__remove" aria-hidden="true">
                <i className="fa-solid fa-xmark"></i>
              </span>
            ) : null}
          </button>
        );
      })}

      {canManage && variant === 'current' ? (
        <div className="alloc-facepile__add-wrap">
          <button
            type="button"
            className={`alloc-facepile__add ${popoverOpen ? 'is-open' : ''} ${
              !userIsAdmin && realUsernames.includes(currentUsername) ? 'is-self-in' : ''
            }`}
            onClick={(e) => {
              e.stopPropagation();
              // Não-admin: 1 clique = entra/sai direto (sem popover).
              if (!userIsAdmin && currentUsername) {
                onTogglePerson?.(currentUsername);
                return;
              }
              // Admin: abre o popover pra escolher quem adicionar/remover.
              setPopoverOpen((v) => !v);
            }}
            aria-label={
              !userIsAdmin
                ? (realUsernames.includes(currentUsername) ? 'Sair da atividade' : 'Entrar na atividade')
                : 'Adicionar pessoa'
            }
            aria-expanded={userIsAdmin ? popoverOpen : undefined}
            title={
              !userIsAdmin
                ? (realUsernames.includes(currentUsername) ? 'Sair da atividade' : 'Entrar na atividade')
                : 'Adicionar pessoa'
            }
          >
            <i className={
              !userIsAdmin && realUsernames.includes(currentUsername)
                ? 'fa-solid fa-arrow-right-from-bracket'
                : 'fa-solid fa-plus'
            }></i>
          </button>
          {userIsAdmin ? (
            <AddPersonPopover
              open={popoverOpen}
              currentSelection={realUsernames}
              loadByUser={loadByUser}
              avatarsMap={avatarsMap}
              currentUsername={currentUsername}
              onToggle={(u) => onTogglePerson?.(u)}
              onClose={() => setPopoverOpen(false)}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default Facepile;
