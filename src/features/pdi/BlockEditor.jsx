import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Block from './Block';
import SlashMenu from './SlashMenu';
import { BLOCK, detectMarkdownShortcut, getWidthBasis } from './blockTypes';

// Editor de blocos. Orquestra:
// - Lista de blocos (drag-and-drop)
// - Focus management (Enter cria bloco, Backspace deleta, setas navegam)
// - Slash menu (digita "/" → escolhe tipo)
// - Markdown shortcuts (digita "## " → vira heading)

// Tipos que SEMPRE ocupam linha inteira, mesmo que width seja parcial.
const ALWAYS_FULL_TYPES = new Set([BLOCK.HEADING_2, BLOCK.HEADING_3, BLOCK.DIVIDER]);

function SortableBlockWrapper({ block, children, isOverRight }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  // Zona droppable lateral direita — usada pra detectar "soltar pra criar coluna".
  // ID com sufixo `::right` pra distinguir do drop sortable normal.
  const { setNodeRef: setRightRef } = useDroppable({
    id: `${block.id}::right`,
    data: { type: 'right-zone', targetBlockId: block.id },
  });

  const effectiveWidth = ALWAYS_FULL_TYPES.has(block.type) ? 'full' : (block.width || 'full');
  const flexBasis = getWidthBasis(effectiveWidth);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : 'auto',
    position: 'relative',
    flex: `0 1 ${flexBasis}`,
    minWidth: 0,
    maxWidth: flexBasis,
  };

  // Zona lateral SÓ aparece pra blocos que aceitam virar coluna (não heading/divider).
  const acceptsRightDrop = !ALWAYS_FULL_TYPES.has(block.type);

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      {children({
        dragHandleRef: setActivatorNodeRef,
        dragHandleListeners: listeners,
      })}
      {acceptsRightDrop ? (
        <div
          ref={setRightRef}
          className={`block__drop-right ${isOverRight ? 'is-active' : ''}`}
          aria-hidden="true"
        />
      ) : null}
    </div>
  );
}

