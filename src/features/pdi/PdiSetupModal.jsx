import React, { useEffect, useRef, useState } from 'react';
import { PDI_ACCENTS } from './pdiData';
import HeroFocusTags from './HeroFocusTags';
import HeroIconPicker from './HeroIconPicker';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function in180DaysIso() {
  return new Date(Date.now() + 180 * 86_400_000).toISOString().slice(0, 10);
}

function accentColorOf(accentId) {
  const found = PDI_ACCENTS.find((a) => a.id === accentId);
  return (found || PDI_ACCENTS.find((a) => a.id === 'is-data') || PDI_ACCENTS[0]).color;
}

// Modal de configuração inicial (e re-edição via menu). 8 campos:
// avatar/emoji · título · cargo · departamento · tipo · período · foco · FEEDZ · cor.
// Mantém um draft local e só commit ao "Salvar PDI". Cancelar descarta.
const WEEKDAY_OPTIONS = [
  { idx: 1, short: 'Seg' },
  { idx: 2, short: 'Ter' },
  { idx: 3, short: 'Qua' },
  { idx: 4, short: 'Qui' },
  { idx: 5, short: 'Sex' },
  { idx: 6, short: 'Sáb' },
  { idx: 0, short: 'Dom' },
];

function PdiSetupModal({ doc, onSave, onClose, firstTime = false, onApplyStudyRoutine }) {
  const [draft, setDraft] = useState(() => ({
    title: doc.title || '',
    emoji: doc.emoji || '🚀',
    avatarUrl: doc.avatarUrl || '',
    focusTags: Array.isArray(doc.focusTags) ? doc.focusTags : [],
    startDate: doc.startDate || todayIso(),
    endDate: doc.endDate || in180DaysIso(),
    feedzUrl: doc.feedzUrl || '',
    accentId: doc.accentId || 'is-data',
    // Campos extras só usados quando firstTime — não persistem no doc;
    // são aplicados como side-effects no commit (cria recurring + daily reminder).
    studyTime: '19:00',
    studyDays: [1, 2, 3, 4, 5], // Seg-Sex
    reminderEnabled: true,
    reminderTime: '08:00',
  }));

  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const iconPickerWrapRef = useRef(null);
  const titleRef = useRef(null);

  // Foco inicial no campo título — é o primeiro que a pessoa quer preencher.
  useEffect(() => {
    if (titleRef.current) titleRef.current.focus();
  }, []);

  // Fecha picker ao clicar fora.
  useEffect(() => {
    if (!iconPickerOpen) return undefined;
    const onClick = (e) => {
      if (iconPickerWrapRef.current && !iconPickerWrapRef.current.contains(e.target)) {
        setIconPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [iconPickerOpen]);

  // ESC fecha modal; Cmd/Ctrl+Enter salva.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        commit();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const patch = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  const commit = () => {
    const cleaned = {
      title: draft.title.trim() || 'Meu PDI',
      emoji: draft.emoji,
      avatarUrl: draft.avatarUrl,
      focusTags: (draft.focusTags || []).map((t) => t.trim()).filter(Boolean),
      startDate: draft.startDate,
      endDate: draft.endDate,
      feedzUrl: draft.feedzUrl.trim(),
      accentId: draft.accentId,
    };
    onSave(cleaned);

    // No fluxo "Começar meu PDI", aplica também a rotina de estudos:
    // - vira schedule do primeiro bloco recurring
    // - liga lembrete diário no horário escolhido
    if (firstTime && onApplyStudyRoutine) {
      onApplyStudyRoutine({
        studyTime: draft.studyTime,
        studyDays: draft.studyDays,
        reminderEnabled: !!draft.reminderEnabled,
        reminderTime: draft.reminderTime,
      });
    }
  };

  const toggleStudyDay = (idx) => {
    setDraft((d) => {
      const has = d.studyDays.includes(idx);
      return { ...d, studyDays: has ? d.studyDays.filter((x) => x !== idx) : [...d.studyDays, idx].sort() };
    });
  };

  const accentColor = accentColorOf(draft.accentId);

  return (
    <div className="pdi-setup-backdrop" onMouseDown={onClose}>
      <div
        className="pdi-setup-modal"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ '--pdi-accent': accentColor }}
        role="dialog"
        aria-labelledby="pdi-setup-title"
      >
        <header className="pdi-setup-modal__head">
          <div>
            <h2 id="pdi-setup-title" className="pdi-setup-modal__title">
              {firstTime ? 'Vamos montar seu sistema de estudos' : 'Configurações do PDI'}
            </h2>
            <p className="pdi-setup-modal__subtitle">
              {firstTime
                ? 'Esses dados ficam no cabeçalho do seu PDI. Pode mudar qualquer coisa depois.'
                : 'Edite qualquer campo abaixo. Também dá pra editar inline no cabeçalho.'}
            </p>
          </div>
          <button
            type="button"
            className="pdi-setup-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </header>

        <div className="pdi-setup-modal__body">
          {/* ÍCONE + TÍTULO */}
          <section className="pdi-setup-section">
            <label className="pdi-setup-label" htmlFor="pdi-setup-title-input">
              Título do PDI
            </label>
            <div className="pdi-setup-titlerow">
              <div className="pdi-setup-iconwrap" ref={iconPickerWrapRef}>
                <button
                  type="button"
                  className={`pdi-setup-icon ${draft.avatarUrl ? 'is-img' : ''}`}
                  onClick={() => setIconPickerOpen((v) => !v)}
                  title="Mudar ícone ou foto"
                  aria-label="Mudar ícone ou foto"
                >
                  {draft.avatarUrl ? (
                    <img src={draft.avatarUrl} alt="" />
                  ) : (
                    <span>{draft.emoji || '📄'}</span>
                  )}
                </button>
                {iconPickerOpen ? (
                  <HeroIconPicker
                    emoji={draft.emoji}
                    avatarUrl={draft.avatarUrl}
                    onPickEmoji={(e) => { patch('emoji', e); patch('avatarUrl', ''); }}
                    onSetAvatar={(url) => patch('avatarUrl', url)}
                    onClearAvatar={() => patch('avatarUrl', '')}
                    onClose={() => setIconPickerOpen(false)}
                  />
                ) : null}
              </div>
              <input
                ref={titleRef}
                id="pdi-setup-title-input"
                type="text"
                className="pdi-setup-input pdi-setup-input--title"
                placeholder="Ex: Evolução pessoal — 2026"
                value={draft.title}
                onChange={(e) => patch('title', e.target.value)}
              />
            </div>
          </section>

          {/* PERÍODO */}
          <section className="pdi-setup-section">
            <label className="pdi-setup-label">Período do ciclo</label>
            <div className="pdi-setup-daterow">
              <input
                type="date"
                className="pdi-setup-input pdi-setup-input--date"
                value={draft.startDate}
                onChange={(e) => patch('startDate', e.target.value)}
                aria-label="Início"
              />
              <span className="pdi-setup-arrow">→</span>
              <input
                type="date"
                className="pdi-setup-input pdi-setup-input--date"
                value={draft.endDate}
                onChange={(e) => patch('endDate', e.target.value)}
                aria-label="Fim"
              />
            </div>
          </section>

          {/* ROTINA DE ESTUDOS — só na primeira vez (Começar meu PDI) */}
          {firstTime ? (
            <section className="pdi-setup-section pdi-setup-routine">
              <label className="pdi-setup-label">
                🔁 Rotina de estudos
                <span className="pdi-setup-hint">vamos criar um hábito "Estudar hoje" com esse horário</span>
              </label>
              <div className="pdi-setup-routine-row">
                <span className="pdi-setup-routine-lbl">Horário</span>
                <input
                  type="time"
                  className="pdi-setup-input pdi-setup-input--date"
                  value={draft.studyTime}
                  onChange={(e) => patch('studyTime', e.target.value)}
                  aria-label="Horário do estudo"
                />
              </div>
              <div className="pdi-setup-routine-row">
                <span className="pdi-setup-routine-lbl">
                  Dias
                  <span className="pdi-setup-hint">vazio = todos os dias</span>
                </span>
                <div className="pdi-setup-routine-days">
                  {WEEKDAY_OPTIONS.map((d) => (
                    <button
                      key={d.idx}
                      type="button"
                      className={`pdi-setup-day ${draft.studyDays.includes(d.idx) ? 'is-active' : ''}`}
                      onClick={() => toggleStudyDay(d.idx)}
                      aria-pressed={draft.studyDays.includes(d.idx)}
                    >
                      {d.short}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pdi-setup-routine-row pdi-setup-routine-row--reminder">
                <label className="pdi-setup-reminder-toggle">
                  <input
                    type="checkbox"
                    checked={!!draft.reminderEnabled}
                    onChange={(e) => patch('reminderEnabled', e.target.checked)}
                  />
                  <span>🔔 Receber lembrete diário do PDI</span>
                </label>
                <input
                  type="time"
                  className="pdi-setup-input pdi-setup-input--date"
                  value={draft.reminderTime}
                  disabled={!draft.reminderEnabled}
                  onChange={(e) => patch('reminderTime', e.target.value)}
                  aria-label="Horário do lembrete"
                />
              </div>
              <p className="pdi-setup-routine-hint">
                Os lembretes aparecem no sino do header do Forum Helper.
                Pra notificar mesmo com o FH em background, ative as notificações do navegador depois.
              </p>
            </section>
          ) : null}

          {/* FOCO */}
          <section className="pdi-setup-section">
            <label className="pdi-setup-label">
              Focos do momento <span className="pdi-setup-hint">(opcional, podem ser vários)</span>
            </label>
            <div className="pdi-setup-focuswrap">
              <HeroFocusTags
                tags={draft.focusTags}
                onChange={(next) => patch('focusTags', next)}
              />
            </div>
          </section>

          {/* FEEDZ */}
          <section className="pdi-setup-section">
            <label className="pdi-setup-label" htmlFor="pdi-setup-feedz">
              PDI oficial na FEEDZ <span className="pdi-setup-hint">(opcional)</span>
            </label>
            <input
              id="pdi-setup-feedz"
              type="url"
              className="pdi-setup-input"
              placeholder="https://cursos.alura.com.br/pdi-..."
              value={draft.feedzUrl}
              onChange={(e) => patch('feedzUrl', e.target.value)}
            />
          </section>

          {/* COR */}
          <section className="pdi-setup-section">
            <label className="pdi-setup-label">Cor do PDI</label>
            <div className="pdi-setup-swatches">
              {PDI_ACCENTS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={`pdi-setup-swatch ${a.id === draft.accentId ? 'is-active' : ''}`}
                  style={{ '--swatch': a.color }}
                  onClick={() => patch('accentId', a.id)}
                  title={a.label}
                  aria-label={`Cor ${a.label}`}
                >
                  <span className="pdi-setup-swatch-lbl">{a.label}</span>
                </button>
              ))}
            </div>
          </section>
        </div>

        <footer className="pdi-setup-modal__foot">
          <button type="button" className="pdi-setup-btn pdi-setup-btn--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="pdi-setup-btn pdi-setup-btn--primary" onClick={commit}>
            {firstTime ? 'Criar meu PDI' : 'Salvar'}
          </button>
        </footer>
      </div>
    </div>
  );
}

export default PdiSetupModal;
