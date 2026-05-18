import React, { useEffect, useRef } from 'react';
import UserAvatar from '../../shared/components/UserAvatar';
import { TEAM, avatarFallbackUrl, isAdmin } from './team';

/*
  Popover ancorado no botão "+" de um ActivityCard.
  Lista o time do team.js; quem já está na atividade aparece "check"; click
  alterna (entra/sai). Pra remover via popover, basta clicar de novo no
  item — mesmo padrão de toggle. Fecha em Esc, click fora, blur.

  O posicionamento é simples (position:absolute embaixo do botão).
  Pra não passar limite do viewport em telas pequenas, o CSS limita
  com max-width / max-height.
*/
function AddPersonPopover({ open, currentSelection, onToggle, onClose, loadByUser = null, currentUsername = '', avatarsMap = null }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose?.();
    };
    window.addEventListener('keydown', onKey);
    // Atraso pra evitar fechar no mesmo click que abriu.
    const t = setTimeout(() => window.addEventListener('mousedown', onDocClick), 0);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDocClick);
      clearTimeout(t);
    };
  }, [open, onClose]);

  if (!open) return null;

  const selected = new Set(currentSelection || []);
  const userIsAdmin = isAdmin(currentUsername);

  // Não-admin só vê e pode mexer NA SUA PRÓPRIA entrada. Admin vê todos.
  // Ordem alfabética por displayName — evita "sempre as mesmas pessoas
   // primeiro" na lista. Usa pt-BR pra acentos.
  const visibleTeam = (userIsAdmin
    ? TEAM
    : TEAM.filter((m) => m.username === currentUsername)
  ).slice().sort((a, b) => a.displayName.localeCompare(b.displayName, 'pt-BR'));

  // Sugestor: 2 pessoas com MENOR carga atual, não selecionadas e fora do
  // danger zone. Greedy simples. Se não houver `loadByUser`, não sugere nada.
  const suggested = (() => {
    if (!loadByUser) return new Set();
    const candidates = TEAM
      .filter((m) => !selected.has(m.username))
      .map((m) => ({
        username: m.username,
        pct: loadByUser.get?.(m.username)?.pct ?? 0,
        tone: loadByUser.get?.(m.username)?.tone ?? 'ok',
      }))
      .filter((c) => c.tone !== 'danger')        // ignora sobrecarregados
      .sort((a, b) => a.pct - b.pct);
    return new Set(candidates.slice(0, 2).map((c) => c.username));
  })();

  return (
    <div className="alloc-popover" ref={ref} role="dialog" aria-label="Adicionar pessoa">
      <div className="alloc-popover__head">
        <span className="alloc-popover__title">Quem está nessa?</span>
        <button
          type="button"
          className="alloc-popover__close"
          onClick={onClose}
          aria-label="Fechar"
        >
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>
      {!userIsAdmin && visibleTeam.length === 0 ? (
        <p className="alloc-popover__notice">
          Você não está na lista do time. Fala com um admin.
        </p>
      ) : null}
      <ul className="alloc-popover__list">
        {visibleTeam.map((m) => {
          const checked = selected.has(m.username);
          const isSuggested = suggested.has(m.username);
          return (
            <li key={m.username}>
              <button
                type="button"
                className={`alloc-popover__item ${checked ? 'is-checked' : ''} ${isSuggested ? 'is-suggested' : ''}`}
                onClick={() => onToggle?.(m.username)}
                title={isSuggested ? 'Sugerido: menor carga atual' : undefined}
              >
                <span className="alloc-popover__check" aria-hidden="true">
                  {checked ? <i className="fa-solid fa-check"></i> : null}
                </span>
                <UserAvatar
                  name={m.displayName}
                  src={avatarsMap?.get?.(m.username) || avatarFallbackUrl(m.username)}
                  size={22}
                  cacheKey={m.username}
                  className="alloc-popover__avatar"
                />
                <span className="alloc-popover__name">{m.displayName}</span>
                {isSuggested && !checked ? (
                  <span className="alloc-popover__suggest" title="Sugerido: menor carga">
                    <i className="fa-solid fa-wand-magic-sparkles"></i>
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default AddPersonPopover;
