import React, { useEffect, useRef, useState } from 'react';

// Campo editável inline. Quando `editing` é false, mostra o texto como
// `<as>` (h1, h2, p, etc.). Quando `editing` é true, vira input/textarea.
// Salva on blur ou Enter, cancela com Escape, restaurando o valor anterior.
//
// O componente é "controlled by edit mode externo" (props `editing`) pra que
// o pai possa toggar tudo de uma vez (modo edição global) — sem hover/double-
// click confuso. Quando edição global está OFF, o componente só renderiza
// o texto normalmente.

function EditableText({
  value,
  onChange,
  editing,
  multiline = false,
  placeholder = '',
  className = '',
  as = 'span',
  rows = 2,
}) {
  const [draft, setDraft] = useState(value);
  const ref = useRef(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  // Foco automático quando entra em modo edição.
  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      ref.current.select();
    }
  }, [editing]);

  if (!editing) {
    const Tag = as;
    return <Tag className={className}>{value || <span className="editable-empty">{placeholder || '—'}</span>}</Tag>;
  }

  const commit = () => {
    if (draft !== value) onChange(draft);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !multiline) {
      e.preventDefault();
      commit();
      ref.current?.blur();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setDraft(value);
      ref.current?.blur();
    }
  };

  if (multiline) {
    return (
      <textarea
        ref={ref}
        rows={rows}
        className={`editable editable--textarea ${className}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
      />
    );
  }

  return (
    <input
      ref={ref}
      type="text"
      className={`editable editable--input ${className}`}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
    />
  );
}

export default EditableText;
