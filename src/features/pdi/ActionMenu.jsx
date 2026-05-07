import React, { useEffect, useRef, useState } from 'react';

// Dropdown de ações estilo "..." do Notion. Aparece como botão discreto
// (geralmente revelado no hover do pai), e abre uma listinha de items.
// Cada item: { label, icon, onClick, danger? }. Separadores com `divider: true`.

function ActionMenu({ items, label = 'Mais ações', size = 'md' }) {
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

  return (
    <div className={`action-menu action-menu--${size}`} ref={ref}>
      <button
        type="button"
        className={`action-menu__trigger ${open ? 'is-open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
      >
        <i className="fa-solid fa-ellipsis"></i>
      </button>

      {open ? (
        <div className="action-menu__pop" role="menu">
          {items.map((item, i) => {
            if (item.divider) {
              return <div key={`d-${i}`} className="action-menu__divider" role="separator" />;
            }
            return (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                className={`action-menu__item ${item.danger ? 'is-danger' : ''}`}
                onClick={() => {
                  setOpen(false);
                  item.onClick?.();
                }}
                disabled={item.disabled}
              >
                {item.icon ? <i className={`fa-solid ${item.icon}`}></i> : null}
                <span>{item.label}</span>
                {item.shortcut ? <kbd>{item.shortcut}</kbd> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default ActionMenu;
