import { useCallback, useEffect, useState } from 'react';
import { buildInitialDoc } from './pdiData';
import {
  BLOCK,
  createBlock,
  migrateLegacyToDoc,
} from './blockTypes';

// Documento Notion-style. Substitui o modelo `plan` (groups+tasks).
// Persistido em `pdiDoc-v2`. Migra automaticamente quem tinha `pdiPlan-v1`
// e `pdiState-v1`, juntando ambos numa única lista de blocos.
const STORAGE_KEY_DOC = 'pdiDoc-v2';
const LEGACY_PLAN_KEY = 'pdiPlan-v1';
const LEGACY_STATE_KEY = 'pdiState-v1';

function buildSeed() {
  // Doc inicial "tour das possibilidades" — conteúdo genérico mostrando
  // todos os tipos de bloco. Veja `buildInitialDoc` em pdiData.js.
  // O INITIAL_PLAN (legado, groups+tasks) só é usado em migração agora.
  return buildInitialDoc();
}

// Backfill de campos novos pra docs v2 antigos que ainda não os têm.
// Mantém compatibilidade quando o schema do hero ganha campos (acento, focusTags, etc).
function backfillDoc(doc) {
  if (!doc) return doc;
  const out = { ...doc };
  if (out.accentId == null) out.accentId = 'is-data';
  if (out.coverEnabled == null) out.coverEnabled = true;
  if (out.avatarUrl == null) out.avatarUrl = '';
  if (out.type == null) out.type = '';
  if (!Array.isArray(out.focusTags)) {
    const fromString = (out.focus || '')
      .split(/\s*(?:&|·|,|;)\s*/)
      .map((s) => s.trim())
      .filter(Boolean);
    out.focusTags = fromString;
  }
  return out;
}

function loadDoc() {
  try {
    // 1. Já tem doc na v2? usa (com backfill pra campos novos).
    const raw = localStorage.getItem(STORAGE_KEY_DOC);
    if (raw) return backfillDoc(JSON.parse(raw));

    // 2. Senão, tenta migrar v1 (plano + estado).
    const legacyPlanRaw = localStorage.getItem(LEGACY_PLAN_KEY);
    const legacyStateRaw = localStorage.getItem(LEGACY_STATE_KEY);
    if (legacyPlanRaw) {
      const legacyPlan = JSON.parse(legacyPlanRaw);
      const legacyState = legacyStateRaw ? JSON.parse(legacyStateRaw) : {};
      return migrateLegacyToDoc(legacyPlan, legacyState);
    }
  } catch {
    /* JSON corrompido — cai pra seed silenciosamente */
  }
  return buildSeed();
}

function saveDoc(doc) {
  try {
    localStorage.setItem(STORAGE_KEY_DOC, JSON.stringify(doc));
  } catch {
    /* localStorage cheio/bloqueado — falha silenciosa */
  }
}

export function usePdi() {
  const [doc, setDoc] = useState(loadDoc);

  useEffect(() => {
    saveDoc(doc);
  }, [doc]);

  // ---------- META ----------
  const updateMeta = useCallback((patch) => {
    setDoc((d) => ({ ...d, ...patch }));
  }, []);

  // ---------- BLOCKS ----------
  const updateBlock = useCallback((blockId, patch) => {
    setDoc((d) => ({
      ...d,
      blocks: d.blocks.map((b) => (b.id === blockId ? { ...b, ...patch } : b)),
    }));
  }, []);

  // Insere um bloco depois de outro (referência por id). Se afterId é null,
  // adiciona no fim.
  const insertBlockAfter = useCallback((afterId, type, partial = {}) => {
    const newBlock = createBlock(type, partial);
    setDoc((d) => {
      const idx = afterId ? d.blocks.findIndex((b) => b.id === afterId) : -1;
      const insertAt = idx >= 0 ? idx + 1 : d.blocks.length;
      const next = [...d.blocks];
      next.splice(insertAt, 0, newBlock);
      return { ...d, blocks: next };
    });
    return newBlock;
  }, []);

  // Insere um bloco antes (útil pra Backspace que move conteúdo pra trás).
  const insertBlockBefore = useCallback((beforeId, type, partial = {}) => {
    const newBlock = createBlock(type, partial);
    setDoc((d) => {
      const idx = beforeId ? d.blocks.findIndex((b) => b.id === beforeId) : 0;
      const insertAt = idx >= 0 ? idx : 0;
      const next = [...d.blocks];
      next.splice(insertAt, 0, newBlock);
      return { ...d, blocks: next };
    });
    return newBlock;
  }, []);

  const removeBlock = useCallback((blockId) => {
    setDoc((d) => {
      const next = d.blocks.filter((b) => b.id !== blockId);
      // Garante que sempre haja pelo menos 1 bloco (paragraph vazio).
      if (next.length === 0) next.push(createBlock(BLOCK.PARAGRAPH));
      return { ...d, blocks: next };
    });
  }, []);

  const duplicateBlock = useCallback((blockId) => {
    setDoc((d) => {
      const idx = d.blocks.findIndex((b) => b.id === blockId);
      if (idx < 0) return d;
      const original = d.blocks[idx];
      const copy = createBlock(original.type, { ...original });
      // createBlock gerou novo id; sobrescrever sobre o spread.
      copy.id = createBlock(original.type).id;
      const next = [...d.blocks];
      next.splice(idx + 1, 0, copy);
      return { ...d, blocks: next };
    });
  }, []);

  // Reordena por índice (drag-and-drop).
  const reorderBlocks = useCallback((fromIndex, toIndex) => {
    setDoc((d) => {
      if (fromIndex === toIndex) return d;
      const next = [...d.blocks];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return { ...d, blocks: next };
    });
  }, []);

  // Substitui o doc inteiro de uma vez (usado pelos templates do Welcome:
  // "começar meu PDI" / "ver exemplo" / "em branco"). Mantém localStorage save
  // via useEffect.
  const replaceDoc = useCallback((newDoc) => {
    if (!newDoc) return;
    setDoc(newDoc);
  }, []);

  // ---------- RESET / WIPE ----------
  const resetToSeed = useCallback(() => {
    setDoc(buildSeed());
  }, []);

  const wipeToBlank = useCallback(() => {
    setDoc({
      title: 'Meu PDI',
      type: '',
      role: '',
      department: '',
      focus: '',
      focusTags: [],
      emoji: '📄',
      avatarUrl: '',
      accentId: 'is-data',
      coverEnabled: true,
      cover: '',
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date(Date.now() + 180 * 86_400_000).toISOString().slice(0, 10),
      feedzUrl: '',
      blocks: [createBlock(BLOCK.PARAGRAPH)],
    });
  }, []);

  return {
    doc,
    updateMeta,
    updateBlock,
    insertBlockAfter,
    insertBlockBefore,
    removeBlock,
    duplicateBlock,
    reorderBlocks,
    replaceDoc,
    resetToSeed,
    wipeToBlank,
  };
}
