import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { BLOCK, BLOCK_PALETTE, blockCanHaveCourses } from './blockTypes';
import {
  RECURRING_FREQUENCIES,
  isCompletedThisPeriod,
  calculateStreak,
  toggleRecurringForToday,
} from './taskHelpers';
import PercentControl from './PercentControl';
import CourseLinker from './CourseLinker';
import MarkdownNote from './MarkdownNote';
import ActionMenu from './ActionMenu';

// Bloco do editor estilo Notion. O componente renderiza por tipo:
// - paragraph, heading-2, heading-3, bullet, quote → input/textarea editável
// - checkbox, percent, recurring → controle dedicado + título editável
// - divider → linha horizontal
//
// Cada bloco expõe via ref os métodos `focus()` e `getEditableEl()` pro
// BlockEditor poder gerenciar o cursor (Enter cria bloco abaixo, Backspace
// em vazio deleta e foca no anterior, etc.).
//
// Os "modos extras" (vincular cursos / anotação) ficam num drawer abaixo
// que abre via ⋯ menu — só pra blocos que suportam.

const PLACEHOLDERS = {
  [BLOCK.PARAGRAPH]: "Pressione '/' para comandos",
  [BLOCK.HEADING_2]: 'Título de seção',
  [BLOCK.HEADING_3]: 'Subtítulo',
  [BLOCK.BULLET]: 'Item da lista',
  [BLOCK.CHECKBOX]: 'To-do',
  [BLOCK.PERCENT]: 'Tarefa com %',
  [BLOCK.RECURRING]: 'Hábito recorrente',
  [BLOCK.QUOTE]: 'Citação',
  [BLOCK.DIVIDER]: '',
};

