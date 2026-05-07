import React, { useEffect, useRef, useState } from 'react';
import { GROUP_ICONS, GROUP_ACCENTS } from './pdiData';

// Popover compacto pra customizar ícone + cor de UM grupo. Aberto via clique
// no ícone do grupo. Fechado por padrão pra não poluir a tela.
//
// Visual: sem labels gritantes "ÍCONE / COR" — só os grids dos pickers, com
// um divider sutil entre eles. Ícone ativo destaca com a cor escolhida no
// próprio popover (ao invés de uma cor primária genérica).

function GroupCustomizer({ icon, accent, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onEsc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const accentColor = GROUP_ACCENTS.find((a) => a.id === accent)?.color || 'var(--cor-default)';

  return (
    <div className="gcust" ref={ref}>
      <button
        type="button"
        className={`gcust__trigger ${open ? 'is-open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        title="Mudar ícone e cor"
        aria-label="Mudar ícone e cor do grupo"
      >
        <i className={`fa-solid ${icon}`}></i>
      </button>

      {open ? (
        <div className="gcust__pop" style={{ '--accent': accentColor }}>
          <div className="gcust__icons">
            {GROUP_ICONS.map((ic) => (
              <button
                key={ic}
                type="button"
                className={`gcust__icon ${ic === icon ? 'is-active' : ''}`}
                onClick={() => onChange({ icon: ic })}
                title={ic}
              >
                <i className={`fa-solid ${ic}`}></i>
              </button>
            ))}
          </div>

          <div className="gcust__divider" />

          <div className="gcust__colors">
            {GROUP_ACCENTS.map((a) => (
              <button
                key={a.id}
                type="button"
                className={`gcust__color ${a.id === accent ? 'is-active' : ''}`}
                onClick={() => onChange({ accent: a.id })}
                style={{ '--swatch-color': a.color }}
                title={a.label}
                aria-label={a.label}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default GroupCustomizer;
