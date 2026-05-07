import React, { useEffect, useRef, useState } from 'react';

// Texto editável estilo Notion: renderiza como texto normal, click vira
// input/textarea, sai do foco salva. Sem botões, sem "modo edição global".
// Hover revela um fundo sutil indicando que é clicável.

function InlineEdit({
  value,
  onChange,
  multiline = false,
  placeholder = '',
  className = '',
  as = 'span',
  rows = 2,
  autoFocus = false,
}) {
  const [editing, setEditing] = useState(autoFocus);
  const [draft, setDraft] = useState(value);
  const ref = useRef(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      // Cursor no fim em vez de selecionar tudo — mais natural pra continuar
      // de onde parou.
      const len = ref.current.value.length;
      ref.current.setSelectionRange(len, len);
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft !== value) onChange(draft);
  };

  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  if (editing) {
    const Field = multiline ? 'textarea' : 'input';
    return (
      <Field
        ref={ref}
        type={multiline ? undefined : 'text'}
        rows={multiline ? rows : undefined}
        className={`inline-edit__field ${multiline ? 'inline-edit__field--multi' : ''} ${className}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !multiline) {
            e.preventDefault();
            commit();
          } else if (e.key === 'Enter' && multiline && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            commit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            cancel();
          }
        }}
        placeholder={placeholder}
      />
    );
  }

  const Tag = as;
  const empty = !value;
  return (
    <Tag
      className={`inline-edit ${empty ? 'is-empty' : ''} ${className}`}
      onClick={() => setEditing(true)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setEditing(true);
        }
      }}
      tabIndex={0}
      role="textbox"
    >
      {empty ? placeholder : value}
    </Tag>
  );
}

export default InlineEdit;
