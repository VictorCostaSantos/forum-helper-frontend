import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchTopics,
  fetchFocusData,
  claimTopic,
  unclaimTopic,
  fetchRescueQueue,
  fetchAvatarFromBackend,
} from '../../api/apiService';
import { useTopics } from '../../shared/context/TopicsContext';
import { useToast } from '../../shared/ui/ToastProvider';
import { fetchUpcomingEvents } from '../../shared/notifications/clickupSync';
import EventsBanner from '../events/EventsBanner';
import RescuePanel from './RescuePanel';
import FocusBanner from './FocusBanner';
import UserAvatar from '../../shared/components/UserAvatar';
import { computeFocus } from './focusEngine';
import {
  CATEGORY_BUTTONS,
  PRIORITY_FILTERS,
  categoryClassMap,
  priorityClassMap,
  normalizeCategory,
  parseAgeToDays,
  normalizeTopic,
  getClaimedName,
} from './helpers';

/*
  Card individual de tópico, memoizado.
  Contexto: TopicsView faz polling silencioso a cada 15s e re-cria o array
  de tópicos. Sem memo, todos os cards re-renderizavam a cada ciclo. Com
  memo + props estáveis (handlers em useCallback no parent), só re-renderiza
  o card cujo dado mudou ou cujo loading state (claiming/releasing) mexeu.
*/
const TopicCard = memo(function TopicCard({
  topic,
  index,
  username,
  isClaiming,
  isReleasing,
  onClaim,
  onRelease,
}) {
  const isMine = topic.isClaimed && getClaimedName(topic.claimedBy) === username;
  const catClass = categoryClassMap[topic.category] || 'default';
  const priorityClass = priorityClassMap[topic.priority] || 'default';
  const bbMarker = 'Tópico privado de empresa';
  const isBb = topic.title.includes(bbMarker);
  const title = topic.title.replace(bbMarker, '').trim();
  // Sem fallback ui-avatars.com aqui — UserAvatar gera fallback local quando
  // a URL é vazia ou a imagem 404. Evita dependência externa que pode estar
  // bloqueada/lenta e tira o "Avatar" cortado feio.
  const authorImage = topic.authorImage || '';
  const authorName = getClaimedName(topic.claimedBy) || topic.category || 'Autor';
  const claimedAvatarSrc = topic.claimedBy?.avatar || '';
  const claimedName = getClaimedName(topic.claimedBy) || 'Em atendimento';

  return (
    <div
      data-topic-link={topic.link}
      className={`topic-card ${catClass} ${priorityClass} ${topic.ageInDays >= 1 ? 'is-sla' : ''} ${topic.ageInDays >= 2 ? 'is-urgent' : ''}`}
      style={{ animationDelay: `${Math.min(index, 12) * 50}ms` }}
    >
      <div className="card-header">
        <span className="category-tag">{topic.category}</span>
        <div className="card-tags-right">
          {isBb ? <span className="bb-tag">BB</span> : null}
          <span className="priority-tag">{topic.priority}</span>
        </div>
      </div>
      <div className="card-body">
        <h2>
          <a href={topic.link} target="_blank" rel="noreferrer">
            {title || 'Sem título'}
          </a>
        </h2>
        <p className="topic-age">{topic.daysText || 'Sem informação de idade'}</p>
      </div>
      <div className="card-footer">
        <div className="author-info">
          <UserAvatar src={authorImage} name={authorName} size={32} />
        </div>
        {topic.isClaimed ? (
          <div
            className={`claimed-by ${isMine ? 'is-mine' : ''}`}
            title={isMine ? 'Liberar tópico' : `Em atendimento por ${getClaimedName(topic.claimedBy)}`}
            onClick={isMine && !isReleasing ? () => onRelease(topic) : undefined}
            style={isMine ? { cursor: 'pointer' } : undefined}
          >
            {isReleasing ? (
              <div className="spinner"></div>
            ) : (
              <UserAvatar
                src={claimedAvatarSrc}
                name={claimedName}
                cacheKey={claimedName}
                size={36}
              />
            )}
          </div>
        ) : (
          <button
            className={`action-button claim-button ${isClaiming ? 'is-loading' : ''}`}
            onClick={() => onClaim(topic)}
            disabled={isClaiming}
            title="Pegar"
          >
            <span className="icon-add">
              <i className="fas fa-plus"></i>
            </span>
            <span className="icon-spinner">
              <div className="spinner"></div>
            </span>
          </button>
        )}
      </div>
    </div>
  );
});

