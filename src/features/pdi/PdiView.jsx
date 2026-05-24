import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAluraProgress } from './useAluraProgress';
import { usePdi } from './usePdi';
import { blockCountsForProgress, BLOCK } from './blockTypes';
import { isCompletedThisPeriod } from './taskHelpers';
import AluraCoursesSection from './AluraCoursesSection';
import InlineEdit from './InlineEdit';
import ActionMenu from './ActionMenu';
import BlockEditor from './BlockEditor';
import HeroFocusTags from './HeroFocusTags';
import HeroIconPicker from './HeroIconPicker';
import PdiSetupModal from './PdiSetupModal';
import PdiNotificationsModal from './PdiNotificationsModal';
import PdiWelcome from './PdiWelcome';
import { usePdiNotifications } from './usePdiNotifications';
import { PDI_ACCENTS, buildStudyDoc, buildBlankDoc, buildInitialDoc } from './pdiData';

const COLABORADOR = 'victos-costa';
const COMPACT_KEY = 'pdiHeroCompact-v1';

function daysBetween(fromIso, toIso) {
  const a = new Date(fromIso).setHours(0, 0, 0, 0);
  const b = new Date(toIso).setHours(0, 0, 0, 0);
  return Math.round((b - a) / 86_400_000);
}

function accentColorOf(accentId) {
  const found = PDI_ACCENTS.find((a) => a.id === accentId);
  return (found || PDI_ACCENTS.find((a) => a.id === 'is-data') || PDI_ACCENTS[0]).color;
}

// Urgência baseada em dias restantes. Tinge o card "dias restantes" e a barra.
function urgencyOf(remaining, total) {
  if (total <= 0) return '';
  if (remaining <= 0) return 'is-over';
  if (remaining <= 7) return 'is-urgent';
  if (remaining <= 21) return 'is-warning';
  return '';
}

// % efetivo de UM bloco que conta pra progresso.
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

// Detecta PDI em estado "fresh"/vazio — usado pra disparar o setup automático.
// Critério: título default + sem foco + todos blocos sem conteúdo.
function isPdiEmpty(doc) {
  if (!doc) return false;
  const defaultTitle = !doc.title || doc.title === 'Meu PDI';
  const noFocus = !doc.focusTags || doc.focusTags.length === 0;
  const onlyEmptyBlocks = (doc.blocks || []).every((b) => !b.content);
  return defaultTitle && noFocus && onlyEmptyBlocks;
}

// =====================================================================
// AccentPicker (popover do topbar) — 8 swatches.
// =====================================================================
function AccentPicker({ accentId, onPick, onClose }) {
  return (
    <div className="hero__accent-picker" onClick={(e) => e.stopPropagation()}>
      <div className="hero__accent-title">Cor do PDI</div>
      <div className="hero__accent-grid">
        {PDI_ACCENTS.map((a) => (
          <button
            key={a.id}
            type="button"
            className={`hero__accent-swatch ${a.id === accentId ? 'is-active' : ''}`}
            style={{ '--swatch': a.color }}
            onClick={() => { onPick(a.id); onClose(); }}
            title={a.label}
            aria-label={`Cor ${a.label}`}
          />
        ))}
      </div>
    </div>
  );
}

