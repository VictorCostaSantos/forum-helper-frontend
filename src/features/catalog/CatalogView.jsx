import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '../../shared/ui/ToastProvider';
import {
  INTRO_LABELS,
  classifyKind,
  filterData,
  getKindIconClass,
  isContentLegacy,
} from './helpers';
import { buildHTMLString } from './output';
import { searchWithAI } from './ai';
import { loadCart, saveCart } from './cart';

const ITEMS_PER_PAGE = 15;

function CatalogView() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [brokenIcons, setBrokenIcons] = useState(() => new Set());
  const [cart, setCart] = useState(() => loadCart());
  const [aiState, setAiState] = useState({ links: null, tags: [], summary: '', loading: false });
  const [sidebarTab, setSidebarTab] = useState('list');
  const [format, setFormat] = useState('card');
  const [introKey, setIntroKey] = useState('default');
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [custom, setCustom] = useState({ title: '', link: '', kind: 'Curso' });
  const dragSrc = useRef(null);
  const { showToast } = useToast();

  useEffect(() => {
    fetch('/data/catalogo.json')
      .then((r) => r.json())
      .then(setItems)
      .catch((err) => { console.error('Erro catálogo:', err); setItems([]); });
  }, []);

  useEffect(() => { saveCart(cart); }, [cart]);

  const types = useMemo(() => Array.from(new Set(items.map((i) => i.kind))).sort(), [items]);

  const dataToRender = useMemo(() => {
    let data = items;
    if (aiState.links) {
      data = items.filter((item) => aiState.links.includes(item.link));
      data.sort((a, b) => aiState.links.indexOf(a.link) - aiState.links.indexOf(b.link));
      return data;
    }
    if (statusFilter) {
      data = data.filter((item) => (statusFilter === 'DESCONHECIDO' ? !item.status_tag : item.status_tag === statusFilter));
    }
    return filterData(data, search, typeFilter);
  }, [items, search, typeFilter, statusFilter, aiState.links]);

  const totalPages = Math.max(1, Math.ceil(dataToRender.length / ITEMS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const paginated = dataToRender.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  useEffect(() => { setPage(1); }, [search, typeFilter, statusFilter, aiState.links]);

  const cartHas = useCallback((link) => cart.some((c) => c.link === link), [cart]);

  const toggleCart = (item) => {
    setCart((prev) =>
      prev.some((c) => c.link === item.link)
        ? prev.filter((c) => c.link !== item.link)
        : [...prev, item]
    );
  };

  const removeFromCart = (link) => {
    setCart((prev) => prev.filter((c) => c.link !== link));
  };

  const clearCart = () => {
    if (window.confirm('Limpar toda a lista?')) setCart([]);
  };

  const onDragStart = (e, idx) => { dragSrc.current = idx; e.dataTransfer.effectAllowed = 'move'; };
  const onDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
  const onDrop = (e, idx) => {
    e.preventDefault();
    const src = dragSrc.current;
    if (src == null || src === idx) return;
    setCart((prev) => {
      const next = [...prev];
      const [moved] = next.splice(src, 1);
      next.splice(idx, 0, moved);
      return next;
    });
    dragSrc.current = null;
  };

  const introLabel = INTRO_LABELS[introKey] || INTRO_LABELS.default;
  const buildResponse = () => buildHTMLString(cart, format, items, introLabel);
  const charCount = cart.length > 0 ? buildResponse().length : 0;
  const charPct = Math.min((charCount / 5000) * 100, 100);
  const overLimit = charCount > 5000;
  const warning = charCount > 4000 && !overLimit;

  const copyResponse = async () => {
    if (!cart.length) return;
    try {
      const html = buildResponse();
      const blob = new Blob([html], { type: 'text/html' });
      const data = [
        new ClipboardItem({
          'text/html': blob,
          'text/plain': new Blob([html], { type: 'text/plain' }),
        }),
      ];
      await navigator.clipboard.write(data);
      showToast('Recomendação copiada!', 'success');
    } catch {
      try {
        await navigator.clipboard.writeText(buildResponse());
        showToast('Recomendação copiada (texto)!', 'success');
      } catch {
        showToast('Erro ao copiar.', 'error');
      }
    }
  };

  const runAi = async () => {
    if (!search.trim()) {
      showToast('Cole o texto da dúvida para a IA analisar!', 'warning');
      return;
    }
    setAiState({ links: null, tags: [], summary: '', loading: true });
    try {
      const result = await searchWithAI(search, items);
      if (!result.links.length) {
        showToast('Sem recomendações óbvias para esse texto.', 'warning');
        setAiState({ links: null, tags: [], summary: '', loading: false });
      } else {
        setAiState({ links: result.links, tags: result.tags, summary: result.summary, loading: false });
      }
    } catch (err) {
      showToast(err.message || 'Erro na IA. Verifique sua chave.', 'error');
      setAiState({ links: null, tags: [], summary: '', loading: false });
    }
  };

  const clearAi = () => setAiState({ links: null, tags: [], summary: '', loading: false });

  const reset = () => {
    setSearch('');
    setTypeFilter('');
    setStatusFilter('');
    clearAi();
  };

  const addCustom = () => {
    if (!custom.title.trim() || !custom.link.trim()) {
      showToast('Preencha título e link.', 'error');
      return;
    }
    const item = { title: custom.title.trim(), link: custom.link.trim(), kind: custom.kind, icon: null };
    setCart((prev) => (prev.some((c) => c.link === item.link) ? prev : [...prev, item]));
    setCustom({ title: '', link: '', kind: 'Curso' });
    setShowCustomModal(false);
    showToast('Adicionado à lista!', 'success');
  };

  return (
    <div id="catalog-view" className="view-container active">
      <div className="main-layout" style={{ height: 'calc(100vh - 80px)' }}>
        <section className="content-area">
          <div className="filters-bar">
            <div className="search-wrapper">
              <i className="fas fa-search search-icon"></i>
              <input
                type="text"
                id="searchInput"
                className="search-input"
                placeholder="Busque por tópico..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); clearAi(); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    runAi();
                  }
                }}
              />
            </div>
            <button
              id="btnAiSearch"
              className={`ai-button ${aiState.loading ? 'loading' : ''}`}
              title="Buscar com IA (Ctrl+Enter)"
              onClick={runAi}
              disabled={aiState.loading}
            >
              <i className={`fas ${aiState.loading ? 'fa-spinner fa-spin' : 'fa-magic'}`}></i>{' '}
              <span>{aiState.loading ? 'Pensando...' : 'Busca com IA'}</span>
            </button>
            <select
              id="typeFilter"
              className="filter-select"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">Todos os Formatos</option>
              {types.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
            <select
              id="statusFilter"
              className="filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Todos os Status</option>
              <option value="ATIVO">Ativo</option>
              <option value="REMOVIDO DA PLATAFORMA">Removido da plataforma</option>
              <option value="DESCONHECIDO">Desconhecido (legado)</option>
            </select>
            <button id="resetFilters" title="Limpar filtros" onClick={reset}>Limpar</button>
          </div>

          {(aiState.tags.length > 0 || aiState.summary) ? (
            <div id="aiTagsContainer" className="ai-tags-container" style={{ display: 'flex' }}>
              {aiState.summary ? (
                <div className="ai-summary-text">
                  <i className="fas fa-lightbulb"></i> {aiState.summary}
                </div>
              ) : null}
              <div className="ai-tags-row">
                <span className="ai-tags-label"><i className="fas fa-magic"></i> Filtros:</span>
                {aiState.tags.map((t) => (
                  <span key={t} className="ai-tag-pill">{t}</span>
                ))}
                <button className="ai-clear-btn" onClick={clearAi}>
                  <i className="fas fa-times"></i> Limpar
                </button>
              </div>
            </div>
          ) : null}

          <div id="contentList" className="content-list">
            {paginated.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>
                Nenhum resultado encontrado.
              </div>
            ) : (
              paginated.map((item) => {
                const selected = cartHas(item.link);
                const { typeClass, badgeLabel, iconClass } = classifyKind(item.kind);
                const legacy = isContentLegacy(item.date_text);
                return (
                  <div
                    key={item.link}
                    className={`list-item ${typeClass} ${legacy ? 'is-legacy-item' : ''} ${selected ? 'selected' : ''}`.trim()}
                    onClick={(e) => {
                      if (e.target.tagName === 'A' || e.target.tagName === 'INPUT') return;
                      toggleCart({ ...item, kind: badgeLabel });
                    }}
                  >
                    <div className="check-area">
                      <input
                        type="checkbox"
                        className="item-check"
                        checked={selected}
                        onChange={() => toggleCart({ ...item, kind: badgeLabel })}
                      />
                    </div>

                    <div className="item-icon-container">
                      {item.icon && !brokenIcons.has(item.link) ? (
                        <img
                          src={item.icon}
                          alt=""
                          referrerPolicy="no-referrer"
                          onError={() => setBrokenIcons((prev) => new Set(prev).add(item.link))}
                        />
                      ) : (
                        <i className={`fas ${iconClass}`}></i>
                      )}
                    </div>

                    <div className="item-info">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noreferrer"
                          className="item-title"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {item.title}
                        </a>
                        {item.status_tag === 'REMOVIDO DA PLATAFORMA' ? (
                          <div className="removed-warning" title="Este conteúdo foi removido da plataforma Alura.">
                            <i className="fas fa-ban"></i> Removido da plataforma
                          </div>
                        ) : null}
                        {legacy ? (
                          <div className="legacy-warning" title="Este conteúdo tem mais de 4 anos e pode estar desatualizado.">
                            <i className="fas fa-exclamation-triangle"></i> Antigo
                          </div>
                        ) : null}
                      </div>
                      <div className="item-meta">
                        <span className="badge badge-visual">{badgeLabel}</span>
                        {item.date_text ? <span className="item-date">• {item.date_text}</span> : null}
                      </div>
                    </div>

                    <a
                      href={item.link}
                      target="_blank"
                      rel="noreferrer"
                      className="external-link-btn"
                      title="Abrir link original"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <i className="fas fa-external-link-alt"></i>
                    </a>
                  </div>
                );
              })
            )}
          </div>

          {totalPages > 1 ? (
            <div id="pagination" className="pagination">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
                <i className="fas fa-chevron-left"></i>
              </button>
              <span>Página {currentPage} de {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <i className="fas fa-chevron-right"></i>
              </button>
            </div>
          ) : null}
        </section>

        <aside className="selection-panel">
          <div className="panel-header">
            <div className="header-top">
              <span><i className="fas fa-clipboard-list"></i> Seleção</span>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span
                  id="selectedCount"
                  style={{
                    background: 'var(--color-accent-cat)',
                    color: 'white',
                    padding: '0 8px',
                    borderRadius: 12,
                    fontSize: '0.8rem',
                    height: 20,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {cart.length}
                </span>
                <button id="btnAddCustom" title="Adicionar Link Externo" onClick={() => setShowCustomModal(true)}>
                  <i className="fas fa-plus-circle"></i>
                </button>
              </div>
            </div>
            <div className="sidebar-tabs">
              <button
                className={`tab-link ${sidebarTab === 'list' ? 'active' : ''}`}
                onClick={() => setSidebarTab('list')}
              >
                Lista
              </button>
              <button
                className={`tab-link ${sidebarTab === 'preview' ? 'active' : ''}`}
                title="Visualizar"
                onClick={() => setSidebarTab('preview')}
              >
                <img
                  src="https://cursos.alura.com.br/assets/images/hackeditor/icon-preview.svg"
                  className="tab-icon-img"
                  alt="Preview"
                />
              </button>
            </div>
          </div>

          <div className="panel-body">
            <div id="view-list" className="sidebar-view" style={{ display: sidebarTab === 'list' ? 'block' : 'none' }}>
              {cart.length === 0 ? (
                <p
                  id="emptyState"
                  style={{ textAlign: 'center', color: 'var(--text-secondary-cat)', marginTop: 50 }}
                >
                  Selecione itens na lista para criar sua recomendação.
                </p>
              ) : (
                <ul id="selectedList" className="selected-list" style={{ listStyle: 'none', padding: 0 }}>
                  {cart.map((item, idx) => (
                    <li
                      key={item.link}
                      className="selected-item"
                      draggable
                      onDragStart={(e) => onDragStart(e, idx)}
                      onDragOver={onDragOver}
                      onDrop={(e) => onDrop(e, idx)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            flexShrink: 0,
                            background: '#f0f4f8',
                            borderRadius: 6,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1px solid #e2e8f0',
                            color: '#64748b',
                          }}
                        >
                          {item.icon ? (
                            <img
                              src={item.icon}
                              style={{ width: 20, height: 20, objectFit: 'contain' }}
                              referrerPolicy="no-referrer"
                              alt=""
                            />
                          ) : (
                            <i className={`fas ${getKindIconClass(item.kind)}`} style={{ fontSize: '0.95rem' }}></i>
                          )}
                        </div>
                        <div style={{ overflow: 'hidden' }}>
                          <div
                            style={{
                              fontWeight: 600,
                              marginBottom: 2,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              fontSize: '0.85rem',
                            }}
                          >
                            {item.title}
                          </div>
                          <div
                            style={{
                              fontSize: '0.65rem',
                              color: '#666',
                              textTransform: 'uppercase',
                              fontWeight: 700,
                            }}
                          >
                            {(item.kind || 'OUTRO').toUpperCase()}
                          </div>
                        </div>
                      </div>
                      <i
                        className="fas fa-times remove-btn"
                        onClick={() => removeFromCart(item.link)}
                        style={{ cursor: 'pointer', marginLeft: 'auto' }}
                        title="Remover"
                      ></i>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div
              id="view-preview"
              className="sidebar-view"
              style={{ display: sidebarTab === 'preview' ? 'block' : 'none' }}
            >
              <div
                id="preview-container"
                style={
                  format === 'text'
                    ? { backgroundColor: '#fff', color: '#333', border: '1px solid #ddd', padding: 10 }
                    : {}
                }
              >
                {cart.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#999', marginTop: 40, fontSize: '0.9rem' }}>
                    O preview aparecerá aqui...
                  </p>
                ) : (
                  <div dangerouslySetInnerHTML={{ __html: buildResponse() }} />
                )}
              </div>
            </div>
          </div>

          <div className="panel-footer">
            <div style={{ marginBottom: 10 }}>
              <label
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: 'var(--text-secondary-cat)',
                  display: 'block',
                  marginBottom: 6,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                Formato da Resposta:
              </label>
              <select id="formatSelect" value={format} onChange={(e) => setFormat(e.target.value)}>
                <option value="card">Visual com cards</option>
                <option value="list">Lista Compacta</option>
                <option value="text">Texto Simples</option>
              </select>
            </div>
            <div style={{ marginBottom: 15 }}>
              <label
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: 'var(--text-secondary-cat)',
                  display: 'block',
                  marginBottom: 6,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                Introdução do Card:
              </label>
              <select id="introSelect" value={introKey} onChange={(e) => setIntroKey(e.target.value)}>
                <option value="default">Para saber mais</option>
                <option value="aprofundar">Para se aprofundar</option>
                <option value="comecar">Por onde começar</option>
                <option value="relacionado">Conteúdo relacionado</option>
                <option value="pratica">Para praticar</option>
              </select>
            </div>

            {cart.length > 0 ? (
              <div id="charCounterBox" className="char-counter-box" style={{ marginBottom: 15 }}>
                <div className="char-labels">
                  <span className="char-label-text">Tamanho da Resposta</span>
                  <span
                    id="charCountValue"
                    className={`char-count-val ${overLimit ? 'text-danger' : ''}`}
                  >
                    {charCount} / 5000
                  </span>
                </div>
                <div className="char-progress-bg">
                  <div
                    id="charProgressBar"
                    className={`char-progress-fill ${overLimit ? 'char-state-danger' : warning ? 'char-state-warning' : ''}`}
                    style={{ width: `${charPct}%` }}
                  ></div>
                </div>
                {overLimit ? (
                  <p id="charWarningMsg" className="char-msg">
                    Limite excedido. Escolha &quot;Lista&quot; ou &quot;Texto Simples&quot;.
                  </p>
                ) : null}
              </div>
            ) : null}

            {cart.length > 0 ? (
              <button
                id="btnClear"
                onClick={clearCart}
                style={{
                  width: '100%',
                  padding: 10,
                  marginBottom: 10,
                  background: '#ffebee',
                  color: '#c62828',
                  border: '1px solid #ffcdd2',
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <i className="fas fa-trash-alt"></i> Limpar Lista
              </button>
            ) : null}

            <button
              id="btnCopy"
              className="btn-copy"
              disabled={cart.length === 0 || overLimit}
              onClick={copyResponse}
            >
              <i className="far fa-copy"></i> Copiar Recomendação
            </button>
          </div>
        </aside>
      </div>

      {showCustomModal ? (
        <>
          <div className="overlay" onClick={() => setShowCustomModal(false)}></div>
          <div id="customItemModal" className="modal-overlay" style={{ display: 'flex' }}>
            <div className="modal-content">
              <div className="modal-header-row">
                <h3><i className="fas fa-plus-circle"></i> Adicionar Link Externo</h3>
                <button
                  type="button"
                  className="modal-close-btn"
                  title="Fechar"
                  onClick={() => setShowCustomModal(false)}
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
              <div className="input-group">
                <label htmlFor="customTitle">
                  Título do Material <span className="required-star">*</span>
                </label>
                <input
                  type="text"
                  id="customTitle"
                  placeholder="Ex: Artigo sobre React..."
                  autoComplete="off"
                  value={custom.title}
                  onChange={(e) => setCustom((p) => ({ ...p, title: e.target.value }))}
                />
              </div>
              <div className="input-group">
                <label htmlFor="customLink">
                  Link (URL) <span className="required-star">*</span>
                </label>
                <input
                  type="url"
                  id="customLink"
                  placeholder="https://..."
                  autoComplete="off"
                  value={custom.link}
                  onChange={(e) => setCustom((p) => ({ ...p, link: e.target.value }))}
                />
              </div>
              <div className="input-group">
                <label htmlFor="customKind">Tipo de Conteúdo</label>
                <select
                  id="customKind"
                  value={custom.kind}
                  onChange={(e) => setCustom((p) => ({ ...p, kind: e.target.value }))}
                >
                  <option value="Curso">Curso</option>
                  <option value="Vídeo">Vídeo / Websérie</option>
                  <option value="Artigo">Artigo / Leitura</option>
                  <option value="Podcast">Podcast</option>
                  <option value="Ferramenta">Ferramenta / Exercício</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowCustomModal(false)}
                >
                  Cancelar
                </button>
                <button type="button" className="btn-primary" onClick={addCustom}>
                  <i className="fas fa-plus"></i> Adicionar à Lista
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

export default CatalogView;