function TopicsView({ username: initialUsername }) {
  const [username, setUsername] = useState(initialUsername || localStorage.getItem('forumHelperUsername') || '');
  const { topics, setTopics, region, setRegion } = useTopics();
  const { showToast } = useToast();
  const [focusCategories, setFocusCategories] = useState([]);

  useEffect(() => {
    setUsername(initialUsername || localStorage.getItem('forumHelperUsername') || '');
  }, [initialUsername]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [onlyMine, setOnlyMine] = useState(false);
  const [sort, setSort] = useState('newest');
  const [priorityFilter, setPriorityFilter] = useState('Todos');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [activeTab, setActiveTab] = useState('topics');
  const [claimingLink, setClaimingLink] = useState(null);
  const [releasingLink, setReleasingLink] = useState(null);
  // Guarda o título do último alerta dispensado. Quando a situação muda
  // (título novo), o banner volta — então dismiss não silencia futuros alertas.
  const [dismissedTitle, setDismissedTitle] = useState(null);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  // Conta tópicos do "Fora do Radar" que precisam de intervenção da IA.
  // Usado pra alimentar o badge da master tab — quem está em "Tópicos em
  // aberto" precisa ver imediatamente se há algo urgente do outro lado.
  const [rescueAlertCount, setRescueAlertCount] = useState(0);

  const loadFocus = useCallback(async () => {
    try {
      const focusData = await fetchFocusData();
      const row = focusData.find((item) => item.nome?.trim().toLowerCase() === username.trim().toLowerCase());
      const categories = [];
      if (row?.foco1) categories.push(row.foco1);
      if (row?.foco2) categories.push(row.foco2);
      setFocusCategories(categories);
    } catch (err) {
      console.warn('Falha ao carregar foco:', err);
    }
  }, [username]);

  const loadTopics = useCallback(async ({ silent = false } = {}) => {
    if (!username) return;
    setError(null);
    if (!silent) setLoading(true);
    try {
      const rawTopics = await fetchTopics(region);
      const normalized = rawTopics.map(normalizeTopic);
      setTopics(normalized);
    } catch (err) {
      console.error('Erro ao buscar tópicos:', err);
      if (!silent) setError('Não foi possível carregar os tópicos. Tente novamente.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [region, username, setTopics]);

  useEffect(() => {
    if (!username) return;
    loadFocus();
    loadTopics({ silent: topics.length > 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadFocus, loadTopics, username]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (username && activeTab === 'topics') {
        loadTopics({ silent: true });
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [loadTopics, username, activeTab]);

  // Polling leve da fila de resgate só pra atualizar o badge da master tab.
  // Roda mesmo na aba "topics" — esse é justamente o cenário onde o usuário
  // precisa do alerta visual (ele está em outra aba e não vê o conteúdo).
  // Intervalo maior (45s) pra não martelar a API.
  useEffect(() => {
    if (!username) return undefined;
    let alive = true;
    const refresh = async () => {
      try {
        const payload = await fetchRescueQueue();
        if (!alive) return;
        const topicsList = payload?.topics || [];
        const needsAction = topicsList.filter((t) => {
          if (!t.ia_analysis || t.rescue_status === 'ERROR') return false;
          if ((t.ia_analysis.motivo_intervencao || '').includes('Falha')) return false;
          return t.ia_analysis.intervencao_necessaria === true;
        }).length;
        setRescueAlertCount(needsAction);
      } catch {
        // silencia — badge fica no último valor conhecido.
      }
    };
    refresh();
    const id = setInterval(refresh, 45000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [username]);

  // Carrega eventos próximos do Radar (ClickUp). Sem token = silencia.
  // Refresh leve a cada 5 min — eventos não mudam minuto a minuto.
  // Suporta ?testEvent=santander|oracle|google|alura na URL pra forçar
  // um banner fake (debugging visual sem depender de evento real).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const testBrand = params.get('testEvent');
    if (testBrand) {
      const fixtures = {
        santander: { name: 'Curso Santander: Imersão Digital 2026', daysAhead: 1 },
        oracle: { name: 'Grupo 10 - Oracle One Latam', daysAhead: 5 },
        google: { name: 'Imersão IA - Google', daysAhead: 12 },
        alura: { name: 'Imersão: Profissional Java', daysAhead: 20 },
        // Live: começou há 2h, termina em 4h. Pra debug visual do estado AO VIVO.
        live: { name: 'Imersão: Profissional Java AO VIVO', daysAhead: -2 / 24, isLive: true, hoursLeft: 4 },
      };
      const fix = fixtures[testBrand.toLowerCase()] || fixtures.santander;
      const startMs = Date.now() + fix.daysAhead * 24 * 3600 * 1000;
      // ID único por reload pra escapar de dismiss prévios persistidos em
      // sessionStorage (`fhEventsBannerDismissed`).
      setUpcomingEvents([{
        id: `test-event-${testBrand}-${Date.now()}`,
        name: fix.name,
        startMs,
        endMs: fix.isLive ? Date.now() + (fix.hoursLeft || 1) * 3600 * 1000 : null,
        isLive: !!fix.isLive,
        url: 'https://app.clickup.com/3148001/v/c/30271-247533',
      }]);
      return undefined;
    }

    const token = localStorage.getItem('clickupToken');
    if (!token) return undefined;

    let alive = true;
    const load = async () => {
      const events = await fetchUpcomingEvents(token);
      if (alive) setUpcomingEvents(events);
    };
    load();
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, []);

  const toggleCategory = useCallback((category) => {
    if (category === 'Todas') {
      setSelectedCategories([]);
      return;
    }
    setSelectedCategories((current) => {
      const next = current.includes(category)
        ? current.filter((item) => item !== category)
        : [...current, category].slice(-2);
      return next;
    });
  }, []);

  // Sugestão proativa: olha tópicos + área do usuário e decide o foco.
  // Veja focusEngine.js para a lógica de pontuação.
  const focus = useMemo(
    () => computeFocus(topics, focusCategories),
    [topics, focusCategories],
  );

  // Aplica a sugestão do FH na UI (filtros + ordenação).
  // Usa as categorias *recomendadas* pelo motor — pode atravessar de área
  // quando outra escola tá pegando fogo.
  const applyFocusSuggestion = useCallback(() => {
    if (!focus?.recommended?.length) {
      showToast('Sem sugestão de foco no momento.', 'info');
      return;
    }
    setSelectedCategories(focus.recommended);
    setSort('oldest');
    setPriorityFilter('Todos');
    setError(null);
    showToast(`Foco aplicado: ${focus.recommended.join(' + ')}`, 'info');
  }, [focus, showToast]);

  const activateFocus = applyFocusSuggestion;

  const filteredTopics = useMemo(() => {
    let result = [...topics];

    if (search) {
      const term = search.toLowerCase();
      result = result.filter((topic) => topic.title.toLowerCase().includes(term));
    }

    if (selectedCategories.length > 0) {
      result = result.filter((topic) => selectedCategories.includes(topic.category));
    }

    if (priorityFilter !== 'Todos') {
      if (priorityFilter === 'SLA') {
        result = result.filter((topic) => topic.ageInDays >= 1);
      } else {
        result = result.filter((topic) => topic.priority === priorityFilter);
      }
    }

    if (onlyMine) {
      result = result.filter((topic) => {
        const claimedName = getClaimedName(topic.claimedBy);
        return topic.isClaimed && claimedName === username;
      });
    }

    result.sort((a, b) => {
      if (sort === 'oldest') return b.ageInDays - a.ageInDays;
      return a.ageInDays - b.ageInDays;
    });

    return result;
  }, [topics, search, selectedCategories, priorityFilter, onlyMine, sort, username]);

  const categoryCounts = useMemo(() => {
    return topics.reduce((counts, topic) => {
      counts[topic.category] = (counts[topic.category] || 0) + 1;
      return counts;
    }, {});
  }, [topics]);

  const alertLimit = useMemo(() => {
    const active = Object.values(categoryCounts).filter((c) => c > 0);
    if (active.length === 0) return Infinity;
    const avg = active.reduce((a, b) => a + b, 0) / active.length;
    return Math.max(3, avg * 1.2);
  }, [categoryCounts]);

  // Handlers em useCallback pra que a referência seja estável entre renders.
  // Sem isso, o React.memo no TopicCard seria furado (props mudam toda vez).
  const handleClaim = useCallback(async (topic) => {
    setClaimingLink(topic.link);
    try {
      // Busca avatar do localStorage (cache 7d) e manda pro backend salvar
      // junto com o claim. Backend valida URL e rejeita placeholders.
      const avatarResult = await fetchAvatarFromBackend(username);
      const avatarUrl = avatarResult.success ? avatarResult.url : null;
      await claimTopic(topic.link, username, avatarUrl);
      showToast('Tópico assumido!', 'success');
      await loadTopics({ silent: true });
    } catch (err) {
      console.error('Erro ao assumir tópico:', err);
      showToast(err?.response?.data?.message || 'Erro ao assumir tópico.', 'error');
    } finally {
      setClaimingLink(null);
    }
  }, [username, loadTopics, showToast]);

  const handleRelease = useCallback(async (topic) => {
    const confirmed = window.confirm('Deseja liberar este tópico de volta para a fila?');
    if (!confirmed) return;
    setReleasingLink(topic.link);
    try {
      await unclaimTopic(topic.link, username);
      showToast('Tópico liberado.', 'info');
      await loadTopics({ silent: true });
    } catch (err) {
      console.error('Erro ao liberar tópico:', err);
      showToast('Erro ao liberar tópico.', 'error');
    } finally {
      setReleasingLink(null);
    }
  }, [username, loadTopics, showToast]);

  const topicCards = filteredTopics.map((topic, index) => (
    <TopicCard
      key={`${topic.link}-${index}`}
      topic={topic}
      index={index}
      username={username}
      isClaiming={claimingLink === topic.link}
      isReleasing={releasingLink === topic.link}
      onClaim={handleClaim}
      onRelease={handleRelease}
    />
  ));

  if (!username) {
    return (
      <div className="view-page">
        <h1>Tópicos</h1>
        <p>Defina seu usuário nas configurações para carregar os dados de tópicos.</p>
      </div>
    );
  }

  return (
    <div id="topics-view" className="view-container active">
      <main>
        <div className="content-wrapper">
          <div className="master-tabs-container">
            <button
              type="button"
              className={`master-tab ${activeTab === 'topics' ? 'active' : ''}`}
              onClick={() => setActiveTab('topics')}
            >
              <i className="fas fa-list"></i>
              <span>Tópicos em aberto</span>
              {topics.length > 0 ? (
                <span className="master-tab-badge master-tab-badge--soft">
                  {topics.length}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              className={`master-tab ${activeTab === 'radar' ? 'active' : ''}`}
              onClick={() => setActiveTab('radar')}
            >
              <i className="fas fa-satellite-dish"></i>
              <span>Fora do radar</span>
              {rescueAlertCount > 0 ? (
                <span
                  className="master-tab-badge master-tab-badge--alert"
                  title={`${rescueAlertCount} tópico${rescueAlertCount === 1 ? '' : 's'} pedindo intervenção`}
                >
                  {rescueAlertCount > 99 ? '99+' : rescueAlertCount}
                </span>
              ) : null}
            </button>
          </div>

          {activeTab === 'topics' ? (
            <div id="topics-wrapper">
              <EventsBanner events={upcomingEvents} />
              {focus && topics.length > 0 && focus.title !== dismissedTitle ? (
                <FocusBanner
                  focus={focus}
                  onApply={() => {
                    applyFocusSuggestion();
                    setDismissedTitle(focus.title);
                  }}
                  onDismiss={() => setDismissedTitle(focus.title)}
                />
              ) : null}
              <div className="filters-container">
                <div className="filters-top-row">
                  <div className="region-toggle-pill">
                    <button
                      id="view-br-topics"
                      className={`region-pill-btn ${region === 'BR' ? 'active' : ''}`}
                      onClick={() => setRegion('BR')}
                    >
                      Brasil
                    </button>
                    <button
                      id="view-latam-topics"
                      className={`region-pill-btn ${region === 'LATAM' ? 'active' : ''}`}
                      onClick={() => setRegion('LATAM')}
                    >
                      LATAM
                    </button>
                  </div>

                  <div className="search-wrapper">
                    <i className="fas fa-search"></i>
                    <input
                      type="text"
                      placeholder="Pesquisar por Título..."
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </div>

                  <div className="actions-wrapper">
                    <div className="sort-wrapper">
                      <i className="fas fa-sort-amount-down-alt"></i>
                      <select
                        id="sort-order"
                        value={sort}
                        onChange={(event) => {
                          const value = event.target.value;
                          if (value === 'my_focus') {
                            activateFocus();
                          } else {
                            setSort(value);
                          }
                        }}
                      >
                        <option value="newest">Mais Recentes</option>
                        <option value="oldest">Mais Antigos</option>
                        <option value="my_focus">Minha prioridade</option>
                      </select>
                    </div>

                    <div className="v-separator"></div>

                    <div className="toggle-compact">
                      <span className="toggle-label">Meus Tópicos</span>
                      <label className="switch">
                        <input
                          type="checkbox"
                          id="my-topics-toggle"
                          checked={onlyMine}
                          onChange={(event) => setOnlyMine(event.target.checked)}
                        />
                        <span className="slider"></span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="filters-bottom-row">
                  <div className="priority-group">
                    {PRIORITY_FILTERS.map((filter) => (
                      <button
                        key={filter.value}
                        className={`filter-chip priority ${filter.cssClass} ${priorityFilter === filter.value ? 'active' : ''}`.trim()}
                        onClick={() => setPriorityFilter(filter.value)}
                      >
                        {filter.label}
                      </button>
                    ))}
                  </div>

                  <div className="v-separator mobile-hide"></div>

                  <div className="category-scroll-area" id="category-filters-box">
                    {CATEGORY_BUTTONS.map((button) => {
                      const isAll = button.category === 'Todas';
                      const isActive = isAll
                        ? selectedCategories.length === 0
                        : selectedCategories.includes(button.category);
                      return (
                        <button
                          key={button.category}
                          className={`filter-chip category ${button.cssClass} ${isActive ? 'active' : ''}`.trim()}
                          data-category={button.category}
                          onClick={() => toggleCategory(button.category)}
                        >
                          {isAll ? (
                            <i className="fas fa-border-all category-icon-fallback"></i>
                          ) : (
                            <img
                              src={`https://raw.githubusercontent.com/caelum/gnarus-api-assets/master/alura/assets/api/categorias/128/${button.file}.png`}
                              alt={button.label}
                              className="category-img"
                            />
                          )}
                          <span>{button.label}</span>
                          {!isAll ? (
                            (() => {
                              const count = categoryCounts[button.category] || 0;
                              const isAlert = count > 0 && count >= alertLimit;
                              return (
                                <span className={`count-badge${isAlert ? ' alert-mode' : ''}`}>
                                  {count}
                                </span>
                              );
                            })()
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {error ? (
                <div className="error-state" style={{ gridColumn: '1/-1', textAlign: 'center', padding: 40, color: 'var(--light-text-color)' }}>
                  {error}
                </div>
              ) : null}
              <div id="topics-container">
                {loading
                  ? Array.from({ length: 6 }).map((_, index) => (
                      <div key={index} className="skeleton-card">
                        <div className="skeleton-header">
                          <div className="skeleton-tag category shimmer"></div>
                          <div className="skeleton-tag priority shimmer"></div>
                        </div>
                        <div className="skeleton-body">
                          <div className="skeleton-line title-1 shimmer"></div>
                          <div className="skeleton-line title-2 shimmer"></div>
                        </div>
                        <div className="skeleton-footer">
                          <div className="skeleton-avatar shimmer"></div>
                        </div>
                      </div>
                    ))
                  : topicCards.length > 0
                  ? topicCards
                  : (
                    <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 40, color: 'var(--light-text-color)' }}>
                      Nenhum tópico encontrado.
                    </div>
                  )}
              </div>
            </div>
          ) : (
            <RescuePanel username={username} />
          )}
        </div>
      </main>
    </div>
  );
}

export default TopicsView;