function PdiView() {
  const navigate = useNavigate();
  const pdi = usePdi();
  const { doc } = pdi;
  const alura = useAluraProgress(COLABORADOR);

  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [accentPickerOpen, setAccentPickerOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupFirstTime, setSetupFirstTime] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  // Notificações do PDI: aparecem no sino do header + opcionalmente no navegador.
  const notif = usePdiNotifications(doc);
  const [compact, setCompact] = useState(() => {
    try { return localStorage.getItem(COMPACT_KEY) === '1'; } catch { return false; }
  });

  // Welcome aparece quando o PDI está vazio (estado fresh ou pós-wipe).
  // Quando o user escolhe uma opção, o doc deixa de ser vazio e o welcome some.
  const showWelcome = isPdiEmpty(doc);

  useEffect(() => {
    try {
      if (compact) localStorage.setItem(COMPACT_KEY, '1');
      else localStorage.removeItem(COMPACT_KEY);
    } catch { /* ignore */ }
  }, [compact]);

  const courseMap = useMemo(() => {
    const courses = alura.data?.courses || [];
    return new Map(courses.map((c) => [c.curso_nome, c]));
  }, [alura.data]);

  const allCourses = alura.data?.courses || [];

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

  const urgency = urgencyOf(cycle.remaining, cycle.total);

  const pdiCourseSet = useMemo(() => {
    const set = new Set();
    doc.blocks.forEach((b) => {
      (b.linkedCourses || []).forEach((name) => set.add(name));
    });
    return set;
  }, [doc.blocks]);

  // Fecha popovers ao clicar fora.
  useEffect(() => {
    if (!iconPickerOpen && !accentPickerOpen) return undefined;
    const onClick = (e) => {
      if (iconPickerOpen
        && !e.target.closest('.hero__icon-picker')
        && !e.target.closest('.hero__avatar')) {
        setIconPickerOpen(false);
      }
      if (accentPickerOpen
        && !e.target.closest('.hero__accent-picker')
        && !e.target.closest('.hero__accent-trigger')) {
        setAccentPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [iconPickerOpen, accentPickerOpen]);

  const accentColor = accentColorOf(doc.accentId);
  const heroStyle = { '--pdi-accent': accentColor };

  const notifMenuLabel = (() => {
    if (!notif.supported) return 'Notificações (não suportado)';
    if (notif.permission === 'granted') return `Notificações ativas (${notif.upcoming.length} agendadas)`;
    if (notif.permission === 'denied') return 'Notificações (bloqueadas)';
    return 'Configurar notificações';
  })();

  const planMenuItems = [
    {
      label: 'Configurações do PDI',
      icon: 'fa-sliders',
      onClick: () => setSetupOpen(true),
    },
    {
      label: notifMenuLabel,
      icon: notif.permission === 'granted' ? 'fa-bell' : 'fa-bell-slash',
      onClick: () => setNotifOpen(true),
    },
    {
      label: compact ? 'Expandir cabeçalho' : 'Compactar cabeçalho',
      icon: compact ? 'fa-up-right-and-down-left-from-center' : 'fa-down-left-and-up-right-to-center',
      onClick: () => setCompact((v) => !v),
    },
    { divider: true },
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
          // Reabre o setup pra reconfigurar — afinal, o usuário acabou de zerar.
          autoOpenedRef.current = false;
          setSetupOpen(true);
        }
      },
    },
  ];

  const handleSetupSave = (next) => {
    pdi.updateMeta(next);
    setSetupOpen(false);
    setSetupFirstTime(false);
  };

  // Aplica side-effects do setup quando firstTime: cria/atualiza schedule
  // no primeiro bloco recurring + liga lembrete diário se marcado.
  const handleApplyStudyRoutine = (routine) => {
    const { studyTime, studyDays, reminderEnabled, reminderTime } = routine || {};
    if (studyTime) {
      // Encontra o primeiro bloco recurring no doc (geralmente o "Estudar hoje"
      // criado pelo buildStudyDoc) e aplica o schedule.
      const target = (doc.blocks || []).find((b) => b.type === BLOCK.RECURRING);
      if (target) {
        pdi.updateBlock(target.id, { schedule: { days: studyDays || [], time: studyTime } });
      }
    }
    if (reminderEnabled) {
      notif.updateDailyReminder({ enabled: true, time: reminderTime || '08:00' });
    }
  };

  const startMyPdi = () => {
    pdi.replaceDoc(buildStudyDoc());
    setSetupFirstTime(true);
    setSetupOpen(true);
  };

  const startTutorial = () => {
    pdi.replaceDoc(buildInitialDoc());
  };

  const startBlank = () => {
    pdi.replaceDoc(buildBlankDoc());
    setSetupFirstTime(false);
    setSetupOpen(true);
  };

  if (showWelcome) {
    return (
      <main className="pdi-view">
        <div className="pdi-view__inner">
          <PdiWelcome
            onStart={startMyPdi}
            onTutorial={startTutorial}
            onBlank={startBlank}
            onBack={() => navigate(-1)}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="pdi-view">
      <div className="pdi-view__inner">
        <div className="pdi-view__topbar">
          <button type="button" className="pdi-view__back" onClick={() => navigate(-1)}>
            <i className="fa-solid fa-arrow-left"></i>
            Voltar
          </button>
          <div className="pdi-view__topbar-actions">
            <button
              type="button"
              className="pdi-view__topbar-btn hero__accent-trigger"
              onClick={() => setAccentPickerOpen((v) => !v)}
              title="Mudar cor do PDI"
              aria-label="Mudar cor do PDI"
              style={{ '--pdi-accent': accentColor }}
            >
              <span className="pdi-view__topbar-swatch" />
              <span className="pdi-view__topbar-btn-lbl">Cor</span>
            </button>
            {accentPickerOpen ? (
              <div className="hero__accent-pop-wrap">
                <AccentPicker
                  accentId={doc.accentId}
                  onPick={(id) => pdi.updateMeta({ accentId: id })}
                  onClose={() => setAccentPickerOpen(false)}
                />
              </div>
            ) : null}
            <ActionMenu items={planMenuItems} size="md" label="Ações do plano" />
          </div>
        </div>

        {/* HERO — focado em sistema de estudos: avatar + título + foco + stats + ciclo. */}
        <header className={`hero hero--clean ${compact ? 'is-compact' : ''} ${urgency}`} style={heroStyle}>
          <div className="hero__titlerow">
            <div className="hero__avatar-wrap">
              <button
                type="button"
                className={`hero__avatar ${doc.avatarUrl ? 'hero__avatar--img' : ''}`}
                onClick={() => setIconPickerOpen((v) => !v)}
                title="Mudar ícone ou foto do PDI"
                aria-label="Mudar ícone ou foto do PDI"
              >
                {doc.avatarUrl ? (
                  <img src={doc.avatarUrl} alt="" />
                ) : (
                  <span>{doc.emoji || '📄'}</span>
                )}
              </button>
              {iconPickerOpen ? (
                <HeroIconPicker
                  emoji={doc.emoji}
                  avatarUrl={doc.avatarUrl}
                  onPickEmoji={(e) => pdi.updateMeta({ emoji: e, avatarUrl: '' })}
                  onSetAvatar={(url) => pdi.updateMeta({ avatarUrl: url })}
                  onClearAvatar={() => pdi.updateMeta({ avatarUrl: '' })}
                  onClose={() => setIconPickerOpen(false)}
                />
              ) : null}
            </div>

            <InlineEdit
              as="h1"
              className="hero__title"
              value={doc.title}
              placeholder="Sem título"
              onChange={(v) => pdi.updateMeta({ title: v })}
            />
          </div>

          {!compact ? (
            <HeroFocusTags
              tags={doc.focusTags || []}
              onChange={(next) => pdi.updateMeta({ focusTags: next })}
            />
          ) : null}

          <div className="hero__stats">
            <div className="hero__stat">
              <div className="hero__stat-value"><strong>{stats.pct}</strong><span>%</span></div>
              <div className="hero__stat-lbl">concluído</div>
            </div>
            <div className="hero__stat">
              <div className="hero__stat-value"><strong>{stats.done}</strong><span>/{stats.total}</span></div>
              <div className="hero__stat-lbl">itens feitos</div>
            </div>
            <div className={`hero__stat hero__stat--days ${urgency}`}>
              <div className="hero__stat-value"><strong>{cycle.remaining}</strong><span>d</span></div>
              <div className="hero__stat-lbl">
                {cycle.remaining <= 0 ? 'ciclo encerrado' : 'restantes'}
              </div>
            </div>
            {doc.feedzUrl ? (
              <a
                href={doc.feedzUrl}
                target="_blank"
                rel="noreferrer"
                className="hero__stat hero__stat--link"
                title="Abrir PDI oficial na FEEDZ"
              >
                <div className="hero__stat-value hero__stat-value--link">
                  <i className="fa-solid fa-up-right-from-square"></i>
                  <strong>FEEDZ</strong>
                </div>
                <div className="hero__stat-lbl">PDI oficial</div>
              </a>
            ) : null}
          </div>

          <div className="hero__cycle">
            <div className="hero__cycle-track">
              <div className="hero__cycle-fill" style={{ width: `${cycle.pct}%` }} />
              <div
                className="hero__cycle-today"
                style={{ left: `${cycle.pct}%` }}
                title={`Hoje · dia ${cycle.elapsed} de ${cycle.total}`}
                aria-hidden="true"
              />
            </div>
            <div className="hero__cycle-meta">
              <span className="hero__cycle-date">
                <i className="fa-regular fa-calendar"></i>
                <input
                  type="date"
                  value={doc.startDate}
                  onChange={(e) => pdi.updateMeta({ startDate: e.target.value })}
                  aria-label="Início do ciclo"
                  className="hero__date"
                />
              </span>
              <span className="hero__cycle-center">
                dia <strong>{cycle.elapsed}</strong> de {cycle.total} · {cycle.pct}%
              </span>
              <span className="hero__cycle-date">
                <input
                  type="date"
                  value={doc.endDate}
                  onChange={(e) => pdi.updateMeta({ endDate: e.target.value })}
                  aria-label="Fim do ciclo"
                  className="hero__date"
                />
                <i className="fa-regular fa-flag"></i>
              </span>
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
          unavailable={alura.unavailable}
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

      {setupOpen ? (
        <PdiSetupModal
          doc={doc}
          firstTime={setupFirstTime}
          onSave={handleSetupSave}
          onApplyStudyRoutine={handleApplyStudyRoutine}
          onClose={() => { setSetupOpen(false); setSetupFirstTime(false); }}
        />
      ) : null}

      {notifOpen ? (
        <PdiNotificationsModal
          doc={doc}
          supported={notif.supported}
          permission={notif.permission}
          onRequestPermission={notif.requestPermission}
          dailyReminder={notif.dailyReminder}
          onUpdateDailyReminder={notif.updateDailyReminder}
          upcoming={notif.upcoming}
          onClose={() => setNotifOpen(false)}
        />
      ) : null}
    </main>
  );
}

export default PdiView;
