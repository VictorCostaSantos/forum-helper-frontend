import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchRescueQueue,
  claimRescueTopic,
  unclaimRescueTopic,
  resolveRescueTopic,
  fetchAvatarFromBackend,
} from '../../api/apiService';
import { useToast } from '../../shared/ui/ToastProvider';
import UserAvatar from '../../shared/components/UserAvatar';

const categoryClassMap = {
  'Front-end': 'frontend',
  Programação: 'programacao',
  'Data Science': 'data-science',
  DevOps: 'devops',
  'UX & Design': 'ux-design',
  Mobile: 'mobile',
  'Inovação & Gestão': 'inovacao-gestao',
  'Inteligência Artificial': 'ia',
};

const PRIORITY_COLORS = {
  ALTA: '#d32f2f',
  MEDIA: '#f57c00',
  BAIXA: '#0288d1',
};

// "Intervir" = ALTA + MEDIA com intervencao_necessaria=true. Default da aba pq
// é o subconjunto que realmente precisa de ação humana — antes começava em
// "Todos" e renderizava 500+ cards de uma vez, travando a página.
const RESCUE_FILTERS = [
  { value: 'INTERVIR', label: 'Intervir' },
  { value: 'ALTA', label: 'Alta' },
  { value: 'MEDIA', label: 'Média' },
  { value: 'NAO_INTERVIR', label: 'OK' },
  { value: 'ALL', label: 'Todos' },
];

// Quantos cards renderizar por "página". Pagination simples por slice — a
// alternativa (virtualização) é overkill pra esse caso (clicar em "carregar
// mais" é UX clara e o usuário raramente passa da 1ª batelada).
const PAGE_SIZE = 50;

function getRescueSortValue(topic) {
  const score = { ALTA: 3, MEDIA: 2, BAIXA: 1 };
  return topic.ia_analysis?.intervencao_necessaria ? score[topic.ia_analysis.prioridade] || 0 : -1;
}

