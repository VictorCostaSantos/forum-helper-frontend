import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { detectBrand } from './eventBrands';

const SESSION_DISMISSED_KEY = 'fhEventsBannerDismissed';
const MS_PER_DAY = 24 * 3600 * 1000;

// Janela de visibilidade do banner. Quando o evento mais próximo é dispensado,
// o card "atravessa" pro próximo dentro dessa janela — então 60d cobre 2 meses
// e garante que sempre tem algo relevante na tela. Eventos mais distantes ficam
// fora — a info ainda chega pelos alertas escalonados do sininho (14d/7d/1d).
const VISIBILITY_HORIZON_DAYS = 60;

function loadDismissedFromSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_DISMISSED_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function saveDismissedToSession(set) {
  try {
    sessionStorage.setItem(SESSION_DISMISSED_KEY, JSON.stringify([...set]));
  } catch {
    // sessionStorage cheio/desabilitado — silencia.
  }
}

function formatDateBr(ms) {
  if (!ms) return '';
  const d = new Date(Number(ms));
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function getDaysCopy(daysAway) {
  if (daysAway < 1) return 'em menos de 24h';
  const wholeDays = Math.floor(daysAway);
  if (wholeDays === 0) return 'amanhã';
  if (wholeDays === 1) return 'em 1 dia';
  return `em ${wholeDays} dias`;
}

// Copy do evento "agora": preferimos rotular como EVENTO AGORA (mais claro
// pra quem pega o sistema na ativa do que "AO VIVO" — não é um vídeo). Se
// tiver due_date real, mostra o tempo restante.
function getLiveCopy(endMs) {
  if (!endMs) return 'EVENTO AGORA';
  const now = Date.now();
  const remainingMin = Math.round((endMs - now) / 60000);
  if (remainingMin <= 0) return 'EVENTO AGORA';
  if (remainingMin < 60) return `EVENTO AGORA · termina em ${remainingMin}min`;
  const hours = Math.round(remainingMin / 60);
  return `EVENTO AGORA · termina em ${hours}h`;
}

// Title do evento geralmente vem como "Curso Santander: Imersão Digital 2026".
// O exemplo aplica cor da marca na parte DEPOIS do colon, em nova linha.
// Se não tiver colon, mostra o título inteiro em cor padrão.
function renderEventTitle(name) {
  const colonIdx = name.indexOf(':');
  if (colonIdx === -1) {
    return <h1 className="events-banner__title">{name}</h1>;
  }
  const before = name.slice(0, colonIdx + 1);
  const after = name.slice(colonIdx + 1).trim();
  return (
    <h1 className="events-banner__title">
      {before}
      <br />
      <span>{after}</span>
    </h1>
  );
}

function EventsBanner({ events = [] }) {
  const [dismissed, setDismissed] = useState(loadDismissedFromSession);

  // Limpa todos os dismisses persistidos quando ?clearDismiss=1 está na URL.
  // Útil pra desbloquear eventos que foram dispensados em sessões anteriores
  // e não estão reaparecendo.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('clearDismiss') === '1') {
      try {
        sessionStorage.removeItem(SESSION_DISMISSED_KEY);
      } catch {
        // silencia
      }
      setDismissed(new Set());
    }
  }, []);

  const visible = useMemo(() => {
    const now = Date.now();
    const horizonMs = now + VISIBILITY_HORIZON_DAYS * MS_PER_DAY;
    return events
      .filter((e) => e?.id && !dismissed.has(e.id))
      .filter((e) => e.startMs && (e.isLive || (e.startMs > now && e.startMs <= horizonMs)))
      // Eventos ao vivo sobem pro topo. Em seguida, ordem cronológica de início.
      .sort((a, b) => {
        if (a.isLive && !b.isLive) return -1;
        if (!a.isLive && b.isLive) return 1;
        return a.startMs - b.startMs;
      });
  }, [events, dismissed]);

  const dismiss = useCallback((id) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveDismissedToSession(next);
      return next;
    });
  }, []);

  if (visible.length === 0) return null;

  const top = visible[0];
  const brand = detectBrand(top.name);
  const daysAway = (top.startMs - Date.now()) / MS_PER_DAY;

  const tagText = top.isLive
    ? getLiveCopy(top.endMs)
    : getDaysCopy(daysAway).toUpperCase();

  return (
    <article className={`events-banner events-banner--theme-${brand.key} ${top.isLive ? 'is-live' : ''}`}>
      {/* Glass effect overlay — backdrop-filter blur funde os blobs em luz suave */}
      <div className="events-banner__glass" aria-hidden="true"></div>

      <div className="events-banner__content">
        <div className="events-banner__text">
          <span className="events-banner__tag">
            {top.isLive ? <span className="events-banner__live-dot" aria-hidden="true"></span> : null}
            {tagText}
          </span>
          {renderEventTitle(top.name)}
          <p className="events-banner__subtitle">
            {top.isLive ? 'Acontecendo agora · ' : ''}
            {formatDateBr(top.startMs)}
            {brand.name ? ` · ${brand.name}` : ''}
          </p>
          {top.isLive ? (
            <span className="events-banner__live-hint">
              <i className="fa-solid fa-circle-info"></i>
              Quem chegou agora — esse evento já começou. Não perca.
            </span>
          ) : null}
          {top.url ? (
            <a
              href={top.url}
              target="_blank"
              rel="noreferrer"
              className="events-banner__btn"
            >
              Ir para a tarefa <span aria-hidden="true">&rarr;</span>
            </a>
          ) : null}
        </div>

        <div className="events-banner__visual">
          {brand.logo ? (
            <img
              src={brand.logo}
              alt=""
              className="events-banner__logo"
              aria-hidden="true"
            />
          ) : (
            // Sem logo (Alura, Default): mostra o nome da marca em texto estilizado grande
            <span className="events-banner__logo-text" aria-hidden="true">
              {brand.name?.toLowerCase() || 'evento'}
            </span>
          )}
        </div>
      </div>

      {/* 4 blobs coloridos — backdrop-filter do glass-effect transforma eles
          em luzes suaves de fundo. Posições e cores vêm do CSS por tema. */}
      <div className="events-banner__blob events-banner__blob--1" aria-hidden="true"></div>
      <div className="events-banner__blob events-banner__blob--2" aria-hidden="true"></div>
      <div className="events-banner__blob events-banner__blob--3" aria-hidden="true"></div>
      <div className="events-banner__blob events-banner__blob--4" aria-hidden="true"></div>

      <button
        type="button"
        className="events-banner__dismiss"
        onClick={() => dismiss(top.id)}
        aria-label="Dispensar até a próxima sessão"
        title="Dispensar"
      >
        <i className="fa-solid fa-xmark"></i>
      </button>
    </article>
  );
}

export default EventsBanner;
