import React, { useEffect, useRef, useState } from 'react';

// Editor inline de horário pra blocos recorrentes.
// schedule = { days: number[], time: 'HH:MM' } | null
//   days: 0=Domingo, 1=Segunda, ..., 6=Sábado. Vazio = todos os dias.
//   time: 24h, obrigatório quando há schedule.

const WEEKDAYS = [
  { idx: 1, short: 'Seg', long: 'Segunda' },
  { idx: 2, short: 'Ter', long: 'Terça' },
  { idx: 3, short: 'Qua', long: 'Quarta' },
  { idx: 4, short: 'Qui', long: 'Quinta' },
  { idx: 5, short: 'Sex', long: 'Sexta' },
  { idx: 6, short: 'Sáb', long: 'Sábado' },
  { idx: 0, short: 'Dom', long: 'Domingo' },
];

function BlockSchedulePopover({ schedule, onChange, onClose }) {
  const [time, setTime] = useState(schedule?.time || '09:00');
  const [days, setDays] = useState(Array.isArray(schedule?.days) ? schedule.days : []);
  const ref = useRef(null);

  useEffect(() => {
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const onEsc = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [onClose]);

  const toggleDay = (idx) => {
    setDays((curr) => curr.includes(idx) ? curr.filter((d) => d !== idx) : [...curr, idx].sort());
  };

  const save = () => {
    if (!time) return;
    onChange({ days, time });
    onClose();
  };

  const remove = () => {
    onChange(null);
    onClose();
  };

  return (
    <div className="block-schedule-pop" ref={ref} onClick={(e) => e.stopPropagation()}>
      <div className="block-schedule-pop__head">
        <i className="fa-solid fa-bell"></i>
        <span>Horário do hábito</span>
      </div>

      <label className="block-schedule-pop__row">
        <span className="block-schedule-pop__lbl">Horário</span>
        <input
          type="time"
          className="block-schedule-pop__time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          autoFocus
        />
      </label>

      <div className="block-schedule-pop__row block-schedule-pop__row--col">
        <span className="block-schedule-pop__lbl">
          Dias da semana
          <span className="block-schedule-pop__hint">vazio = todos os dias</span>
        </span>
        <div className="block-schedule-pop__days">
          {WEEKDAYS.map((d) => (
            <button
              key={d.idx}
              type="button"
              className={`block-schedule-pop__day ${days.includes(d.idx) ? 'is-active' : ''}`}
              onClick={() => toggleDay(d.idx)}
              title={d.long}
              aria-pressed={days.includes(d.idx)}
            >
              {d.short}
            </button>
          ))}
        </div>
      </div>

      <div className="block-schedule-pop__foot">
        {schedule ? (
          <button
            type="button"
            className="block-schedule-pop__btn block-schedule-pop__btn--danger"
            onClick={remove}
          >
            <i className="fa-solid fa-trash"></i> Remover
          </button>
        ) : <span />}
        <div className="block-schedule-pop__foot-right">
          <button
            type="button"
            className="block-schedule-pop__btn block-schedule-pop__btn--ghost"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="block-schedule-pop__btn block-schedule-pop__btn--primary"
            onClick={save}
            disabled={!time}
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

// Helpers exportados pra outros módulos (useNotifications, badges)
export const SCHEDULE_DAYS = WEEKDAYS;

export function formatScheduleShort(schedule) {
  if (!schedule || !schedule.time) return '';
  const { days = [], time } = schedule;
  if (days.length === 0 || days.length === 7) return `Todo dia · ${time}`;
  const dayShorts = WEEKDAYS
    .filter((d) => days.includes(d.idx))
    .map((d) => d.short);
  return `${dayShorts.join('/')} · ${time}`;
}

export default BlockSchedulePopover;