function BlockEditor({
  blocks,
  courseMap,
  allCourses,
  onUpdateBlock,
  onInsertAfter,
  onRemoveBlock,
  onDuplicateBlock,
  onReorder,
  onChangeType,
}) {
  // Refs por bloco pra orquestrar focus.
  const blockRefs = useRef(new Map());
  const setBlockRef = (id, ref) => {
    if (ref) blockRefs.current.set(id, ref);
    else blockRefs.current.delete(id);
  };

  // Estado durante drag — pra mostrar indicador visual da zona lateral.
  const [overRightTarget, setOverRightTarget] = useState(null);

  // Slash menu state.
  const [slashState, setSlashState] = useState({
    open: false,
    blockId: null,
    rect: null,
    query: '',
    isReplaceMode: false, // se true, troca tipo do bloco existente em vez de criar
  });

  // ID do bloco que precisa ser focado depois do próximo render.
  const [focusRequest, setFocusRequest] = useState(null);

  useEffect(() => {
    if (!focusRequest) return;
    const ref = blockRefs.current.get(focusRequest.id);
    if (ref?.focus) {
      ref.focus(focusRequest.cursor || 'end');
    }
    setFocusRequest(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest, blocks]);

  // ---------- DnD ----------
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;
    setOverRightTarget(null);
    if (!over) return;

    const overId = String(over.id);

    // Drop na zona lateral direita de outro bloco → cria/atualiza coluna.
    if (overId.endsWith('::right')) {
      const targetId = overId.replace('::right', '');
      if (targetId === active.id) return;

      const fromIndex = blocks.findIndex((b) => b.id === active.id);
      const targetIndex = blocks.findIndex((b) => b.id === targetId);
      if (fromIndex < 0 || targetIndex < 0) return;

      const target = blocks[targetIndex];
      const active_ = blocks[fromIndex];

      // Decide as larguras: se target ainda é full, ambos viram half. Se já é
      // half, ambos ficam third (cabem 3 lado a lado depois). Quarter idem.
      const newWidth = (() => {
        if (!target.width || target.width === 'full') return 'half';
        if (target.width === 'half') return 'third';
        if (target.width === 'third') return 'quarter';
        return 'quarter';
      })();

      // Atualiza target e active com a nova largura, e move active pra logo
      // após target. Ordem importa: como onUpdateBlock e onReorder são
      // assíncronos do React, é seguro chamar em sequência — o state do hook
      // mescla todas as mutations.
      onUpdateBlock(target.id, { width: newWidth });
      onUpdateBlock(active_.id, { width: newWidth });
      // Move active pra posição target+1. Após o move, fica imediatamente
      // após o target (lado a lado pelo flex).
      const insertAt = fromIndex < targetIndex ? targetIndex : targetIndex + 1;
      onReorder(fromIndex, insertAt);
      return;
    }

    // Drop normal (sortable) — reorder linear.
    if (active.id === over.id) return;
    const fromIndex = blocks.findIndex((b) => b.id === active.id);
    const toIndex = blocks.findIndex((b) => b.id === over.id);
    if (fromIndex < 0 || toIndex < 0) return;
    onReorder(fromIndex, toIndex);
  }, [blocks, onReorder, onUpdateBlock]);

  const handleDragOver = useCallback((event) => {
    const { over } = event;
    if (!over) { setOverRightTarget(null); return; }
    const id = String(over.id);
    if (id.endsWith('::right')) {
      setOverRightTarget(id.replace('::right', ''));
    } else {
      setOverRightTarget(null);
    }
  }, []);

  const handleDragCancel = useCallback(() => setOverRightTarget(null), []);

  // ---------- Eventos por bloco ----------

  const handleBlockChange = (block, patch) => {
    onUpdateBlock(block.id, patch);
  };

  const handleContentChange = (block, newContent) => {
    // Verifica markdown shortcut. Só quando o usuário acabou de digitar
    // o gatilho (espaço depois do "## ", "- ", etc.). Se o conteúdo é
    // exatamente um shortcut, converte o tipo do bloco.
    const detected = detectMarkdownShortcut(newContent);
    if (detected && block.type === BLOCK.PARAGRAPH) {
      // Para divider, basta trocar tipo (não tem conteúdo).
      if (detected.type === BLOCK.DIVIDER) {
        onUpdateBlock(block.id, { type: BLOCK.DIVIDER, content: '' });
        // Cria bloco abaixo pra cursor não ficar perdido.
        const newBlock = onInsertAfter(block.id, BLOCK.PARAGRAPH);
        setFocusRequest({ id: newBlock.id, cursor: 'end' });
        return;
      }
      // Para image, preenche src/alt do match e cria paragraph abaixo pra
      // cursor não ficar preso num bloco sem texto editável.
      if (detected.type === BLOCK.IMAGE) {
        onUpdateBlock(block.id, {
          type: BLOCK.IMAGE,
          content: '',
          src: detected.extra?.src || '',
          alt: detected.extra?.alt || '',
        });
        const newBlock = onInsertAfter(block.id, BLOCK.PARAGRAPH);
        setFocusRequest({ id: newBlock.id, cursor: 'start' });
        return;
      }
      onUpdateBlock(block.id, { type: detected.type, content: detected.rest });
      // Mantém foco neste bloco com cursor no fim.
      setFocusRequest({ id: block.id, cursor: 'end' });
      return;
    }

    // Slash menu: detecta "/" inicial (mostra menu) e mudança da query.
    if (newContent.startsWith('/') && block.type === BLOCK.PARAGRAPH) {
      const el = blockRefs.current.get(block.id)?.getEl();
      const rect = el?.getBoundingClientRect();
      setSlashState({
        open: true,
        blockId: block.id,
        rect,
        query: newContent.slice(1),
        isReplaceMode: false,
      });
    } else if (slashState.open && slashState.blockId === block.id) {
      setSlashState((s) => ({ ...s, open: false }));
    }

    onUpdateBlock(block.id, { content: newContent });
  };

  const handleKeyDown = (block, e) => {
    // Se slash menu está aberto, deixa ele lidar com setas/Enter/Esc.
    if (slashState.open && slashState.blockId === block.id) {
      if (['ArrowUp', 'ArrowDown', 'Enter', 'Escape'].includes(e.key)) {
        return; // o handler do SlashMenu já cuida.
      }
    }

    // Enter (sem Shift) cria bloco abaixo.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Heading e bullet/checkbox: bloco abaixo é paragraph (ou continuação do mesmo tipo pra listas).
      let newType = BLOCK.PARAGRAPH;
      if (block.type === BLOCK.BULLET) newType = BLOCK.BULLET;
      if (block.type === BLOCK.CHECKBOX) newType = BLOCK.CHECKBOX;
      const newBlock = onInsertAfter(block.id, newType);
      setFocusRequest({ id: newBlock.id, cursor: 'start' });
      return;
    }

    // Backspace em conteúdo vazio → deleta bloco e foca no anterior.
    if (e.key === 'Backspace' && (!block.content || block.content === '')) {
      const idx = blocks.findIndex((b) => b.id === block.id);
      if (idx > 0) {
        e.preventDefault();
        const prev = blocks[idx - 1];
        onRemoveBlock(block.id);
        setFocusRequest({ id: prev.id, cursor: 'end' });
      }
      return;
    }

    // ArrowUp/Down navegam entre blocos.
    if (e.key === 'ArrowUp') {
      const el = e.target;
      // Move pro bloco anterior se cursor está na primeira linha.
      if (el && el.selectionStart === 0) {
        const idx = blocks.findIndex((b) => b.id === block.id);
        if (idx > 0) {
          e.preventDefault();
          setFocusRequest({ id: blocks[idx - 1].id, cursor: 'end' });
        }
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      const el = e.target;
      if (el && el.selectionEnd === el.value.length) {
        const idx = blocks.findIndex((b) => b.id === block.id);
        if (idx < blocks.length - 1) {
          e.preventDefault();
          setFocusRequest({ id: blocks[idx + 1].id, cursor: 'start' });
        }
      }
      return;
    }
  };

  const handleSlashSelect = (newType) => {
    const blockId = slashState.blockId;
    if (!blockId) return;
    if (slashState.isReplaceMode) {
      // Trocar tipo (preservando content).
      const block = blocks.find((b) => b.id === blockId);
      if (block) {
        onUpdateBlock(blockId, { type: newType });
      }
    } else {
      // Caso slash em paragraph vazio: limpa "/" e converte tipo.
      onUpdateBlock(blockId, { type: newType, content: '' });
      // Pra divider, cria bloco abaixo pra cursor não sumir.
      if (newType === BLOCK.DIVIDER) {
        const newBlock = onInsertAfter(blockId, BLOCK.PARAGRAPH);
        setFocusRequest({ id: newBlock.id, cursor: 'start' });
      } else {
        setFocusRequest({ id: blockId, cursor: 'start' });
      }
    }
    setSlashState({ open: false, blockId: null, rect: null, query: '', isReplaceMode: false });
  };

  const handleSlashTrigger = (rect, isReplace) => {
    const blockId = blocks.find((b) => blockRefs.current.get(b.id)?.getEl() === document.activeElement)?.id;
    if (!blockId && !isReplace) return;
    setSlashState({
      open: true,
      blockId: blockId || null,
      rect,
      query: '',
      isReplaceMode: !!isReplace,
    });
  };

  // ---------- Render ----------
  return (
    <div className="block-editor">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragCancel={handleDragCancel}
      >
        <SortableContext items={blocks.map((b) => b.id)} strategy={rectSortingStrategy}>
          {blocks.map((block, idx) => (
            <SortableBlockWrapper
              key={block.id}
              block={block}
              isOverRight={overRightTarget === block.id}
            >
              {({ dragHandleRef, dragHandleListeners }) => (
                <Block
                  ref={(r) => setBlockRef(block.id, r)}
                  block={block}
                  index={idx}
                  total={blocks.length}
                  courseMap={courseMap}
                  allCourses={allCourses}
                  dragHandleRef={dragHandleRef}
                  dragHandleListeners={dragHandleListeners}
                  onChange={(patch) => handleBlockChange(block, patch)}
                  onChangeContent={(content) => handleContentChange(block, content)}
                  onKeyDown={(e) => handleKeyDown(block, e)}
                  onSlashTrigger={(rect, isReplace) => {
                    setSlashState({
                      open: true,
                      blockId: block.id,
                      rect,
                      query: '',
                      isReplaceMode: !!isReplace,
                    });
                  }}
                  onAddBelow={() => {
                    const nb = onInsertAfter(block.id, BLOCK.PARAGRAPH);
                    setFocusRequest({ id: nb.id, cursor: 'start' });
                  }}
                  onDuplicate={() => onDuplicateBlock(block.id)}
                  onRemove={() => onRemoveBlock(block.id)}
                  onChangeType={(newType) => onUpdateBlock(block.id, { type: newType })}
                />
              )}
            </SortableBlockWrapper>
          ))}
        </SortableContext>
      </DndContext>

      <button
        type="button"
        className="block-editor__add-end"
        onClick={() => {
          const last = blocks[blocks.length - 1];
          const nb = onInsertAfter(last?.id || null, BLOCK.PARAGRAPH);
          setFocusRequest({ id: nb.id, cursor: 'start' });
        }}
      >
        <i className="fa-solid fa-plus"></i>
        Adicionar bloco
      </button>

      <SlashMenu
        open={slashState.open}
        anchorRect={slashState.rect}
        query={slashState.query}
        onSelect={handleSlashSelect}
        onClose={() => setSlashState({ open: false, blockId: null, rect: null, query: '', isReplaceMode: false })}
      />
    </div>
  );
}

export default BlockEditor;
