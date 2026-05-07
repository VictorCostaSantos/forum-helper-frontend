import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAluraProgress } from './useAluraProgress';
import { usePdi } from './usePdi';
import { blockCountsForProgress, BLOCK } from './blockTypes';
import { isCompletedThisPeriod } from './taskHelpers';
import AluraCoursesSection from './AluraCoursesSection';
import InlineEdit from './InlineEdit';
import ActionMenu from './ActionMenu';
import BlockEditor from './BlockEditor';

const COLABORADOR = 'victos-costa';

function formatDateBr(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function daysBetween(fromIso, toIso) {
  const a = new Date(fromIso).setHours(0, 0, 0, 0);
  const b = new Date(toIso).setHours(0, 0, 0, 0);
  return Math.round((b - a) / 86_400_000);
}

// Calcula o "% efetivo" de UM bloco que conta pra progresso geral.
// - Checkbox: 100 se checked, 0 se não.
// - Percent: o próprio progress (override por cursos vinculados via média).
// - Recurring: 100 se feito no período atual, 0 caso contrário.
function blockProgress(block, courseMap) {
  if (block.type === BLOCK.CHECKBOX) return block.checked ? 100 : 0;
  if (block.type === BLOCK.RECURRING) return isCompletedThisPeriod(block) ? 100 : 0;
  if (block.type === BLOCK.PERCENT) {
    const linked = block.linkedCourses || [];
    if (linked.length > 0 && courseMap) {
      const pcts = linked
        .map((name) => courseMap.get(name))
        .filter(Boolean)
        .map((c) => Number(c.porcentagem_concluida) || 0);
      if (pcts.length > 0) {
        return Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
      }
    }
    return block.progress || 0;
  }
  return 0;
}

function PdiView() {
  const navigate = useNavigate();
  const pdi = usePdi();
  const { doc } = pdi;
  const alura = useAluraProgress(COLABORADOR);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

  const courseMap = useMemo(() => {
    const courses = alura.data?.courses || [];
    return new Map(courses.map((c) => [c.curso_nome, c]));
  }, [alura.data]);

  const allCourses = alura.data?.courses || [];

  // Stats: olha só blocos que contam pra progresso (checkbox/percent/recurring).
  const stats = useMemo(() => {
    const counted = doc.blocks.filter(blockCountsForProgress);
    if (counted.length === 0) return { pct: 0, done: 0, total: 0 };
    const pcts = counted.map((b) => blockProgress(b, courseMap));
    const sum = pcts.reduce((a, b) => a + b, 0);
    return {
      pct: Math.round(sum / counted.length),
      done: pcts.filter((p) => p >= 100).length,
      total: counted.length,
    };
  }, [doc.blocks, courseMap]);

  const cycle = useMemo(() => {
    const todayIso = new Date().toISOString().slice(0, 10);
    const total = Math.max(0, daysBetween(doc.startDate, doc.endDate));
    const elapsed = Math.max(0, Math.min(total, daysBetween(doc.startDate, todayIso)));
    const remaining = Math.max(0, total - elapsed);
    const pct = total > 0 ? Math.round((elapsed / total) * 100) : 0;
    return { total, elapsed, remaining, pct };
  }, [doc.startDate, doc.endDate]);

  // Conjunto de cursos vinculados em qualquer bloco — usado pelo Alura section
  // pra filtrar.
  const pdiCourseSet = useMemo(() => {
    const set = new Set();
    doc.blocks.forEach((b) => {
      (b.linkedCourses || []).forEach((name) => set.add(name));
    });
    return set;
  }, [doc.blocks]);

  // Fechar emoji picker ao clicar fora.
  useEffect(() => {
    if (!emojiPickerOpen) return undefined;
    const onClick = (e) => {
      if (!e.target.closest('.hero__emoji-picker') && !e.target.closest('.hero__emoji')) {
        setEmojiPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [emojiPickerOpen]);

  const planMenuItems = [
    {
      label: 'Restaurar modelo padrão',
      icon: 'fa-rotate-left',
      onClick: () => {
        if (confirm('Restaurar PDI pro modelo padrão? Sua estrutura atual será substituída.')) {
          pdi.resetToSeed();
        }
      },
    },
    {
      label: 'Começar do zero',
      icon: 'fa-file',
      onClick: () => {
        if (confirm('Apagar tudo e começar do zero?')) {
          pdi.wipeToBlank();
        }
      },
    },
  ];

  return (
    <main className="pdi-view">
      <div className="pdi-view__inner">
        <div className="pdi-view__topbar">
          <button type="button" className="pdi-view__back" onClick={() => navigate(-1)}>
            <i className="fa-solid fa-arrow-left"></i>
            Voltar
          </button>
          <ActionMenu items={planMenuItems} size="md" label="Ações do plano" />
        </div>

        {/* HERO */}
        <header className="hero">
          <div className="hero__emoji-wrap">
            <button
              type="button"
              className="hero__emoji"
              onClick={() => setEmojiPickerOpen((v) => !v)}
              title="Mudar ícone"
              aria-label="Mudar ícone do PDI"
            >
              {doc.emoji || '📄'}
            </button>
            {emojiPickerOpen ? (
              <div className="hero__emoji-picker">
                {['👨‍💻', '🎯', '🚀', '🌱', '🔥', '⭐', '📚', '🧠', '💡', '✨', '🎨', '🛠️', '📊', '🏆', '🌟', '📝'].map((e) => (
                  <button
                    key={e}
                    type="button"
                    className={`hero__emoji-opt ${e === doc.emoji ? 'is-active' : ''}`}
                    onClick={() => { pdi.updateMeta({ emoji: e }); setEmojiPickerOpen(false); }}
                  >
                    {e}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <InlineEdit
            as="h1"
            className="hero__title"
            value={doc.title}
            placeholder="Sem título"
            onChange={(v) => pdi.updateMeta({ title: v })}
          />

          <p className="hero__role">
            <InlineEdit
              as="span"
              value={doc.role}
              placeholder="Cargo"
              onChange={(v) => pdi.updateMeta({ role: v })}
            />
            <span className="hero__sep">·</span>
            <InlineEdit
              as="span"
              value={doc.department}
              placeholder="Departamento"
              onChange={(v) => pdi.updateMeta({ department: v })}
            />
          </p>

          {(doc.focus || doc.focus === '') ? (
            <div className="hero__focus">
              <span className="hero__focus-icon">🎯</span>
              <span className="hero__focus-lbl">Foco:</span>
              <InlineEdit
                as="span"
                className="hero__focus-text"
                value={doc.focus || ''}
                placeholder="Adicione o foco do momento"
                onChange={(v) => pdi.updateMeta({ focus: v })}
              />
            </div>
          ) : null}

          <div className="hero__meta">
            <div className="hero__meta-stats">
              <span><strong>{stats.pct}%</strong> concluído</span>
              <span className="hero__sep">·</span>
              <span><strong>{stats.done}</strong>/{stats.total} itens</span>
              <span className="hero__sep">·</span>
              <span><strong>{cycle.remaining}</strong> dias restantes</span>
            </div>
            <div className="hero__meta-dates">
              <input
                type="date"
                value={doc.startDate}
                onChange={(e) => pdi.updateMeta({ startDate: e.target.value })}
                aria-label="Início"
                className="hero__date"
              />
              <span>→</span>
              <input
                type="date"
                value={doc.endDate}
                onChange={(e) => pdi.updateMeta({ endDate: e.target.value })}
                aria-label="Previsto"
                className="hero__date"
              />
              {doc.feedzUrl ? (
                <a
                  href={doc.feedzUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hero__feedz-link"
                  title="Abrir PDI oficial na FEEDZ"
                >
                  <i className="fa-solid fa-up-right-from-square"></i>
                  FEEDZ
                </a>
              ) : null}
            </div>
          </div>

          <div className="hero__cycle">
            <div className="hero__cycle-track">
              <div className="hero__cycle-fill" style={{ width: `${cycle.pct}%` }} />
            </div>
            <div className="hero__cycle-meta">
              <span>Hoje · dia {cycle.elapsed} de {cycle.total}</span>
              <span>{cycle.pct}%</span>
            </div>
          </div>
        </header>

        {/* EDITOR DE BLOCOS — coração do PDI */}
        <BlockEditor
          blocks={doc.blocks}
          courseMap={courseMap}
          allCourses={allCourses}
          onUpdateBlock={pdi.updateBlock}
          onInsertAfter={pdi.insertBlockAfter}
          onRemoveBlock={pdi.removeBlock}
          onDuplicateBlock={pdi.duplicateBlock}
          onReorder={pdi.reorderBlocks}
        />

        {/* CURSOS DA ALURA — fora dos blocos, no rodapé */}
        <AluraCoursesSection
          data={alura.data}
          loading={alura.loading}
          error={alura.error}
          onRefetch={alura.refetch}
          fromCache={alura.fromCache}
          lastFetchedAt={alura.lastFetchedAt}
          pdiCourseSet={pdiCourseSet}
        />

        <footer className="pdi-view__foot">
          <i className="fa-solid fa-circle-info"></i>
          <span>
            A FEEDZ continua sendo a fonte oficial. Aqui é seu companion de organização —
            atualize a FEEDZ quando o ciclo exigir reportar progresso.
          </span>
        </footer>
      </div>
    </main>
  );
}

export default PdiView;
