import React, { useMemo, useState } from 'react';
import ActivityRow from './ActivityRow';
import ActivityDrawer from './ActivityDrawer';
import AllocationCentral from './AllocationCentral';
import ThermometerSidebar from './ThermometerSidebar';
import { useAllocation } from './useAllocation';
import { useAllocationSummary } from './useAllocationSummary';
import { useTeamAvatars } from './useTeamAvatars';
import { addDays, formatWeekRange, mondayOf } from './dateHelpers';
import { isAdmin } from './team';

/*
  Painel de Alocação — Flight Board.

  Grid principal: lista de estações (1fr) + termômetro de carga (300px sticky).
  Cada estação agrupa todas as instâncias de UMA atividade (mesmo nome).
*/
function AllocationView() {
  const currentUsername = (localStorage.getItem('forumHelperUsername') || '').trim();

  const [anchor, setAnchor] = useState(() => mondayOf(new Date()));
  // Filtro por pessoa: quando setado, esmaece estações onde a pessoa NÃO
  // está. Toggle: click no row do termômetro liga/desliga.
  const [focusUser, setFocusUser] = useState(null);

  // Map { username -> avatarUrl } com preload (backend) + fallback (ui-avatars).
  // Mesma estratégia do Mural. Sempre populado pra todo TEAM no 1º render.
  const avatarsMap = useTeamAvatars();
  const summary = useAllocationSummary();

  const [drawer, setDrawer] = useState({
    open: false,
    mode: 'create',
    activity: null,
    prefill: null,
    sameNameCount: 1,
  });

  const {
    loading,
    error,
    monday,
    stations,
    loadByUser,
    stationsByUser,
    reload,
    createActivity,
    editActivity,
    editStation,
    removeActivity,
    togglePerson,
    extendStation,
    deleteStationFuture,
    deleteStation,
  } = useAllocation(anchor);

  const [centralOpen, setCentralOpen] = useState(false);
  const userIsAdmin = isAdmin(currentUsername);

  const weekLabel = useMemo(() => formatWeekRange(monday), [monday]);

  const goToWeek  = (delta) => setAnchor((curr) => addDays(curr, delta));
  const goToToday = () => setAnchor(mondayOf(new Date()));

  const openCreate = () => {
    setDrawer({ open: true, mode: 'create', activity: null, prefill: null });
  };

  // Edição via clique no nome da estação: abre o drawer com a instância
  // "reference" e expõe quantas ocorrências há na estação inteira (pra o
  // drawer mostrar o toggle "aplicar em todas").
  const openEditStation = (station) => {
    const target = station.currentShift || station.nextShift || station.instances[0];
    if (!target) return;
    setDrawer({
      open: true,
      mode: 'edit',
      activity: target,
      prefill: null,
      sameNameCount: station.instances.length,
    });
  };

  const closeDrawer = () => setDrawer((d) => ({ ...d, open: false }));

  // "Virar plantão": cria 1 nova ocorrência um ciclo à frente da última.
  const handleExtend = async (station) => {
    try {
      await extendStation(station.name, currentUsername);
      window.__showToast?.('Próximo plantão criado.', 'success');
    } catch (e) {
      window.__showToast?.(e?.message || 'Erro ao virar plantão.', 'error');
    }
  };


  return (
    <main className="allocation-view">
      <div className="alloc-shell">

        <header className="alloc-shell__header">
          <div>
            <h1 className="alloc-shell__title">Alocações Operacionais</h1>
            <p className="alloc-shell__subtitle">
              Visão de plantões e carga de trabalho da equipe de suporte.
            </p>
          </div>

          <div className="alloc-shell__actions">
            <div className="alloc-period">
              <button
                type="button"
                onClick={() => goToWeek(-7)}
                aria-label="Semana anterior"
                title="Semana anterior"
              >
                <i className="fa-solid fa-chevron-left"></i>
              </button>
              <span>{weekLabel}</span>
              <button
                type="button"
                onClick={() => goToWeek(7)}
                aria-label="Próxima semana"
                title="Próxima semana"
              >
                <i className="fa-solid fa-chevron-right"></i>
              </button>
              <button
                type="button"
                onClick={goToToday}
                className="alloc-period__today"
              >
                Hoje
              </button>
            </div>
            {userIsAdmin ? (
              <button
                type="button"
                className="alloc-shell__cta alloc-shell__cta--ghost"
                onClick={() => setCentralOpen(true)}
                title="Gerenciar atividades (admin)"
              >
                <i className="fa-solid fa-sliders"></i>
                Gerenciar
              </button>
            ) : null}
            <button
              type="button"
              className="alloc-shell__cta"
              onClick={openCreate}
            >
              <i className="fa-solid fa-plus"></i>
              Nova atividade
            </button>
          </div>
        </header>

        {error ? (
          <div className="alloc-error">
            <i className="fa-solid fa-circle-exclamation"></i>
            <span>{error}</span>
            <button type="button" onClick={reload}>Tentar de novo</button>
          </div>
        ) : null}

        {/* Banner de avisos — só aparece quando há vago ou sobrecarga.
            Chips clicáveis: vago foca o filtro pelo termômetro indireto
            (não dá pra "filtrar por vago" hoje, então só faz scrollIntoView
            do primeiro card vago); danger filtra pela pessoa em sobrecarga. */}
        {summary.total > 0 ? (
          <div className={`alloc-warnings alloc-warnings--${summary.tone}`} role="status">
            <i className="fa-solid fa-triangle-exclamation alloc-warnings__icon"></i>
            <span className="alloc-warnings__label">Atenção:</span>
            <div className="alloc-warnings__chips">
              {summary.vagoStations.map((name) => (
                <button
                  key={`vago-${name}`}
                  type="button"
                  className="alloc-warnings__chip alloc-warnings__chip--danger"
                  onClick={() => {
                    const el = document.querySelector(`[data-station-name="${CSS.escape(name)}"]`);
                    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                  title={`Plantão vago: ${name}`}
                >
                  <i className="fa-solid fa-circle-exclamation"></i>
                  {name} · vago
                </button>
              ))}
              {summary.dangerUsers.map((u) => (
                <button
                  key={`danger-${u.username}`}
                  type="button"
                  className="alloc-warnings__chip alloc-warnings__chip--warn"
                  onClick={() => setFocusUser(u.username)}
                  title={`${u.displayName} em ${u.pct}% de carga`}
                >
                  <i className="fa-solid fa-bolt"></i>
                  {u.displayName.split(' ')[0]} · {u.pct}%
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className={`alloc-shell__grid ${loading ? 'is-loading' : ''}`}>
          <section className="alloc-stations" aria-label="Estações de alocação">
            {stations.length === 0 && !loading ? (
              <div className="alloc-stations__empty">
                <i className="fa-regular fa-folder-open"></i>
                <p>Nenhuma atividade cadastrada ainda.</p>
                <button type="button" className="alloc-shell__cta" onClick={openCreate}>
                  <i className="fa-solid fa-plus"></i>
                  Criar a primeira
                </button>
              </div>
            ) : null}

            {stations.map((st) => {
              const involvesFocusUser = focusUser
                ? [st.currentShift, st.nextShift]
                    .filter(Boolean)
                    .some((s) => Array.isArray(s.responsaveis) && s.responsaveis.includes(focusUser))
                : true;
              return (
                <ActivityRow
                  key={st.id}
                  station={st}
                  currentUsername={currentUsername}
                  anchorMonday={monday}
                  avatarsMap={avatarsMap}
                  dimmed={Boolean(focusUser) && !involvesFocusUser}
                  highlightedUser={focusUser}
                  loadByUser={loadByUser}
                  stationsByUser={stationsByUser}
                  onEditStation={openEditStation}
                  onExtendStation={handleExtend}
                  onTogglePerson={togglePerson}
                />
              );
            })}
          </section>

          <ThermometerSidebar
            loadByUser={loadByUser}
            avatarsMap={avatarsMap}
            focusUser={focusUser}
            onFocusUser={setFocusUser}
          />
        </div>

        <AllocationCentral
          open={centralOpen}
          stations={stations}
          currentUsername={currentUsername}
          onClose={() => setCentralOpen(false)}
          onUpdateStation={editStation}
          onDeleteStationFuture={deleteStationFuture}
          onDeleteStation={deleteStation}
          onExtendStation={handleExtend}
        />

        <ActivityDrawer
          open={drawer.open}
          mode={drawer.mode}
          activity={drawer.activity}
          prefill={drawer.prefill}
          currentUsername={currentUsername}
          sameNameCount={drawer.sameNameCount}
          onClose={closeDrawer}
          onCreate={createActivity}
          onUpdate={editActivity}
          onUpdateStation={editStation}
          onDelete={removeActivity}
        />

      </div>
    </main>
  );
}

export default AllocationView;
