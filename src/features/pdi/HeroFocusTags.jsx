import React, { useEffect, useRef, useState } from 'react';

// Tags de foco inline (sem pílulas). Texto + separador "·".
// Cada tag é hover-editável; remove pelo "×" que aparece no hover.
function HeroFocusTags({ tags, onChange }) {
  const [editingIdx, setEditingIdx] = useState(-1);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if ((editingIdx >= 0 || adding) && inputRef.current) {
      inputRef.current.focus();
      const len = inputRef.current.value.length;
      inputRef.current.setSelectionRange(len, len);
    }
  }, [editingIdx, adding]);

  const startEdit = (i) => { setDraft(tags[i] || ''); setEditingIdx(i); setAdding(false); };
  const commitEdit = () => {
    if (editingIdx < 0) return;
    const trimmed = draft.trim();
    const next = [...tags];
    if (trimmed) next[editingIdx] = trimmed;
    else next.splice(editingIdx, 1);
    onChange(next);
    setEditingIdx(-1);
    setDraft('');
  };
  const startAdd = () => { setDraft(''); setAdding(true); setEditingIdx(-1); };
  const commitAdd = () => {
    const trimmed = draft.trim();
    if (trimmed) onChange([...tags, trimmed]);
    setAdding(false);
    setDraft('');
  };
  const cancel = () => { setEditingIdx(-1); setAdding(false); setDraft(''); };
  const remove = (i) => onChange(tags.filter((_, k) => k !== i));

  const inputWidth = (val, min) => `${Math.max(min, val.length + 1)}ch`;

  return (
    <div className="hero__focus">
      <span className="hero__focus-icon" aria-hidden="true">🎯</span>
      <div className="hero__focus-list">
        {tags.length === 0 && !adding ? (
          <button type="button" className="hero__focus-empty" onClick={startAdd}>
            Adicionar foco do momento
          </button>
        ) : null}

        {tags.map((tag, i) => (
          <React.Fragment key={`${i}-${tag}`}>
            {i > 0 ? <span className="hero__focus-sep" aria-hidden="true">·</span> : null}
            {editingIdx === i ? (
              <input
                ref={inputRef}
                className="hero__focus-input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
                  else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
                }}
                style={{ width: inputWidth(draft, 8) }}
              />
            ) : (
              <span className="hero__focus-tag">
                <button
                  type="button"
                  className="hero__focus-tag-text"
                  onClick={() => startEdit(i)}
                  title="Editar foco"
                >
                  {tag}
                </button>
                <button
                  type="button"
                  className="hero__focus-tag-x"
                  onClick={() => remove(i)}
                  aria-label={`Remover ${tag}`}
                  title="Remover"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </span>
            )}
          </React.Fragment>
        ))}

        {adding ? (
          <>
            {tags.length > 0 ? <span className="hero__focus-sep" aria-hidden="true">·</span> : null}
            <input
              ref={inputRef}
              className="hero__focus-input"
              placeholder="Novo foco"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitAdd}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); commitAdd(); }
                else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
              }}
              style={{ width: inputWidth(draft, 10) }}
            />
          </>
        ) : tags.length > 0 ? (
          <button
            type="button"
            className="hero__focus-add"
            onClick={startAdd}
            title="Adicionar foco"
          >
            <i className="fa-solid fa-plus"></i> foco
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default HeroFocusTags;
