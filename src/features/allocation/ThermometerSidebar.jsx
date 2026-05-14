import React from 'react';
import UserAvatar from '../../shared/components/UserAvatar';
import { TEAM, avatarFallbackUrl } from './team';

function ThermometerRow({ m, focusUser, onClick, avatarsMap }) {
  const isFocused = focusUser === m.username;
  const isDimmed  = Boolean(focusUser) && !isFocused;
  return (
    <li
      className={[
        'alloc-thermometer__row',
        isFocused ? 'is-focused' : '',
        isDimmed ? 'is-dimmed' : '',
      ].filter(Boolean).join(' ')}
      data-tone={m.tone}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      title={isFocused ? 'Clique pra remover filtro' : `Filtrar pelo ${m.displayName}`}
    >
      <div className="alloc-thermometer__info">
        <UserAvatar
          name={m.displayName}
          src={avatarsMap?.get?.(m.username) || avatarFallbackUrl(m.username)}
          size={24}
          cacheKey={m.username}
          className="alloc-thermometer__avatar"
        />
        <span className="alloc-thermometer__name">{m.displayName.split(' ')[0]}</span>
        <span className={`alloc-thermometer__score alloc-thermometer__score--${m.tone}`}>
          {m.pct}%
        </span>
      </div>
      <div className="alloc-thermometer__bar">
        <div
          className={`alloc-thermometer__fill alloc-thermometer__fill--${m.tone}`}
          style={{ width: `${Math.min(100, m.pct)}%` }}
        />
      </div>
    </li>
  );
}

/*
  Termômetro lateral — uma barra de progresso por pessoa do time.

  Carga = soma de pesos das estações em que a pessoa está no currentShift,
  expressa em % do maxLoad. Cor segue o tone:
   - ok     (<60%)  → verde
   - warn   (60-89) → âmbar
   - danger (>=90)  → vermelho com glow

  Click no row → ativa filtro por pessoa (foca estações onde a pessoa está).
  Click de novo no mesmo row → desliga o filtro.
*/
function ThermometerSidebar({ loadByUser, avatarsMap = null, focusUser = null, onFocusUser }) {
  const rows = TEAM
    .map((m) => {
      const data = loadByUser?.get(m.username) || { points: 0, pct: 0, tone: 'ok' };
      return { ...m, ...data };
    })
    .sort((a, b) => b.pct - a.pct);

  const toggleFocus = (username) => {
    onFocusUser?.(focusUser === username ? null : username);
  };

  return (
    <aside className="alloc-thermometer" aria-label="Carga da equipe">
      <header className="alloc-thermometer__head">
        <i className="fa-solid fa-battery-three-quarters"></i>
        <span>Carga da Equipe</span>
        {focusUser ? (
          <button
            type="button"
            className="alloc-thermometer__clear"
            onClick={() => onFocusUser?.(null)}
            title="Limpar filtro"
            aria-label="Limpar filtro"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        ) : null}
      </header>

      <ul className="alloc-thermometer__list">
        {rows.map((m) => (
          <ThermometerRow
            key={m.username}
            m={m}
            focusUser={focusUser}
            avatarsMap={avatarsMap}
            onClick={() => toggleFocus(m.username)}
          />
        ))}
      </ul>
    </aside>
  );
}

export default ThermometerSidebar;
