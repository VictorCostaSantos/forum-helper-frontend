import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BLOCK_PALETTE } from './blockTypes';

// Popover ao estilo Notion: posiciona acima/abaixo do bloco que disparou,
// lista filtrável por digitação (continua capturando teclas mesmo aberto),
// Enter ou click aplica o tipo, Esc fecha.
//
// O SlashMenu é "controlado" pelo BlockEditor: ele decide quando abrir e
// passa a query (texto após o "/"). Aqui só renderiza e capturamos teclas
// quando aberto.

function SlashMenu({ open, anchorRect, query, onSelect, onClose }) {
  const popRef = useRef(null);
  const [highlighted, setHighlighted] = useState(0);

  const filtered = useMemo(() => {
    const q = (query || '').toLowerCase().trim();
    if (!q) return BLOCK_PALETTE;
    return BLOCK_PALETTE.filter((p) =>
      p.label.toLowerCase().includes(q) ||
      p.type.toLowerCase().includes(q),
    );
  }, [query]);

  useEffect(() => {
    setHighlighted(0);
  }, [query]);

  // Captura teclas globais quando aberto (setas, Enter, Esc).
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlighted((h) => Math.max(h - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = filtered[highlighted];
        if (item) onSelect(item.type);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, filtered, highlighted, onSelect, onClose]);

  // Fecha ao clicar fora.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (popRef.current && !popRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, onClose]);

  if (!open || !anchorRect) return null;

  // Posiciona logo abaixo do bloco-âncora; se não cabe na viewport, vai
  // pra cima.
  const POP_HEIGHT_EST = 320;
  const fitsBelow = anchorRect.bottom + POP_HEIGHT_EST < window.innerHeight;
  const top = fitsBelow ? anchorRect.bottom + 6 : anchorRect.top - POP_HEIGHT_EST - 6;
  const left = anchorRect.left;

  return (
    <div
      ref={popRef}
      className="slash-menu"
      style={{ top: `${top}px`, left: `${left}px` }}
      role="listbox"
    >
      <div className="slash-menu__header">
        Bloco {query ? <strong>· "{query}"</strong> : null}
      </div>
      {filtered.length === 0 ? (
        <div className="slash-menu__empty">Nenhum tipo encontrado</div>
      ) : (
        <ul className="slash-menu__list">
          {filtered.map((p, idx) => (
            <li key={p.type}>
              <button
                type="button"
                className={`slash-menu__item ${idx === highlighted ? 'is-active' : ''}`}
                onMouseEnter={() => setHighlighted(idx)}
                onClick={() => onSelect(p.type)}
              >
                <i className={`fa-solid ${p.icon}`}></i>
                <span className="slash-menu__main">
                  <span className="slash-menu__label">{p.label}</span>
                  <span className="slash-menu__hint">{p.hint}</span>
                </span>
                {p.shortcut ? <kbd>{p.shortcut}</kbd> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default SlashMenu;
