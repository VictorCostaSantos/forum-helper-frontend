import React, { useMemo, useState } from 'react';
import ActivityRow from './ActivityRow';
import ActivityDrawer from './ActivityDrawer';
import AllocationCentral from './AllocationCentral';
import ThermometerSidebar from './ThermometerSidebar';
import UserAvatar from '../../shared/components/UserAvatar';
import { brandFor, brandImageStyle } from './activityBrands';
import { useAllocation } from './useAllocation';
import { useTeamAvatars } from './useTeamAvatars';
import { addDays, formatWeekRange, mondayOf } from './dateHelpers';
import { avatarFallbackUrl, isAdmin, isPlaceholder, TEAM } from './team';

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
  // Banner dismissal — fica fechado até o conteúdo MUDAR (key derivada da
  // contagem + chips ativos). Quando algo novo cai, reabre automaticamente.
  const [bannerDismissedAt, setBannerDismissedAt] = useState(null);

  // Map { username -> avatarUrl } com preload (backend) + fallback (ui-avatars).
  // Mesma estratégia do Mural. Sempre populado pra todo TEAM no 1º render.
  const avatarsMap = useTeamAvatars();

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

  /*
    Sumário LOCAL (mesma fonte do termômetro): garante que o banner conte
    o mesmo número de vagos/sobrecarregados que o sidebar mostra. Antes
    usávamos useAllocationSummary (cache global compartilhado c/ header),
    mas o TTL/inflight do cache fazia o banner ficar defasado por alguns
    segundos depois de uma edição — o usuário via o termômetro com 2
    pessoas em 110% e o banner dizendo "1 pessoa". Aqui não tem latência.
  */
  const summary = useMemo(() => {
    const vagoStations = [];
    for (const st of stations) {
      if (!st.currentShift) continue;
      const list = Array.isArray(st.currentShift.responsaveis) ? st.currentShift.responsaveis : [];
      const real = list.filter((u) => !isPlaceholder(u));
      if (real.length === 0) vagoStations.push(st.name);
    }
    const dangerUsers = [];
    for (const m of TEAM) {
      const info = loadByUser.get(m.username);
      if (info && info.pct >= 90) {
        dangerUsers.push({ username: m.username, displayName: m.displayName, pct: info.pct });
      }
    }
    const total = vagoStations.length + dangerUsers.length;
    return {
      vagoStations,
      vagoCount: vagoStations.length,
      dangerUsers,
      dangerCount: dangerUsers.length,
      total,
      tone: vagoStations.length > 0 ? 'danger' : (dangerUsers.length > 0 ? 'warn' : 'ok'),
    };
  }, [stations, loadByUser]);

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
      window.__showToast?.('Próxima ocorrência criada.', 'success');
    } catch (e) {
      window.__showToast?.(e?.message || 'Erro ao criar ocorrência.', 'error');
    }
  };


  return (
    <main className="allocation-view">
      <div className="alloc-shell">

        <header className="alloc-shell__header">
          <div>
            <h1 className="alloc-shell__title">Alocações Operacionais</h1>
            <p className="alloc-shell__subtitle">
              Visão das atividades e da carga da equipe de suporte.
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
        {(() => {
          // Assinatura do banner atual: muda quando entra/sai vago ou
          // sobrecarga. Comparada com bannerDismissedAt — se mudou, reabre.
          const bannerKey = [
            ...summary.vagoStations,
            ...summary.dangerUsers.map((u) => `${u.username}:${u.pct}`),
          ].join('|');
          const showBanner = summary.total > 0 && bannerDismissedAt !== bannerKey;
          return showBanner ? (
          <section
            className={`alloc-warnings alloc-warnings--${summary.tone}`}
            role="status"
            aria-label="Avisos da alocação"
          >
            <header className="alloc-warnings__head">
              <div className="alloc-warnings__head-left">
                <span className="alloc-warnings__icon" aria-hidden="true">
                  <i className="fa-solid fa-triangle-exclamation"></i>
                </span>
                <div>
                  <h3 className="alloc-warnings__title">
                    {summary.total === 1
                      ? '1 aviso pedindo atenção'
                      : `${summary.total} avisos pedindo atenção`}
                  </h3>
                  <p className="alloc-warnings__desc">
                    {summary.vagoCount > 0 && summary.dangerCount > 0
                      ? `${summary.vagoCount} atividade(s) sem ninguém e ${summary.dangerCount} pessoa(s) acima do limite saudável.`
                      : summary.vagoCount > 0
                        ? `${summary.vagoCount} atividade(s) sem ninguém esta semana.`
                        : `${summary.dangerCount} pessoa(s) acima do limite saudável de alocação.`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="alloc-warnings__close"
                onClick={() => setBannerDismissedAt(bannerKey)}
                title="Ignorar até a próxima mudança"
                aria-label="Fechar aviso"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </header>

            <div className="alloc-warnings__list">
              {summary.vagoStations.map((name) => {
                const brand = brandFor(name);
                return (
                  <button
                    key={`vago-${name}`}
                    type="button"
                    className="alloc-warnings__item"
                    onClick={() => {
                      const el = document.querySelector(`[data-station-name="${CSS.escape(name)}"]`);
                      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                    title={`Ir pro card "${name}"`}
                  >
                    <span
                      className="alloc-warnings__item-avatar alloc-warnings__item-avatar--activity"
                      style={{ background: brand.image ? brand.color : `linear-gradient(135deg, ${brand.color}, ${brand.color}AA)` }}
                      aria-hidden="true"
                    >
                      {brand.image ? (
                        <img src={brand.image} alt="" className="alloc-warnings__item-avatar-pic" style={brandImageStyle(brand)} />
                      ) : (
                        <i className={brand.icon}></i>
                      )}
                    </span>
                    <span className="alloc-warnings__item-text">
                      <b>{name}</b>
                      <span className="alloc-warnings__item-meta">esta semana sem alocação</span>
                    </span>
                    <span className="alloc-warnings__item-status alloc-warnings__item-status--text">vaga</span>
                  </button>
                );
              })}
              {summary.dangerUsers.map((u) => (
                <button
                  key={`danger-${u.username}`}
                  type="button"
                  className="alloc-warnings__item"
                  onClick={() => setFocusUser(u.username)}
                  title={`Filtrar pelas atividades de ${u.displayName}`}
                >
                  <span className="alloc-warnings__item-avatar alloc-warnings__item-avatar--person" aria-hidden="true">
                    <UserAvatar
                      name={u.displayName}
                      src={avatarsMap?.get?.(u.username) || avatarFallbackUrl(u.username)}
                      size={32}
                      cacheKey={u.username}
                      className="alloc-warnings__item-avatar-img"
                    />
                  </span>
                  <span className="alloc-warnings__item-text">
                    <b>{u.displayName}</b>
                    <span className="alloc-warnings__item-meta">carga semanal alta</span>
                  </span>
                  <span className={`alloc-warnings__item-status ${u.pct >= 100 ? '' : 'alloc-warnings__item-status--warn'}`}>
                    {u.pct}%
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : null;
        })()}

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
