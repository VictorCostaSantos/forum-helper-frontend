import React from 'react';
import Facepile from './Facepile';
import RotatingLabel from './RotatingLabel';
import { brandFor } from './activityBrands';
import {
  detectCycle,
  formatPeriodCompact,
  formatPeriodRelative,
  isPerennial,
} from './dateHelpers';
import { isAdmin, isPlaceholder } from './team';

/*
  Linha "estação" do Flight Board.

  Layout (esquerda → direita):
    1. Identidade: ícone com cor da marca + nome + subtítulo (Perene/Demanda Spot/custom)
    2. Plantão Atual: data + Facepile + botão "+" (destaque)
    3. Próximo Plantão: data + Facepile rebaixada (opacity 0.5, grayscale)
*/
function ActivityRow({
  station,
  currentUsername,
  anchorMonday,            // segunda da semana selecionada — pra labels relativos
  avatarsMap = null,
  dimmed = false,
  highlightedUser = null,
  loadByUser = null,
  stationsByUser = null,
  onEditStation,
  onExtendStation,
  onTogglePerson,
}) {
  const { name, currentShift, nextShift, reference, instances } = station;
  const brand = brandFor(name);
  const userIsAdmin = isAdmin(currentUsername);
  const cycle = detectCycle(instances || []);
  const cycleLabel = cycle === 'weekly' ? 'semanal'
    : cycle === 'biweekly' ? 'quinzenal'
    : cycle === 'monthly' ? 'mensal'
    : null;

  // Subtítulo enriquecido — pedaços separados por "·".
  // Ex: "Moderação · quinzenal · 6 ocorrências"
  const subtitleParts = (() => {
    const parts = [];
    if (reference && isPerennial(reference)) {
      parts.push('Fixo');
    } else if (brand.subtitle) {
      parts.push(brand.subtitle);
    } else {
      parts.push('Pontual');
    }
    if (cycleLabel) parts.push(cycleLabel);
    const count = (instances || []).length;
    if (count > 1) parts.push(`${count} ocorrências`);
    return parts;
  })();

  // Permissão de INTERAGIR com a estação. Estamos sempre liberados pra abrir
  // o popover/clicar — a regra fina (admin vê todos, demais só si mesmo) é
  // aplicada DENTRO do Facepile/Popover. canManage aqui é só uma porta
  // semântica: "tem alguém logado e a instância existe?".
  const canManageCurrent = Boolean(currentUsername);
  const canManageNext    = Boolean(currentUsername);

  const handleEdit = () => onEditStation?.(station);

  return (
    <article
      className={`alloc-station ${dimmed ? 'is-dimmed' : ''} ${
        currentShift && (currentShift.responsaveis || []).every(isPlaceholder)
          ? 'is-vago'
          : ''
      }`}
      data-station-name={name}
      data-pending={Boolean(reference?._optimistic)}
    >
      {/* 1. IDENTIDADE */}
      <div className="alloc-station__identity">
        <div
          className="alloc-station__icon"
          style={{ color: brand.color, borderColor: `${brand.color}33`, background: `${brand.color}14` }}
          aria-hidden="true"
        >
          <i className={brand.icon}></i>
        </div>
        <div className="alloc-station__id-text">
          <button
            type="button"
            className="alloc-station__title"
            onClick={handleEdit}
            title="Editar atividade"
          >
            {name}
          </button>
          <div className="alloc-station__sub">
            {subtitleParts.map((part, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 ? <span className="alloc-station__sub-sep" aria-hidden="true">·</span> : null}
                <span>{part}</span>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* 2. PLANTÃO ATUAL — alterna entre "Esta semana" e a data real
            automaticamente (a cada 4s) com fade. */}
      <div className="alloc-station__current">
        <div className={`alloc-station__date ${!currentShift ? 'is-empty' : ''}`}>
          <i className="fa-regular fa-calendar"></i>
          {currentShift ? (
            <RotatingLabel
              labels={[
                formatPeriodRelative(currentShift, anchorMonday),
                formatPeriodCompact(currentShift),
              ]}
            />
          ) : (
            'Sem alocação'
          )}
        </div>
        <Facepile
          usernames={currentShift?.responsaveis || []}
          variant="current"
          avatarsMap={avatarsMap}
          highlightedUser={highlightedUser}
          loadByUser={loadByUser}
          stationsByUser={stationsByUser}
          currentUsername={currentUsername}
          canManage={Boolean(currentShift) && canManageCurrent}
          onTogglePerson={(u) => currentShift && onTogglePerson?.(currentShift.id, u)}
          emptyLabel={currentShift ? 'Ninguém ainda' : null}
        />
      </div>

      {/* Atalho "Virar plantão" — aparece quando NÃO tem nextShift mas a
          estação é cíclica (já tem padrão detectado). SÓ admin pode usar
          (decisão pra evitar que responsável crie ciclos descontroladamente). */}
      {!nextShift && cycle && onExtendStation && userIsAdmin ? (
        <button
          type="button"
          className="alloc-station__extend"
          onClick={() => onExtendStation(station)}
          title={`Criar próxima ocorrência ${cycleLabel}`}
        >
          <i className="fa-solid fa-rotate-right"></i>
          Virar plantão
        </button>
      ) : null}

      {/* 3. PRÓXIMO PLANTÃO — só aparece se houver próxima instância agendada.
            Atividades cíclicas vão preencher isso automaticamente. */}
      {nextShift ? (
        <div className="alloc-station__next">
          <div className="alloc-station__next-label">
            <span>Próximo · </span>
            <RotatingLabel
              labels={[
                formatPeriodRelative(nextShift, anchorMonday),
                formatPeriodCompact(nextShift),
              ]}
            />
          </div>
          <Facepile
            usernames={Array.isArray(nextShift.responsaveis) ? nextShift.responsaveis : []}
            variant="next"
            avatarsMap={avatarsMap}
            highlightedUser={highlightedUser}
            loadByUser={loadByUser}
            stationsByUser={stationsByUser}
            currentUsername={currentUsername}
            canManage={canManageNext}
            onTogglePerson={(u) => onTogglePerson?.(nextShift.id, u)}
            emptyLabel="—"
          />
        </div>
      ) : null}
    </article>
  );
}

export default ActivityRow;
