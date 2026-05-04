import React from 'react';
import { TEAM_MEMBERS, toDisplayName } from '../helpers';

function FormModal({
  form,
  setForm,
  submitting,
  onSubmit,
  onClose,
  isEdit,
  handleAssigneesAll,
  handlePrivateToggle,
  toggleAssignee,
  teamAvatars,
}) {
  const counter = (form.description || '').length;

  return (
    <div id="mural-modal" className="mural-modal-overlay" style={{ display: 'flex' }}>
      <div className="mural-modal-content" style={{ maxWidth: 640, width: '95%' }}>
        <div className="mural-modal-header">
          <h3 id="modal-mural-title">
            <i className={isEdit ? 'fas fa-pen' : 'fas fa-plus-circle'}></i> {isEdit ? 'Editar Card' : 'Novo Card'}
          </h3>
          <button className="btn-modal-close" type="button" title="Fechar" onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>

        <form id="form-add-task" onSubmit={onSubmit}>
          <div className="mural-modal-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
            <div className="mural-input-group">
              <label>Título</label>
              <input
                type="text"
                id="task-title"
                required
                placeholder="Ex: Links da Imersão, Atualizar Planilha..."
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              />
            </div>

            <div className="mural-form-grid">
              <div className="mural-input-group">
                <label>Categoria</label>
                <select
                  id="task-type"
                  value={form.type}
                  onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
                >
                  <option value="Aviso">Aviso</option>
                  <option value="Demanda">Demanda</option>
                  <option value="Link Útil">Link Útil</option>
                  <option value="Projeto">Projeto</option>
                  <option value="Reunião">Reunião</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>
              <div className="mural-input-group">
                <label>Prazo Limite (Opcional)</label>
                <input
                  type="date"
                  id="task-end-date"
                  value={form.endDate}
                  onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))}
                />
              </div>
            </div>

            <div className="mural-input-group">
              <label>Conteúdo (Suporta Markdown) <i className="fab fa-markdown" style={{ color: '#999' }}></i></label>
              <textarea
                id="task-desc"
                rows="5"
                maxLength="5000"
                placeholder="Pode colar imagens ![nome](url) e links..."
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              />
              <div style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--light-text-color)', marginTop: -3 }}>
                <span id="task-desc-counter">{counter}</span> / 5000
              </div>
            </div>

            <div className="mural-input-group">
              <label>Link Principal de Apoio (Opcional)</label>
              <input
                type="url"
                id="task-link"
                placeholder="https://..."
                value={form.link}
                onChange={(e) => setForm((p) => ({ ...p, link: e.target.value }))}
              />
            </div>

            <hr style={{ border: 0, borderTop: '1px solid var(--border-color)', margin: '5px 0' }} />

            <div className="mural-input-group">
              <div className="mural-toggle-container">
                <span className="mural-toggle-label"><i className="fas fa-users"></i> Toda equipe?</span>
                <label className="mural-switch">
                  <input
                    type="checkbox"
                    id="task-everyone"
                    checked={form.visibilityAll}
                    disabled={form.isPrivate}
                    onChange={(e) => handleAssigneesAll(e.target.checked)}
                  />
                  <span className="mural-slider"></span>
                </label>
              </div>
              <div className="mural-toggle-container" style={{ marginTop: 10 }}>
                <span className="mural-toggle-label"><i className="fas fa-lock"></i> Card privado (só você)?</span>
                <label className="mural-switch">
                  <input
                    type="checkbox"
                    id="task-private"
                    checked={form.isPrivate}
                    disabled={isEdit}
                    onChange={(e) => handlePrivateToggle(e.target.checked)}
                  />
                  <span className="mural-slider"></span>
                </label>
              </div>

              <div id="team-checkbox-list" className="team-avatar-selector">
                {TEAM_MEMBERS.map((m) => (
                  <label key={m} className="team-avatar-toggle" title={toDisplayName(m)}>
                    <input
                      type="checkbox"
                      className="team-checkbox"
                      value={m}
                      checked={form.assignees.includes(m)}
                      disabled={form.isPrivate}
                      onChange={() => toggleAssignee(m)}
                    />
                    <div className="team-avatar-wrapper">
                      <img src={teamAvatars[m] || `https://ui-avatars.com/api/?name=${m}`} alt={toDisplayName(m)} />
                      <div className="team-avatar-check"><i className="fas fa-check"></i></div>
                    </div>
                    <span className="team-avatar-name">{toDisplayName(m)}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="mural-modal-footer">
            <button type="button" className="btn-mural-cancel" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-mural-submit" disabled={submitting}>
              <i className={submitting ? 'fas fa-spinner fa-spin' : 'fas fa-save'}></i> {submitting ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default FormModal;
