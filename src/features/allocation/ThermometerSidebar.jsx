import React from 'react';
import UserAvatar from '../../shared/components/UserAvatar';
import { DEFAULT_MAX_LOAD, LOAD_THRESHOLDS, TEAM, avatarFallbackUrl } from './team';

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

      {/* Card "Como funciona" — explica peso e faixas pra que a pessoa
          consiga planejar (ex: "2 altas + 1 baixa = 7pts, ainda saudável"). */}
      <div className="alloc-thermometer__legend">
        <div className="alloc-thermometer__legend-head">
          <i className="fa-regular fa-circle-question"></i>
          Como funciona
        </div>
        <ul className="alloc-thermometer__legend-pesos">
          <li>
            <span className="alloc-thermometer__legend-dot alloc-thermometer__legend-dot--p1" />
            <span className="alloc-thermometer__legend-name">Baixa</span>
            <span className="alloc-thermometer__legend-pts">1 pt</span>
          </li>
          <li>
            <span className="alloc-thermometer__legend-dot alloc-thermometer__legend-dot--p2" />
            <span className="alloc-thermometer__legend-name">Média</span>
            <span className="alloc-thermometer__legend-pts">2 pts</span>
          </li>
          <li>
            <span className="alloc-thermometer__legend-dot alloc-thermometer__legend-dot--p3" />
            <span className="alloc-thermometer__legend-name">Alta</span>
            <span className="alloc-thermometer__legend-pts">3 pts</span>
          </li>
        </ul>
        <div className="alloc-thermometer__legend-bar">
          <span className="alloc-thermometer__legend-seg alloc-thermometer__legend-seg--ok" style={{ flex: LOAD_THRESHOLDS.light.max }}>
            <span>leve</span>
            <small>&lt;{LOAD_THRESHOLDS.light.max + 1}</small>
          </span>
          <span className="alloc-thermometer__legend-seg alloc-thermometer__legend-seg--warn" style={{ flex: LOAD_THRESHOLDS.healthy.max - LOAD_THRESHOLDS.light.max }}>
            <span>saudável</span>
            <small>{LOAD_THRESHOLDS.light.max + 1}–{LOAD_THRESHOLDS.healthy.max}</small>
          </span>
          <span className="alloc-thermometer__legend-seg alloc-thermometer__legend-seg--danger" style={{ flex: LOAD_THRESHOLDS.heavy.max - LOAD_THRESHOLDS.healthy.max }}>
            <span>alta</span>
            <small>{LOAD_THRESHOLDS.healthy.max + 1}–{LOAD_THRESHOLDS.heavy.max}</small>
          </span>
        </div>
        <div className="alloc-thermometer__legend-foot">
          Limite saudável: <b>{DEFAULT_MAX_LOAD} pts</b> · acima de {LOAD_THRESHOLDS.heavy.max} é <b>sobrecarga</b>
        </div>
      </div>
    </aside>
  );
}

export default ThermometerSidebar;