function escapeHTML(str) {
  return (str || '').replace(/[&<>'"]/g, (tag) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[tag]));
}

/*
  Card individual da fila de resgate, memoizado.
  React.memo aqui é grande win com 50+ cards: cada poll de 60s reconstrói o
  array de tópicos, e sem memo todo card re-renderiza. Com memo, só re-renderiza
  quando suas props mudam — ou seja, quando o tópico em si muda (claim, release,
  loading state). Diff por reference funciona pq topic IDs são estáveis.

  Os handlers vêm de fora porque usam estado do RescuePanel. Eles são wrapped
  em useCallback no parent, então a referência é estável entre renders e o
  memo continua eficaz.
*/
const RescueCard = memo(function RescueCard({
  topic,
  username,
  isClaiming,
  isReleasing,
  isResolving,
  onClaim,
  onRelease,
  onResolve,
}) {
  const ia = topic.ia_analysis;
  const needsIntervention = ia.intervencao_necessaria === true;
  const catClass = categoryClassMap[topic.escola_nome] || 'default';
  const topicLink = topic.topic_link;
  const topicTitle = topic.subject || 'Sem título';
  const studentCount = topic.total_interacoes_alunos || 0;
  const isClaimed = topic.rescue_status === 'CLAIMED' && topic.claimed_by;
  const isMine = isClaimed && topic.claimed_by.name === username;
  // UserAvatar gera fallback local quando avatar é vazio ou imagem 404 —
  // sem precisar de ui-avatars.com (que pode estar bloqueado/lento).
  const claimedAvatarSrc = isClaimed ? (topic.claimed_by.avatar || '') : '';
  const claimedName = isClaimed ? topic.claimed_by.name : '';

  const priorityStyle = needsIntervention
    ? {
        backgroundColor: PRIORITY_COLORS[ia.prioridade] || '#757575',
        color: 'white',
        padding: '4px 8px',
        borderRadius: 4,
        fontWeight: 'bold',
        fontSize: 12,
        display: 'inline-block',
        marginBottom: 8,
      }
    : {
        backgroundColor: '#2e7d32',
        color: 'white',
        padding: '4px 8px',
        borderRadius: 4,
        fontWeight: 'bold',
        fontSize: 12,
        display: 'inline-block',
        marginBottom: 8,
      };

  const priorityClass = needsIntervention
    ? (ia.prioridade === 'ALTA' ? 'complex' : ia.prioridade === 'MEDIA' ? 'medium' : 'easy')
    : '';

  return (
    <div className={`topic-card ${catClass}${priorityClass ? ' ' + priorityClass : ''}`}>
      <div className="card-header">
        <span className="category-tag">{topic.escola_nome}</span>
        <div className="card-tags-right">
          <span className="priority-tag" style={priorityStyle}>
            {needsIntervention ? ia.prioridade : 'OK'}
          </span>
        </div>
      </div>

      <div className="card-body">
        <h2 style={{ fontSize: '1.05rem', marginBottom: 8 }}>
          <a
            href={topicLink}
            target="_blank"
            rel="noreferrer"
            style={{ color: 'var(--text-color)', textDecoration: 'none' }}
            dangerouslySetInnerHTML={{ __html: escapeHTML(topicTitle) }}
          />
        </h2>

        <div className="rescue-stage">
          <div className="rescue-stage-front">
            <p className="topic-age" style={{ margin: 0 }}>
              <strong>Aluno:</strong> @{topic.student_username || 'N/A'} &nbsp;|&nbsp; <strong>Respostas:</strong> {studentCount}
            </p>
          </div>
          <div className="rescue-stage-back">
            <p style={{ margin: '0 0 5px', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--cor-ia)' }}>
              <i className="fas fa-robot"></i> Motivo do Alerta
            </p>
            <p style={{ margin: 0, fontSize: '0.83rem', lineHeight: 1.5, color: 'var(--text-color)' }}>
              {ia.motivo_intervencao || 'Sem motivo informado'}
            </p>
          </div>
        </div>
      </div>

      <div className="card-footer" style={{ marginTop: 15 }}>
        <div className="author-info"></div>

        <div className="rescue-card-actions">
          {/* Botão "Marcar como respondido" só pra quem assumiu o tópico —
              ação seguinte natural depois de responder no fórum. */}
          {isClaimed && isMine ? (
            <button
              type="button"
              className="rescue-resolve-btn"
              onClick={() => onResolve(topic.topic_id)}
              disabled={isResolving}
              title="Marcar como respondido"
            >
              {isResolving ? (
                <i className="fas fa-spinner fa-spin"></i>
              ) : (
                <i className="fa-solid fa-check"></i>
              )}
              <span>Respondido</span>
            </button>
          ) : null}

          {isClaimed ? (
            <div
              className={`claimed-by ${isMine ? 'is-mine' : ''}`}
              title={isMine ? 'Liberar tópico' : `Em atendimento por ${topic.claimed_by.name}`}
              onClick={isMine && !isReleasing ? () => onRelease(topic.topic_id) : undefined}
              style={{ cursor: isMine ? 'pointer' : 'default' }}
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
              onClick={() => onClaim(topic.topic_id)}
              disabled={isClaiming}
              title="Assumir Tópico"
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
    </div>
  );
});

function RescuePanel({ username }) {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('fora-do-radar');
  const [filter, setFilter] = useState('INTERVIR');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [data, setData] = useState({ topics: [], waiting_queue: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [claimingId, setClaimingId] = useState(null);
  const [releasingId, setReleasingId] = useState(null);
  const [resolvingId, setResolvingId] = useState(null);
  // IDs já marcados como resolvidos — somem da tela imediatamente, sem
  // esperar o próximo poll do backend (que vai fazer soft-delete).
  const [resolvedIds, setResolvedIds] = useState(() => new Set());
  const initialLoad = useRef(true);

  const loadData = useCallback(async ({ silent = false } = {}) => {
    if (!username) {
      setData({ topics: [], waiting_queue: [] });
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    setError('');
    try {
      const payload = await fetchRescueQueue();
      setData({ topics: payload.topics || [], waiting_queue: payload.waiting_queue || [] });
    } catch (err) {
      console.error('Erro ao carregar fila de resgate:', err);
      if (!silent) setError('Não foi possível carregar a fila de resgate.');
    } finally {
      if (!silent) setLoading(false);
      initialLoad.current = false;
    }
  }, [username]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    // Polling de 60s (antes 15s). A fila de resgate da IA não muda minuto a
    // minuto — bumpar reduz drasticamente o número de re-renders do grid
    // (com 500 cards, cada poll era um stutter). Quem precisa de atualização
    // imediata usa o badge "Fora do radar" da master tab (polling separado).
    const interval = setInterval(() => {
      if (username) loadData({ silent: true });
    }, 60000);
    return () => clearInterval(interval);
  }, [loadData, username]);

  const waitingTopics = data.waiting_queue || [];

  const validAnalyzedTopics = useMemo(() => {
    if (!data.topics) return [];
    return data.topics.filter((topic) => {
      if (!topic.ia_analysis || topic.rescue_status === 'ERROR') return false;
      if ((topic.ia_analysis.motivo_intervencao || '').includes('Falha')) return false;
      // Já marcamos como respondido localmente — esconde até o próximo poll.
      if (resolvedIds.has(topic.topic_id)) return false;
      return true;
    });
  }, [data.topics, resolvedIds]);

  const filteredAnalyzed = useMemo(() => {
    return validAnalyzedTopics.filter((topic) => {
      const ia = topic.ia_analysis;
      if (filter === 'NAO_INTERVIR') return ia.intervencao_necessaria === false;
      if (filter === 'INTERVIR') {
        return ia.intervencao_necessaria === true
          && (ia.prioridade === 'ALTA' || ia.prioridade === 'MEDIA');
      }
      if (filter === 'ALTA' || filter === 'MEDIA') return ia.prioridade === filter;
      return true; // ALL
    });
  }, [validAnalyzedTopics, filter]);

  const sortedAnalyzed = useMemo(() => {
    return [...filteredAnalyzed].sort((a, b) => getRescueSortValue(b) - getRescueSortValue(a));
  }, [filteredAnalyzed]);

  const needsActionCount = validAnalyzedTopics.filter((t) => t.ia_analysis.intervencao_necessaria === true).length;
  const totalAnalyzed = validAnalyzedTopics.length;
  const waitingCount = waitingTopics.length;
  const fullList = activeTab === 'esteira' ? waitingTopics : sortedAnalyzed;
  // Slice pra paginação — a esteira não precisa (poucos itens), só o radar.
  const currentTabTopics = activeTab === 'esteira'
    ? fullList
    : fullList.slice(0, visibleCount);
  const hasMore = activeTab === 'fora-do-radar' && fullList.length > visibleCount;

  // Reseta o visibleCount sempre que o usuário troca de filtro ou aba —
  // senão ficaria mostrando 100 itens ao trocar de filtro pra um conjunto
  // de 30 (sem bug funcional, mas confuso).
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filter, activeTab]);

  const handleClaim = useCallback(
    async (topicId) => {
      if (!username) {
        showToast('Defina seu usuário para assumir tópicos.', 'error');
        return;
      }
      setClaimingId(topicId);
      try {
        const avatarResult = await fetchAvatarFromBackend(username);
        const avatarUrl = avatarResult.success
          ? avatarResult.url
          : `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}`;
        await claimRescueTopic(topicId, username, avatarUrl);
        showToast('Tópico assumido com sucesso!', 'success');
        await loadData({ silent: true });
      } catch (err) {
        console.error('Erro ao assumir tópico:', err);
        showToast('Erro ao assumir tópico.', 'error');
      } finally {
        setClaimingId(null);
      }
    },
    [loadData, showToast, username]
  );

  const handleRelease = useCallback(
    async (topicId) => {
      if (!window.confirm('Deseja devolver este tópico para o radar da equipe?')) return;
      setReleasingId(topicId);
      try {
        await unclaimRescueTopic(topicId);
        showToast('Tópico devolvido.', 'success');
        await loadData({ silent: true });
      } catch (err) {
        console.error('Erro ao liberar tópico:', err);
        showToast('Erro ao liberar o tópico.', 'error');
      } finally {
        setReleasingId(null);
      }
    },
    [loadData, showToast]
  );

  // Marca como respondido no backend (soft-delete) e some o card da tela
  // imediatamente via resolvedIds — o próximo poll do /rescue-queue já
  // não vai retornar o tópico.
  const handleResolve = useCallback(
    async (topicId) => {
      if (!username) {
        showToast('Defina seu usuário para marcar como respondido.', 'error');
        return;
      }
      if (!window.confirm('Confirmar que esse tópico já foi respondido no fórum?')) return;
      setResolvingId(topicId);
      try {
        await resolveRescueTopic(topicId, username);
        showToast('Tópico marcado como respondido.', 'success');
        setResolvedIds((prev) => {
          const next = new Set(prev);
          next.add(topicId);
          return next;
        });
      } catch (err) {
        console.error('Erro ao marcar como respondido:', err);
        const message = err?.response?.data?.message || 'Erro ao marcar como respondido.';
        showToast(message, 'error');
      } finally {
        setResolvingId(null);
      }
    },
    [showToast, username]
  );

  if (!username) {
    return (
      <div className="view-page">
        <h1>Fora do Radar</h1>
        <p>Defina seu usuário nas configurações para usar a fila de resgate.</p>
      </div>
    );
  }

  const tabActiveStyle = {
    padding: '8px 16px',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 'bold',
    cursor: 'pointer',
    background: 'var(--header-bg-color)',
    color: 'white',
    transition: '0.2s',
  };
  const tabInactiveStyle = {
    ...tabActiveStyle,
    background: 'transparent',
    color: 'var(--light-text-color)',
  };

  return (
    <div id="rescue-panel">
      <div
        className="rescue-header"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 15 }}
      >
        <div style={{ display: 'flex', gap: 10, background: 'var(--bg-color)', padding: 6, borderRadius: 12, border: '1px solid var(--border-color)' }}>
          <button
            id="tab-fora-do-radar"
            style={activeTab === 'fora-do-radar' ? tabActiveStyle : tabInactiveStyle}
            onClick={() => setActiveTab('fora-do-radar')}
          >
            <i className="fas fa-satellite-dish"></i> Fora do Radar ({needsActionCount}/{totalAnalyzed})
          </button>
          <button
            id="tab-esteira"
            style={activeTab === 'esteira' ? tabActiveStyle : tabInactiveStyle}
            onClick={() => setActiveTab('esteira')}
          >
            <i className={`fas fa-cog ${waitingCount > 0 ? 'fa-spin' : ''}`}></i> Lendo Fórum ({waitingCount})
          </button>
        </div>

        <div id="ai-filters" style={{ display: activeTab === 'fora-do-radar' ? 'flex' : 'none', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {RESCUE_FILTERS.map((item) => (
            <button
              key={item.value}
              className={`rescue-filter-btn ${filter === item.value ? 'active' : ''}`}
              data-filter={item.value}
              onClick={() => setFilter(item.value)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div id="rescue-list-area" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.5rem' }}>
        {loading ? (
          <p style={{ color: 'var(--light-text-color)', gridColumn: '1/-1' }}>
            <i className="fas fa-spinner fa-spin"></i> Sincronizando dados...
          </p>
        ) : error ? (
          <div className="error-state" style={{ gridColumn: '1/-1' }}>{error}</div>
        ) : currentTabTopics.length === 0 ? (
          <p style={{ color: 'var(--light-text-color)', gridColumn: '1/-1' }}>
            {activeTab === 'esteira'
              ? 'Nenhum tópico na fila de leitura. Tudo atualizado!'
              : 'Nenhum tópico encontrado com estes filtros.'}
          </p>
        ) : activeTab === 'esteira' ? (
          waitingTopics.map((topic, index) => {
            const isCurrent = index === 0;
            const catClass = categoryClassMap[topic.escola_nome] || 'default';
            return (
              <div
                key={topic.topic_id || topic.topic_link}
                className={`topic-card ${catClass}`}
                style={{ opacity: isCurrent ? 1 : 0.6, minHeight: 120 }}
              >
                <div className="card-header">
                  <span className="category-tag">{topic.escola_nome}</span>
                  {isCurrent ? (
                    <span style={{ color: 'var(--cor-ia)', fontSize: '0.8rem', fontWeight: 'bold' }}>
                      <i className="fas fa-eye"></i> Lendo...
                    </span>
                  ) : (
                    <span style={{ color: 'var(--light-text-color)', fontSize: '0.8rem' }}>Fila</span>
                  )}
                </div>
                <div className="card-body">
                  <h2 style={{ fontSize: '1rem' }}>
                    <a
                      href={topic.topic_link}
                      target="_blank"
                      rel="noreferrer"
                      style={{ textDecoration: 'none' }}
                      dangerouslySetInnerHTML={{ __html: escapeHTML(topic.subject) }}
                    />
                  </h2>
                </div>
              </div>
            );
          })
        ) : (
          // Usa currentTabTopics (já paginado) — antes mapeava sortedAnalyzed
          // direto e renderizava os 500 itens, fazendo a paginação não ter
          // efeito visível e travando a página.
          currentTabTopics.map((topic) => (
            <RescueCard
              key={topic.topic_id || topic.topic_link}
              topic={topic}
              username={username}
              isClaiming={claimingId === topic.topic_id}
              isReleasing={releasingId === topic.topic_id}
              isResolving={resolvingId === topic.topic_id}
              onClaim={handleClaim}
              onRelease={handleRelease}
              onResolve={handleResolve}
            />
          ))
        )}
      </div>

      {hasMore ? (
        <div className="rescue-pagination">
          <span className="rescue-pagination__count">
            Mostrando {currentTabTopics.length} de {fullList.length}
          </span>
          <button
            type="button"
            className="rescue-pagination__btn"
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
          >
            Carregar mais {Math.min(PAGE_SIZE, fullList.length - currentTabTopics.length)}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default RescuePanel;
