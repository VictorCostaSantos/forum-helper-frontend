import React from 'react';

/*
  Glyph do ClickUp em uma única cor sóbria. Herda `currentColor` pra
  responder ao tema (light/dark) — o parent decide o tom. Mantém a forma
  identificável da marca (chevron + curva) sem usar os gradientes
  multi-cor que ficavam "carnavalescos" no contexto do app.
*/
function ClickupIcon({ className, title }) {
  return (
    <svg
      viewBox="0 0 130 155"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      fill="currentColor"
    >
      <path d="M.4 119.12l23.81-18.24C36.86 117.39 50.3 125 65.26 125c14.88 0 27.94-7.52 40.02-23.9l24.15 17.8C112 142.52 90.34 155 65.26 155c-25 0-46.87-12.4-64.86-35.88z" />
      <path d="M65.18 39.84L22.8 76.36 3.21 53.64 65.27.16l61.57 53.52-19.68 22.64z" />
    </svg>
  );
}

export default ClickupIcon;