// Componente do editor "leaf" — usa <input type="text"> pra heading/single-line
// e <textarea> pra paragraph que pode ter multiplas linhas. Pra simplificar,
// SEMPRE usa <textarea> com auto-resize. Suporta Enter pra novo bloco
// (capturado pelo onKeyDown do pai).
const EditableLeaf = forwardRef(function EditableLeaf({
  value,
  onChange,
  onKeyDown,
  placeholder,
  className,
  multiline = true,
  isEmpty,
}, ref) {
  const taRef = useRef(null);

  useImperativeHandle(ref, () => ({
    focus: (cursorPos = 'end') => {
      const el = taRef.current;
      if (!el) return;
      el.focus();
      if (cursorPos === 'end') {
        const len = el.value.length;
        el.setSelectionRange(len, len);
      } else if (cursorPos === 'start') {
        el.setSelectionRange(0, 0);
      } else if (typeof cursorPos === 'number') {
        el.setSelectionRange(cursorPos, cursorPos);
      }
    },
    getEl: () => taRef.current,
  }), []);

  // Auto-resize: ajusta height pra cobrir o texto sem scroll interno.
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={taRef}
      className={`block__leaf ${className || ''} ${isEmpty ? 'is-empty' : ''}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      rows={1}
      spellCheck="true"
    />
  );
});

const Block = forwardRef(function Block({
  block,
  index,
  total,
  courseMap,
  allCourses,
  dragHandleRef,
  dragHandleListeners,
  onChange,                    // (patch) => void
  onChangeContent,             // (newContent, opts) => void  — separado pra detectar markdown shortcuts
  onKeyDown,                   // (e, blockEl) => void  — Enter, Backspace, Arrow Up/Down
  onSlashTrigger,              // (rect) => void — abre slash menu
  onAddBelow,                  // () => void — botão + ao lado
  onDuplicate,                 // () => void
  onRemove,                    // () => void
  onChangeType,                // (newType) => void — mudar tipo via menu
}, ref) {
  const leafRef = useRef(null);
  const [showDetails, setShowDetails] = useState(false);

  useImperativeHandle(ref, () => ({
    focus: (pos) => leafRef.current?.focus(pos),
    getEl: () => leafRef.current?.getEl(),
  }), []);

  const isEmpty = !block.content || block.content.trim() === '';

  // ---------- Captura de teclas globais do bloco ----------
  // Repassa pra cima (BlockEditor) que orquestra Enter/Backspace/Arrow.
  // Aqui interceptamos apenas: digitação de '/' como primeiro char (slash menu).
  const handleKeyDown = (e) => {
    // Slash menu: digitou '/' num bloco vazio (paragraph) → abre menu.
    if (e.key === '/' && block.type === BLOCK.PARAGRAPH && isEmpty) {
      // Não previne: deixa o '/' aparecer; abrir menu acontece depois,
      // pelo onChange detectando que conteúdo virou '/'.
    }
    // Entrega o evento pro pai (BlockEditor) decidir Enter/Backspace.
    onKeyDown?.(e);
  };

  const handleContentChange = (newValue) => {
    // Detecta '/' como primeiro caractere — sinaliza pro pai abrir slash menu.
    if (newValue === '/' && block.type === BLOCK.PARAGRAPH) {
      const el = leafRef.current?.getEl();
      const rect = el?.getBoundingClientRect();
      if (rect) onSlashTrigger?.(rect);
    }
    onChangeContent?.(newValue);
  };

  // ---------- ⋯ MENU items por bloco ----------
  // Feature de colunas adiada — menu fica mais enxuto.
  const menuItems = [
    {
      label: 'Adicionar bloco abaixo',
      icon: 'fa-plus',
      onClick: onAddBelow,
    },
    {
      label: 'Duplicar',
      icon: 'fa-clone',
      onClick: onDuplicate,
    },
    { divider: true },
    {
      label: 'Mudar tipo',
      icon: 'fa-arrow-right-arrow-left',
      onClick: () => {
        const el = leafRef.current?.getEl();
        const rect = el?.getBoundingClientRect();
        if (rect) onSlashTrigger?.(rect, true);
      },
    },
    { divider: true },
    {
      label: 'Remover bloco',
      icon: 'fa-trash',
      danger: true,
      onClick: onRemove,
    },
  ];

  // ---------- RENDER POR TIPO ----------
  let leftSlot = null;
  let mainSlot = null;
  let rightSlot = null;

  if (block.type === BLOCK.DIVIDER) {
    return (
      <div className={`block block--divider`} data-block-id={block.id}>
        <button
          type="button"
          className="block__handle"
          ref={dragHandleRef}
          {...(dragHandleListeners || {})}
          aria-label="Arrastar bloco"
          title="Arrastar"
        >
          <i className="fa-solid fa-grip-vertical"></i>
        </button>
        <div className="block__divider-line" />
        <div className="block__actions">
          <ActionMenu items={menuItems} size="sm" />
        </div>
      </div>
    );
  }

  if (block.type === BLOCK.IMAGE) {
    return (
      <div className="block block--image" data-block-id={block.id}>
        <div className="block__row">
          <button
            type="button"
            className="block__handle"
            ref={dragHandleRef}
            {...(dragHandleListeners || {})}
            aria-label="Arrastar bloco"
            title="Arrastar"
          >
            <i className="fa-solid fa-grip-vertical"></i>
          </button>
          <div className="block__image-wrap">
            {block.src ? (
              <figure className="block__image-fig">
                <img src={block.src} alt={block.alt || ''} loading="lazy" />
                {block.alt ? <figcaption>{block.alt}</figcaption> : null}
              </figure>
            ) : (
              <div className="block__image-empty">
                <i className="fa-solid fa-image"></i>
                <span>Adicione uma URL de imagem ou cole markdown <code>![alt](url)</code></span>
              </div>
            )}
            <div className="block__image-controls">
              <input
                type="url"
                placeholder="URL da imagem (https://...)"
                value={block.src || ''}
                onChange={(e) => onChange({ src: e.target.value })}
              />
              <input
                type="text"
                placeholder="Texto alternativo / legenda (opcional)"
                value={block.alt || ''}
                onChange={(e) => onChange({ alt: e.target.value })}
              />
            </div>
          </div>
          <div className="block__menu">
            <ActionMenu items={menuItems} size="sm" />
          </div>
        </div>
      </div>
    );
  }

  // ---------- Render dos blocos com conteúdo ----------
  if (block.type === BLOCK.CHECKBOX) {
    leftSlot = (
      <button
        type="button"
        className={`block-check ${block.checked ? 'is-done' : ''}`}
        onClick={() => onChange({ checked: !block.checked })}
        aria-pressed={!!block.checked}
        aria-label={block.checked ? 'Desmarcar' : 'Marcar como concluído'}
      >
        {block.checked ? <i className="fa-solid fa-check"></i> : null}
      </button>
    );
  } else if (block.type === BLOCK.RECURRING) {
    const done = isCompletedThisPeriod(block);
    const streak = calculateStreak(block);
    leftSlot = (
      <button
        type="button"
        className={`block-check block-check--recur ${done ? 'is-done' : ''}`}
        onClick={() => {
          const next = toggleRecurringForToday(block);
          onChange({ recurring: next.recurring });
        }}
        aria-pressed={done}
        aria-label={done ? 'Desfazer marcação' : 'Marcar como feito no período'}
        title={`${RECURRING_FREQUENCIES.find((f) => f.id === (block.recurring?.frequency || 'weekly'))?.label} · streak ${streak}`}
      >
        {done ? <i className="fa-solid fa-check"></i> : null}
      </button>
    );
  } else if (block.type === BLOCK.BULLET) {
    leftSlot = <span className="block__bullet" aria-hidden="true">•</span>;
  } else if (block.type === BLOCK.QUOTE) {
    leftSlot = <span className="block__quote-bar" aria-hidden="true" />;
  }

  mainSlot = (
    <EditableLeaf
      ref={leafRef}
      value={block.content || ''}
      onChange={handleContentChange}
      onKeyDown={handleKeyDown}
      placeholder={PLACEHOLDERS[block.type] || ''}
      className={`block__leaf--${block.type}`}
      isEmpty={isEmpty}
    />
  );

  // Right slot: PercentControl pra percent + badges variados.
  if (block.type === BLOCK.PERCENT) {
    const linkedCount = (block.linkedCourses || []).length;
    const derived = linkedCount > 0;
    let effectivePct = block.progress || 0;
    if (derived && courseMap) {
      const pcts = (block.linkedCourses || [])
        .map((name) => courseMap.get(name))
        .filter(Boolean)
        .map((c) => Number(c.porcentagem_concluida) || 0);
      if (pcts.length > 0) {
        effectivePct = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
      }
    }
    rightSlot = (
      <div className="block__right block__right--percent">
        <PercentControl
          value={effectivePct}
          done={effectivePct >= 100}
          derived={derived}
          onChange={(v) => onChange({ progress: v })}
        />
      </div>
    );
  }

  // Badges pequenos (cursos, link, frequência)
  const badges = [];
  if (block.type === BLOCK.RECURRING) {
    const freq = RECURRING_FREQUENCIES.find((f) => f.id === (block.recurring?.frequency || 'weekly'))?.label;
    const streak = calculateStreak(block);
    badges.push(
      <span key="freq" className="block__badge"><i className="fa-solid fa-arrows-rotate"></i>{freq}</span>,
    );
    if (streak > 0) badges.push(<span key="streak" className="block__badge block__badge--streak">🔥 {streak}</span>);
  }
  if ((block.linkedCourses || []).length > 0) {
    badges.push(
      <span key="courses" className="block__badge" title="Cursos vinculados">
        <i className="fa-solid fa-link"></i>{block.linkedCourses.length} curso{block.linkedCourses.length === 1 ? '' : 's'}
      </span>,
    );
  }
  if (block.link) {
    badges.push(
      <a
        key="link"
        href={block.link}
        target="_blank"
        rel="noreferrer"
        className="block__badge block__badge--link"
        onClick={(e) => e.stopPropagation()}
        title={block.link}
      >
        <i className="fa-solid fa-link"></i>link
      </a>,
    );
  }

  // Itens extras do menu pra blocos que suportam (recurring tem submenu de freq).
  if (block.type === BLOCK.RECURRING) {
    menuItems.splice(2, 0, { divider: true });
    RECURRING_FREQUENCIES.forEach((f) => {
      menuItems.splice(3, 0, {
        label: `Frequência: ${f.label}`,
        icon: (block.recurring?.frequency || 'weekly') === f.id ? 'fa-circle-dot' : 'fa-circle',
        onClick: () => onChange({
          recurring: { ...(block.recurring || {}), frequency: f.id, completedDates: block.recurring?.completedDates || [] },
        }),
      });
    });
  }
  if (blockCanHaveCourses(block)) {
    menuItems.splice(2, 0, {
      label: showDetails ? 'Recolher detalhes' : 'Anotação e cursos',
      icon: showDetails ? 'fa-chevron-up' : 'fa-pen-to-square',
      onClick: () => setShowDetails((v) => !v),
    });
  }

  // ---------- ESTRUTURA DO BLOCO ----------
  return (
    <div
      className={`block block--${block.type} ${block.width === 'half' ? 'block--half' : ''} ${block.checked ? 'is-done' : ''} ${showDetails ? 'is-expanded' : ''}`}
      data-block-id={block.id}
    >
      <div className="block__row">
        <button
          type="button"
          className="block__handle"
          ref={dragHandleRef}
          {...(dragHandleListeners || {})}
          aria-label="Arrastar bloco"
          title="Arrastar"
        >
          <i className="fa-solid fa-grip-vertical"></i>
        </button>

        {leftSlot ? <div className="block__left">{leftSlot}</div> : null}

        <div className="block__main">
          {mainSlot}
          {badges.length > 0 ? <div className="block__badges">{badges}</div> : null}
        </div>

        {rightSlot}

        <div className="block__menu">
          <ActionMenu items={menuItems} size="sm" />
        </div>
      </div>

      {showDetails && blockCanHaveCourses(block) ? (
        <div className="block__details">
          <CourseLinker
            allCourses={allCourses}
            linkedNames={block.linkedCourses || []}
            onChange={(names) => onChange({ linkedCourses: names })}
          />

          <label className="block__field">
            <span className="block__field-lbl"><i className="fa-solid fa-link"></i> Link</span>
            <input
              type="url"
              placeholder="https://..."
              value={block.link || ''}
              onChange={(e) => onChange({ link: e.target.value })}
            />
          </label>

          <div className="block__field">
            <span className="block__field-lbl"><i className="fa-solid fa-pen-to-square"></i> Anotações <span className="block__field-hint">(markdown)</span></span>
            <MarkdownNote
              value={block.notes || ''}
              onChange={(v) => onChange({ notes: v })}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
});

export default Block;
