import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../ui/ToastProvider';
import { fetchClickUpUser, fetchClickUpTeams } from '../../api/apiService';
import { useNotifications } from '../notifications/NotificationsContext';
import { runClickUpSync } from '../notifications/clickupSync';

const TABS = [
  { id: 'profile', label: 'Perfil', icon: 'fa-user' },
  { id: 'integrations', label: 'Integrações', icon: 'fa-plug' },
  { id: 'templates', label: 'Templates', icon: 'fa-clipboard' },
  { id: 'system', label: 'Sistema', icon: 'fa-sliders' },
];

/* ============================================
   STATUS BADGE — bolinha verde/vermelha/cinza
   pra mostrar estado das integrações no card.
   ============================================ */
function StatusBadge({ state, label }) {
  const cls = `integration-card__status integration-card__status--${state}`;
  return (
    <span className={cls}>
      <span className="integration-card__dot" aria-hidden="true"></span>
      {label}
    </span>
  );
}

/* ============================================
   INTEGRATION CARD — wrapper visual unificado
   ============================================ */
function IntegrationCard({ icon, name, status, statusLabel, children }) {
  return (
    <div className="integration-card">
      <div className="integration-card__header">
        <span className="integration-card__icon">
          <i className={`fa-solid ${icon}`}></i>
        </span>
        <div className="integration-card__title">{name}</div>
        <StatusBadge state={status} label={statusLabel} />
      </div>
      <div className="integration-card__body">{children}</div>
    </div>
  );
}

