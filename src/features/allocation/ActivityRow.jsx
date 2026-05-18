import React from 'react';
import Facepile from './Facepile';
import RotatingLabel from './RotatingLabel';
import { brandContainerStyle, brandFor, brandImageStyle } from './activityBrands';
import {
  detectCycle,
  formatPeriodCompact,
  formatPeriodRelative,
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
  // Label curto pra tooltip do botão "próxima ocorrência" (mais terse).
  const cycleShort = cycle === 'weekly' ? 'semanal'
    : cycle === 'biweekly' ? 'quinzenal'
    : cycle === 'monthly' ? 'mensal'
    : null;

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
        currentShift
          && (currentShift.responsaveis || []).length > 0
          && (currentShift.responsaveis || []).every(isPlaceholder)
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
          style={brandContainerStyle(brand)}
          aria-hidden="true"
        >
          {brand.image ? (
            <img
              src={brand.image}
              alt=""
              className="alloc-station__icon-img"
              style={brandImageStyle(brand)}
            />
          ) : (
            <i className={brand.icon}></i>
          )}
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

      {/* Atalho "Próxima ocorrência" — aparece quando NÃO tem nextShift
          mas a estação é cíclica. Só admin. */}
      {!nextShift && cycle && onExtendStation && userIsAdmin ? (
        <button
          type="button"
          className="alloc-station__extend"
          onClick={() => onExtendStation(station)}
          title={`Criar próxima ocorrência ${cycleShort || ''}`.trim()}
        >
          <i className="fa-solid fa-rotate-right"></i>
          Próxima ocorrência
        </button>
      ) : null}

      {/* 3. PRÓXIMO PLANTÃO — só aparece se houver próxima instância
            agendada. Mostra a DATA direta (sem rotating com "Próxima
            semana", que confundia visualmente). */}
      {nextShift ? (
        <div className="alloc-station__next">
          <div className="alloc-station__next-label">
            <span>Próximo · </span>
            <span>{formatPeriodCompact(nextShift)}</span>
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
