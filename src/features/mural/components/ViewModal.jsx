import React from 'react';
import {
  TYPE_ICONS,
  getDateStatus,
  renderMarkdown,
  toDisplayName,
} from '../helpers';

function ViewModal({ card, isOwner, isPinned, onClose, onEdit, onDelete, onPin, teamAvatars }) {
  const iconClass = TYPE_ICONS[card.type] || 'fa-tag';
  const tagStyle = {
    padding: '5px 12px',
    borderRadius: 8,
    fontWeight: 700,
    fontSize: '0.75rem',
    background: `${card.color}20`,
    color: card.color,
    border: `1px solid ${card.color}40`,
  };

  const parts = [];
  if (card.endDate) {
    const status = getDateStatus(card.endDate);
    const color = status === 'urgent' ? '#ef4444' : status === 'warning' ? '#f59e0b' : 'inherit';
    const icon = status === 'urgent' ? 'fa-exclamation-circle' : status === 'warning' ? 'fa-clock' : 'fa-calendar-alt';
    parts.push(`<i class="fas ${icon}" style="color:${color}"></i><span style="color:${color}">Até ${card.endDate.split('-').reverse().join('/')}</span>`);
  }
  if (card.createdAt) {
    parts.push(`<i class="fas fa-calendar-plus"></i>${new Date(card.createdAt).toLocaleDateString('pt-BR')}`);
  }
  const dateLine = parts.join('<span style="opacity:.3;margin:0 4px">·</span>');

  return (
    <div id="view-card-modal" className="mural-modal-overlay" style={{ display: 'flex' }}>
      <div className="mural-modal-content view-modal-custom" style={{ borderTop: `5px solid ${card.color}` }}>
        <div className="view-modal-actions">
          <button
            className="btn-view-action"
            title={isPinned ? 'Desfixar' : 'Favoritar'}
            onClick={onPin}
            style={{ color: isPinned ? '#f59e0b' : 'var(--light-text-color)' }}
          >
            <i className="fas fa-thumbtack"></i>
          </button>
          {isOwner ? (
            <button className="btn-view-action" title="Editar Card" onClick={onEdit}><i className="fas fa-pen"></i></button>
          ) : null}
          {isOwner ? (
            <button className="btn-view-action" title="Apagar Card" onClick={onDelete}><i className="fas fa-trash-alt"></i></button>
          ) : null}
          <button className="btn-view-action" title="Fechar" onClick={onClose}><i className="fas fa-times"></i></button>
        </div>

        <div className="view-modal-body">
          <div className="view-modal-meta-top">
            <span className="view-tag" style={tagStyle}><i className={`fas ${iconClass}`}></i> {card.type}</span>
            {card.isPrivate ? (
              <span
                className="view-visibility"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  color: '#64748b',
                  background: 'rgba(100,116,139,0.1)',
                  padding: '5px 12px',
                  borderRadius: 8,
                }}
              >
                <i className="fas fa-lock"></i> Card Privado
              </span>
            ) : card.visibilityAll ? (
              <span className="view-visibility" style={{ display: 'flex' }}>
                <i className="fas fa-users"></i> Público
              </span>
            ) : null}
          </div>

          <h2 className="view-title">{card.title}</h2>

          <div className="view-modal-meta-bottom">
            <div className="view-author">
              <i className="fas fa-pen-nib"></i> {card.createdBy ? toDisplayName(card.createdBy) : 'Alguém'}
            </div>
            <div className="view-date" dangerouslySetInnerHTML={{ __html: dateLine }} />
          </div>

          <div className="view-link-container">
            {card.link ? (
              <a href={card.link} target="_blank" rel="noopener noreferrer">
                <i className="fas fa-external-link-alt"></i> Acessar Link
              </a>
            ) : null}
          </div>

          <div className="view-desc-container">
            <div
              className="markdown-content"
              dangerouslySetInnerHTML={{
                __html: renderMarkdown(card.description) || '<i style="color:var(--light-text-color)">Nenhuma descrição fornecida.</i>',
              }}
            />
          </div>

          {card.visibilityAll || (card.assignees && card.assignees.length > 0) ? (
            <div className="view-assignees-container" style={{ display: 'block' }}>
              <span className="view-section-title">Membros</span>
              <div className="view-assignees-grid">
                {card.visibilityAll ? (
                  <div
                    className="assignee-chip"
                    style={{
                      paddingLeft: 12,
                      background: 'rgba(123,113,255,0.05)',
                      borderColor: 'rgba(123,113,255,0.2)',
                      color: 'var(--cor-ia)',
                    }}
                  >
                    <i className="fas fa-globe"></i> Visível para todos
                  </div>
                ) : (
                  (card.assignees || []).map((u) => (
                    <div key={u} className="assignee-chip">
                      <img
                        src={teamAvatars[u] || `https://ui-avatars.com/api/?name=${u}`}
                        alt={u}
                        style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }}
                      />
                      <span>{toDisplayName(u)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default ViewModal;
