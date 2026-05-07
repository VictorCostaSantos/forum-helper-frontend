import React, { useEffect, useRef, useState } from 'react';

// Controle de % sem barra clicável: − [73%] + .
// - Click no número edita inline (input numérico)
// - Botões − e + ajustam de 5 em 5 (Shift+click ajusta de 1 em 1)
// - Barra abaixo é visual, read-only
// - Quando `derived`, tudo fica read-only
//
// Decisão: a "barra clicável" do ProgressBar anterior tinha problema de UX —
// a pessoa clicava sem querer e o valor pulava. Esse controle é mais preciso
// e intencional, no estilo de stepper de input numérico.

const STEP = 5;
const FINE_STEP = 1;

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function PercentControl({ value, onChange, derived = false, done = false }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef(null);

  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [value, editing]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    const parsed = parseInt(draft, 10);
    const next = Number.isFinite(parsed) ? clamp(parsed, 0, 100) : value;
    if (next !== value) onChange(next);
    setEditing(false);
  };

  const cancel = () => {
    setDraft(String(value));
    setEditing(false);
  };

  const adjust = (delta) => {
    onChange(clamp(value + delta, 0, 100));
  };

  return (
    <div className={`pcontrol ${done ? 'is-done' : ''} ${derived ? 'is-derived' : ''}`}>
      <div className="pcontrol__row">
        {!derived ? (
          <button
            type="button"
            className="pcontrol__btn"
            onClick={(e) => adjust(e.shiftKey ? -FINE_STEP : -STEP)}
            disabled={value <= 0}
            aria-label={`Diminuir ${STEP}%`}
            title="Diminuir (Shift = 1%)"
          >
            <i className="fa-solid fa-minus"></i>
          </button>
        ) : null}

        {editing && !derived ? (
          <input
            ref={inputRef}
            type="number"
            min={0}
            max={100}
            className="pcontrol__input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commit(); }
              else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
            }}
          />
        ) : (
          <button
            type="button"
            className="pcontrol__display"
            onClick={() => !derived && setEditing(true)}
            disabled={derived}
            aria-label={`${value}%${derived ? ' (calculado dos cursos vinculados)' : ' — clique pra editar'}`}
            title={derived ? 'Calculado pela média dos cursos vinculados' : 'Clique pra digitar valor exato'}
          >
            {value}%
          </button>
        )}

        {!derived ? (
          <button
            type="button"
            className="pcontrol__btn"
            onClick={(e) => adjust(e.shiftKey ? FINE_STEP : STEP)}
            disabled={value >= 100}
            aria-label={`Aumentar ${STEP}%`}
            title="Aumentar (Shift = 1%)"
          >
            <i className="fa-solid fa-plus"></i>
          </button>
        ) : null}
      </div>

      <div className="pcontrol__bar" aria-hidden="true">
        <div className="pcontrol__bar-fill" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export default PercentControl;
