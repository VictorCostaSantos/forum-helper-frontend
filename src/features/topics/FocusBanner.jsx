import React from 'react';
import { CATEGORY_BUTTONS } from './helpers';

function getCategoryButton(name) {
  return CATEGORY_BUTTONS.find((b) => b.category === name) || null;
}

function FocusBanner({ focus, onApply, onDismiss }) {
  if (!focus || !focus.title) return null;
  const canApply = Array.isArray(focus.recommended)
    && focus.recommended.length > 0
    && focus.kind !== 'success';

  const button = getCategoryButton(focus.targetCategory);
  const categoryClass = button?.cssClass || '';
  const categoryIconHref = button?.file
    ? `/assets/categorias/alura-categorias.svg#icon-categorias-${button.file}`
    : null;

  return (
    <div className={`focus-banner focus-banner--${focus.kind}`} role="status">
      {categoryIconHref ? (
        <div className={`focus-banner__category ${categoryClass}`} aria-hidden="true">
          <svg className="focus-banner__category-img">
            <use xlinkHref={categoryIconHref} />
          </svg>
        </div>
      ) : null}

      <div className="focus-banner__main">
        <strong className="focus-banner__title">{focus.title}</strong>
        {focus.subtitle ? (
          <span className="focus-banner__subtitle">{focus.subtitle}</span>
        ) : null}
        {focus.stats?.length > 0 ? (
          <div className="focus-banner__stats">
            {focus.stats.map((stat, idx) => (
              <span
                key={`${stat.label}-${idx}`}
                className={`focus-banner__stat${stat.tone ? ` is-${stat.tone}` : ''}`}
              >
                <strong className="focus-banner__stat-value">{stat.value}</strong>
                <span className="focus-banner__stat-label">{stat.label}</span>
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="focus-banner__actions">
        {canApply ? (
          <button
            type="button"
            className="focus-banner__btn focus-banner__btn--primary"
            onClick={onApply}
          >
            <span>Focar em {focus.targetCategory}</span>
            <i className="fa-solid fa-arrow-right" aria-hidden="true"></i>
          </button>
        ) : null}
        <button
          type="button"
          className="focus-banner__btn focus-banner__btn--ghost"
          onClick={onDismiss}
          aria-label="Dispensar sugestão"
          title="Dispensar"
        >
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>
    </div>
  );
}

export default FocusBanner;
