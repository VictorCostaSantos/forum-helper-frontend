import React, { useEffect, useRef, useState } from 'react';
import { marked } from 'marked';

// Editor de anotação com renderização Markdown estilo Notion:
// - Quando vazio: mostra um botão "+ Adicionar anotações" sutil.
// - Quando tem conteúdo: renderiza markdown (h1, listas, bold, etc.).
// - Click no conteúdo (ou no botão "Editar") → vira textarea pra edição.
// - Blur ou Ctrl/Cmd+Enter → salva. Esc → descarta.
//
// Usa `marked` que já está no projeto. GFM ligado pra suporte a checkbox,
// tabela, autolink. `breaks: true` faz \n virar <br> (mais Notion-like, onde
// quebrar linha não exige linha em branco).
//
// Segurança: o conteúdo é local (single-tenant — cada usuário no próprio
// localStorage), e a única pessoa que digita é o próprio dono. Não há
// risco de XSS de outro usuário. Mesmo assim, evitamos injeção HTML inline
// via configuração da `marked`.

marked.setOptions({
  gfm: true,
  breaks: true,
  // mangle/headerIds removidos pra evitar warnings com versões mais novas.
});

function MarkdownNote({ value, onChange, placeholder = 'Adicionar anotações…' }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  const ref = useRef(null);

  useEffect(() => {
    if (!editing) setDraft(value || '');
  }, [value, editing]);

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      const len = ref.current.value.length;
      ref.current.setSelectionRange(len, len);
    }
  }, [editing]);

  const commit = () => {
    if (draft !== value) onChange(draft);
    setEditing(false);
  };

  const cancel = () => {
    setDraft(value || '');
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="md-note md-note--editing">
        <textarea
          ref={ref}
          className="md-note__textarea"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { e.preventDefault(); cancel(); }
            else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              commit();
            }
          }}
          placeholder="Use markdown: **negrito**, *itálico*, # título, - lista, [link](url), - [ ] checkbox…"
          rows={Math.max(4, draft.split('\n').length + 1)}
        />
        <div className="md-note__hint">
          <span><kbd>Esc</kbd> cancela</span>
          <span><kbd>⌘/Ctrl</kbd>+<kbd>Enter</kbd> salva</span>
        </div>
      </div>
    );
  }

  if (!value) {
    return (
      <button
        type="button"
        className="md-note md-note--empty"
        onClick={() => setEditing(true)}
      >
        <i className="fa-solid fa-pen-to-square"></i>
        {placeholder}
      </button>
    );
  }

  return (
    <div className="md-note">
      <div
        className="md-note__rendered"
        onClick={() => setEditing(true)}
        title="Clique pra editar"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: marked.parse(value) }}
      />
      <button
        type="button"
        className="md-note__edit-btn"
        onClick={() => setEditing(true)}
        aria-label="Editar anotação"
        title="Editar"
      >
        <i className="fa-solid fa-pen"></i>
      </button>
    </div>
  );
}

export default MarkdownNote;
