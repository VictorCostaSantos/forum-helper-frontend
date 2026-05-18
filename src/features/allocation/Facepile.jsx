import React, { useState } from 'react';
import UserAvatar from '../../shared/components/UserAvatar';
import AddPersonPopover from './AddPersonPopover';
import {
  avatarFallbackUrl,
  getDisplayName,
  isAdmin,
  isPlaceholder,
} from './team';

/*
  Stack de avatares sobrepostos (-8px margin-left) + botão "+" no fim.

  `usernames` pode conter 2 tipos de strings:
    - Username real (membro do TEAM)
    - `__vago__` placeholder (filtrado, esconde)

  Confirmação de remoção é inline no avatar (segundo click). Pra trocas
  mais finas (em massa), usar o popover do botão +.
*/
function Facepile({
  usernames = [],
  onTogglePerson,
  variant = 'current',
  canManage = true,
  emptyLabel = null,
  avatarsMap = null,
  highlightedUser = null,
  loadByUser = null,
  stationsByUser = null,
  currentUsername = '',
}) {
  // Placeholders são ignorados (representam "card vazio" — sem avatar).
  // Ordenação alfabética por displayName pra não parecer que sempre são
  // "as mesmas pessoas primeiro" — a ordem do array no backend reflete a
  // ordem de adição, mas visualmente queremos imparcialidade.
  const realUsernames = usernames
    .filter((u) => !isPlaceholder(u))
    .slice()
    .sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b), 'pt-BR'));

  const userIsAdmin = isAdmin(currentUsername);
  const userIsCurrentlyIn = realUsernames.includes(currentUsername);
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

      {/* Avatares reais (membros alocados de fato) */}
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

      {/* Botão "+/sair" — comportamento muda conforme contexto:
          - Admin: abre popover de gestão (qualquer estado).
          - Não-admin alocado: vira "sair".
          - Não-admin fora: vira "entrar". */}
      {canManage && variant === 'current' ? (
        <div className="alloc-facepile__add-wrap">
          <button
            type="button"
            className={`alloc-facepile__add ${popoverOpen ? 'is-open' : ''} ${
              !userIsAdmin && userIsCurrentlyIn ? 'is-self-in' : ''
            }`}
            onClick={(e) => {
              e.stopPropagation();
              if (!userIsAdmin && currentUsername) {
                onTogglePerson?.(currentUsername);
                return;
              }
              setPopoverOpen((v) => !v);
            }}
            aria-label={
              !userIsAdmin
                ? (userIsCurrentlyIn ? 'Sair da atividade' : 'Entrar na atividade')
                : 'Adicionar pessoa'
            }
            aria-expanded={userIsAdmin ? popoverOpen : undefined}
            title={
              !userIsAdmin
                ? (userIsCurrentlyIn ? 'Sair da atividade' : 'Entrar na atividade')
                : 'Adicionar pessoa'
            }
          >
            <i className={
              !userIsAdmin && userIsCurrentlyIn
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