const SettingsModal = ({ settings, theme, onChange, onThemeChange, onClose }) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { announce, clearAll } = useNotifications();
  const [activeTab, setActiveTab] = useState('profile');
  const [local, setLocal] = useState({
    username: settings.username || '',
    displayName: settings.displayName || '',
    meta: settings.meta || '',
    apiKey: settings.apiKey || '',
    solutionTag: settings.solutionTag || '',
    feedbackTag: settings.feedbackTag || '',
    clickupToken: settings.clickupToken || '',
  });
  const [clickupTest, setClickupTest] = useState({
    status: 'idle',
    user: null,
    teams: null,
    error: null,
  });
  const [clickupSyncing, setClickupSyncing] = useState(false);

  // Auto-valida o token persistido na primeira abertura — mostra estado real.
  useEffect(() => {
    if (!local.clickupToken) {
      setClickupTest({ status: 'idle', user: null, teams: null, error: null });
      return;
    }
    if (clickupTest.status !== 'idle') return;
    let alive = true;
    setClickupTest({ status: 'testing', user: null, teams: null, error: null });
    (async () => {
      try {
        const [user, teams] = await Promise.all([
          fetchClickUpUser(local.clickupToken),
          fetchClickUpTeams(local.clickupToken),
        ]);
        if (!alive) return;
        setClickupTest({ status: 'success', user, teams, error: null });
      } catch (err) {
        if (!alive) return;
        setClickupTest({
          status: 'error',
          user: null,
          teams: null,
          error: err?.message || 'Falha ao conectar.',
        });
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (field, value) => {
    setLocal((prev) => ({ ...prev, [field]: value }));
    if (field === 'clickupToken') {
      setClickupTest({ status: 'idle', user: null, teams: null, error: null });
    }
  };

  const handleSyncClickUp = async (forceAnnounce = false) => {
    const token = local.clickupToken.trim();
    if (!token || clickupSyncing) return;
    setClickupSyncing(true);
    try {
      const result = await runClickUpSync({ token, announce, forceAnnounce });
      const parts = [];
      if (result.newAnnounced) parts.push(`${result.newAnnounced} nova${result.newAnnounced === 1 ? '' : 's'}`);
      if (result.overdueAnnounced) parts.push(`${result.overdueAnnounced} atrasada${result.overdueAnnounced === 1 ? '' : 's'}`);
      if (result.eventNewAnnounced) parts.push(`${result.eventNewAnnounced} evento${result.eventNewAnnounced === 1 ? '' : 's'} novo${result.eventNewAnnounced === 1 ? '' : 's'}`);
      if (result.eventApproachAnnounced) parts.push(`${result.eventApproachAnnounced} evento${result.eventApproachAnnounced === 1 ? '' : 's'} próximo${result.eventApproachAnnounced === 1 ? '' : 's'}`);
      if (result.radarItems.length) parts.push(`${result.radarItems.length} no radar`);

      if (result.wasFirstRun) {
        const eventNote = result.totalEvents
          ? ` + ${result.totalEvents} evento${result.totalEvents === 1 ? '' : 's'}`
          : '';
        showToast(
          `Primeira sync: ${result.totalTasks} tarefas${eventNote} mapeados em silêncio. Próximas mudanças disparam alerta.`,
          'info',
        );
      } else if (parts.length === 0) {
        showToast(`Sincronizado — sem novidades (${result.totalTasks} tarefa${result.totalTasks === 1 ? '' : 's'} ativa${result.totalTasks === 1 ? '' : 's'})`, 'info');
      } else {
        showToast(`Sincronizado: ${parts.join(' · ')}`, 'success');
      }
    } catch (err) {
      showToast(`Falha: ${err?.message || err}`, 'error');
    } finally {
      setClickupSyncing(false);
    }
  };

  const handleTestClickUp = async () => {
    const token = local.clickupToken.trim();
    if (!token) return;
    setClickupTest({ status: 'testing', user: null, teams: null, error: null });
    try {
      const [user, teams] = await Promise.all([
        fetchClickUpUser(token),
        fetchClickUpTeams(token),
      ]);
      setClickupTest({ status: 'success', user, teams, error: null });
    } catch (err) {
      setClickupTest({
        status: 'error',
        user: null,
        teams: null,
        error: err?.message || 'Falha ao conectar.',
      });
    }
  };

  // O validador de URI do Power Automate rejeita parênteses (mesmo
  // URL-encoded) e querystrings longas. Workaround: passa como expressão
  // @{concat(...)} — PA só valida a sintaxe da expressão, não a URL.
  const handleClearAllNotifications = () => {
    if (!window.confirm('Limpa todas as notificações da Central. Confirma?')) return;
    clearAll();
    showToast('Notificações limpas.', 'success');
  };

  const handleSave = () => {
    const username = local.username.trim();
    const meta = String(local.meta || '').trim();
    if (!username || !meta || Number(meta) < 1) {
      showToast('Preencha um usuário BR e uma meta válida.', 'error');
      setActiveTab('profile');
      return;
    }
    onChange('username', username);
    onChange('displayName', local.displayName.trim());
    onChange('meta', meta);
    onChange('apiKey', local.apiKey.trim());
    onChange('solutionTag', local.solutionTag);
    onChange('feedbackTag', local.feedbackTag);
    onChange('clickupToken', local.clickupToken.trim());
    showToast('Configurações salvas!', 'success');
    onClose();
  };

  const clickupStatus =
    clickupTest.status === 'success' ? 'ok'
    : clickupTest.status === 'error' ? 'err'
    : clickupTest.status === 'testing' ? 'loading'
    : (local.clickupToken ? 'loading' : 'idle');

  const clickupStatusLabel =
    clickupStatus === 'ok' ? 'Conectado'
    : clickupStatus === 'err' ? 'Erro'
    : clickupStatus === 'loading' ? 'Verificando…'
    : 'Não configurado';

  const geminiStatus = local.apiKey ? 'ok' : 'idle';
  const geminiStatusLabel = geminiStatus === 'ok' ? 'Configurado' : 'Não configurado';

  return (
    <div className="modal" id="modal" style={{ display: 'block' }}>
      <div className="modal-header">
        <h2>Configurações</h2>
      </div>

      {/* Tabs */}
      <nav className="modal-tabs" role="tablist" aria-label="Seções de configuração">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`modal-tab ${activeTab === tab.id ? 'is-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <i className={`fa-solid ${tab.icon}`} aria-hidden="true"></i>
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      <div className="modal-body modal-body--tabbed">
        {/* ============================================
            TAB 1 — PERFIL
            ============================================ */}
        {activeTab === 'profile' ? (
          <div className="settings-tab" role="tabpanel">
            <div className="form-grid">
              <div className="form-group full-width">
                <label htmlFor="usernameInput">Usuário Alura</label>
                <input
                  id="usernameInput"
                  type="text"
                  placeholder="ex: victos-costa"
                  value={local.username}
                  onChange={(e) => handleChange('username', e.target.value)}
                />
                <p className="modal-description">
                  Seu username de instrutor BR. Usado pra buscar suas estatísticas e foco.
                </p>
              </div>
              <div className="form-group">
                <label htmlFor="displayNameInput">
                  Como te chamamos? <small>(opcional)</small>
                </label>
                <input
                  id="displayNameInput"
                  type="text"
                  placeholder="ex: Victor"
                  value={local.displayName}
                  onChange={(e) => handleChange('displayName', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="metaInput">Meta diária</label>
                <input
                  id="metaInput"
                  type="number"
                  placeholder="ex: 10"
                  min="1"
                  value={local.meta}
                  onChange={(e) => handleChange('meta', e.target.value)}
                />
              </div>
            </div>
          </div>
        ) : null}

        {/* ============================================
            TAB 2 — INTEGRAÇÕES
            ============================================ */}
        {activeTab === 'integrations' ? (
          <div className="settings-tab" role="tabpanel">
            <IntegrationCard
              icon="fa-wand-magic-sparkles"
              name="Google Gemini"
              status={geminiStatus}
              statusLabel={geminiStatusLabel}
            >
              <div className="form-group full-width">
                <input
                  id="apiKeyInput"
                  type="password"
                  placeholder="Cole sua chave aqui (AIzaSy...)"
                  value={local.apiKey}
                  onChange={(e) => handleChange('apiKey', e.target.value)}
                />
                <p className="modal-description">
                  Necessária pra busca inteligente e análises do Fora do Radar.{' '}
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Gerar chave grátis
                  </a>
                </p>
              </div>
            </IntegrationCard>

            <IntegrationCard
              icon="fa-list-check"
              name="ClickUp"
              status={clickupStatus}
              statusLabel={clickupStatusLabel}
            >
              <div className="form-group full-width">
                <input
                  id="clickupTokenInput"
                  type="password"
                  placeholder="pk_..."
                  value={local.clickupToken}
                  onChange={(e) => handleChange('clickupToken', e.target.value)}
                />
                <p className="modal-description">
                  Gere em{' '}
                  <a
                    href="https://app.clickup.com/settings/apps"
                    target="_blank"
                    rel="noreferrer"
                  >
                    app.clickup.com/settings/apps
                  </a>
                  . Notifica novas tarefas, deadlines, atrasos e eventos do Radar (novos + 2 semanas, 1 semana e 1 dia antes).
                </p>
                <div className="integration-test">
                  <div className="integration-test__row">
                    <button
                      type="button"
                      className="integration-test__btn"
                      onClick={handleTestClickUp}
                      disabled={!local.clickupToken.trim() || clickupTest.status === 'testing'}
                    >
                      {clickupTest.status === 'testing' ? (
                        <>
                          <i className="fa-solid fa-spinner fa-spin"></i> Testando…
                        </>
                      ) : (
                        <>
                          <i className="fa-solid fa-plug"></i> Testar conexão
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      className="integration-test__btn integration-test__btn--accent"
                      onClick={() => handleSyncClickUp(false)}
                      disabled={!local.clickupToken.trim() || clickupSyncing}
                      title="Busca tarefas agora e dispara notificações pra mudanças desde a última sync"
                    >
                      {clickupSyncing ? (
                        <>
                          <i className="fa-solid fa-spinner fa-spin"></i> Sincronizando…
                        </>
                      ) : (
                        <>
                          <i className="fa-solid fa-rotate"></i> Sincronizar agora
                        </>
                      )}
                    </button>
                  </div>
                  {clickupTest.status === 'success' && clickupTest.user ? (
                    <div className="integration-test__result integration-test__result--ok">
                      <i className="fa-solid fa-circle-check"></i>
                      <span>
                        Conectado como <strong>{clickupTest.user.username}</strong>
                        {clickupTest.teams?.length
                          ? ` · ${clickupTest.teams.length} workspace${clickupTest.teams.length === 1 ? '' : 's'}`
                          : ''}
                      </span>
                    </div>
                  ) : null}
                  {clickupTest.status === 'error' ? (
                    <div className="integration-test__result integration-test__result--err">
                      <i className="fa-solid fa-circle-exclamation"></i>
                      <span>{clickupTest.error}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            </IntegrationCard>
          </div>
        ) : null}

        {/* ============================================
            TAB 3 — TEMPLATES
            ============================================ */}
        {activeTab === 'templates' ? (
          <div className="settings-tab" role="tabpanel">
            <p className="settings-tab__intro">
              HTML que vai pra área de transferência ao clicar nos botões de marcação no header.
            </p>
            <div className="form-grid">
              <div className="form-group full-width">
                <label htmlFor="solutionTagInput">
                  <i className="fa-solid fa-clipboard-check" style={{ marginRight: 6, color: 'var(--cor-facil)' }}></i>
                  Tag de Solução
                </label>
                <textarea
                  id="solutionTagInput"
                  rows="4"
                  placeholder="Texto da marcação de solução..."
                  value={local.solutionTag}
                  onChange={(e) => handleChange('solutionTag', e.target.value)}
                />
              </div>
              <div className="form-group full-width">
                <label htmlFor="feedbackTagInput">
                  <i className="fa-solid fa-clipboard-question" style={{ marginRight: 6, color: 'var(--cor-feedback)' }}></i>
                  Tag de Feedback
                </label>
                <textarea
                  id="feedbackTagInput"
                  rows="4"
                  placeholder="Texto da marcação de feedback..."
                  value={local.feedbackTag}
                  onChange={(e) => handleChange('feedbackTag', e.target.value)}
                />
              </div>
            </div>
          </div>
        ) : null}

        {/* ============================================
            TAB 4 — SISTEMA
            ============================================ */}
        {activeTab === 'system' ? (
          <div className="settings-tab" role="tabpanel">
            <div className="settings-tab__group">
              <h4 className="settings-tab__group-title">Aparência</h4>
              <div className="theme-switch-wrapper">
                <label htmlFor="theme-toggle-modal">
                  <i className="fa-solid fa-moon" style={{ marginRight: 8, color: 'var(--cor-ia)' }}></i>
                  Ativar Dark Mode
                </label>
                <label className="theme-switch">
                  <input
                    type="checkbox"
                    id="theme-toggle-modal"
                    checked={theme === 'dark'}
                    onChange={(e) => onThemeChange(e.target.checked ? 'dark' : 'light')}
                  />
                  <span className="slider-switch round"></span>
                </label>
              </div>
            </div>

            <div className="settings-tab__group">
              <h4 className="settings-tab__group-title">Diagnóstico</h4>
              <button
                type="button"
                className="settings-redirect-btn"
                onClick={() => {
                  onClose();
                  navigate('/status');
                }}
              >
                <i className="fa-solid fa-stethoscope settings-redirect-btn__icon"></i>
                <div className="settings-redirect-btn__text">
                  <strong>Status do sistema</strong>
                  <span>Diagnóstico das fontes de dados (Tópicos, Mural, ClickUp etc)</span>
                </div>
                <i className="fa-solid fa-chevron-right settings-redirect-btn__chev"></i>
              </button>
            </div>

            <div className="settings-tab__group">
              <h4 className="settings-tab__group-title">Manutenção</h4>
              <button
                type="button"
                className="settings-clear-btn"
                onClick={handleClearAllNotifications}
              >
                <i className="fa-solid fa-broom"></i>
                Limpar todas as notificações
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="modal-footer">
        <button id="cancelButton" className="secondary" onClick={onClose}>
          Cancelar
        </button>
        <button id="saveButton" className="primary" onClick={handleSave}>
          Salvar
        </button>
      </div>
    </div>
  );
};

export default SettingsModal;
