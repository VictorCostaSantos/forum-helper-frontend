import React from 'react';
import {
  TYPE_ICONS,
  getDateStatus,
  renderMarkdown,
  nameToHsl,
} from '../helpers';

function CardItem({ card, isOwner, isPinned, onView, onEdit, onArchive, onDelete, onPin }) {
  const iconClass = TYPE_ICONS[card.type] || 'fa-tag';
  const tagStyle = { background: `${card.color}20`, color: card.color, borderColor: `${card.color}40` };
  const cardClasses = ['notice-card', card.isPrivate ? 'is-private' : '', isPinned ? 'is-pinned' : ''].filter(Boolean).join(' ');

  let dateBlock = null;
  if (card.endDate) {
    const status = getDateStatus(card.endDate);
    let icon = 'far fa-calendar-alt';
    let color = 'var(--light-text-color)';
    if (status === 'urgent') { icon = 'fas fa-exclamation-circle'; color = '#ef4444'; }
    else if (status === 'warning') { icon = 'fas fa-clock'; color = '#f59e0b'; }
    const end = card.endDate.split('-').reverse().slice(0, 2).join('/');
    dateBlock = (
      <span style={{ fontSize: '0.8rem', color, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 5 }}>
        <i className={icon}></i> Até {end}
      </span>
    );
  }

  let assigneesBlock = null;
  if (card.visibilityAll) {
    assigneesBlock = (
      <span style={{ fontSize: '0.75rem', color: 'var(--cor-ia)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 5 }}>
        <i className="fas fa-users"></i> Todos
      </span>
    );
  } else if (card.assignees && card.assignees.length > 0) {
    const shown = card.assignees.slice(0, 4);
    assigneesBlock = (
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {shown.map((name, i) => (
          <div key={name} className="mural-mini-avatar" title={`@${name}`} style={{ background: nameToHsl(name), zIndex: 10 - i }}>
            {name.charAt(0).toUpperCase()}
          </div>
        ))}
        {card.assignees.length > 4 ? (
          <div className="mural-mini-avatar" style={{ background: '#e2e8f0', color: '#475569', zIndex: 0 }}>
            +{card.assignees.length - 4}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="notice-card-wrap">
      <div className={cardClasses} style={{ '--card-color': card.color, cursor: 'pointer' }} onClick={onView}>
        <div className="notice-card-header">
          <span style={{ padding: '4px 10px', borderRadius: 6, fontWeight: 700, fontSize: '0.72rem', border: '1px solid transparent', ...tagStyle }}>
            <i className={`fas ${iconClass}`}></i> {card.type}
            {card.isPrivate ? <i className="fas fa-lock" style={{ fontSize: '0.65rem', opacity: 0.7, marginLeft: 4 }} title="Privado"></i> : null}
          </span>
          <div className="card-hover-actions">
            {isOwner ? (
              card.isArchived ? (
                <>
                  <button className="card-hover-btn btn-action-card btn-action-restore" title="Restaurar" onClick={(e) => { e.stopPropagation(); onArchive(false); }}>
                    <i className="fas fa-undo"></i>
                  </button>
                  <button className="card-hover-btn btn-action-card btn-action-delete" title="Excluir definitivamente" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
                    <i className="fas fa-times-circle"></i>
                  </button>
                </>
              ) : (
                <>
                  <button className="card-hover-btn edit btn-action-card btn-action-edit" title="Editar" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                    <i className="fas fa-pen"></i>
                  </button>
                  <button className="card-hover-btn btn-action-card btn-action-archive" title="Arquivar" onClick={(e) => { e.stopPropagation(); onArchive(true); }}>
                    <i className="fas fa-archive"></i>
                  </button>
                </>
              )
            ) : null}
            <button
              className={`card-hover-btn btn-action-card btn-action-pin ${isPinned ? 'is-pinned' : ''}`}
              title={isPinned ? 'Desfixar' : 'Fixar no topo'}
              onClick={(e) => { e.stopPropagation(); onPin(); }}
            >
              <i className="fas fa-thumbtack"></i>
            </button>
          </div>
        </div>
        <div className="notice-card-content-area">
          <h3 className="notice-card-title">{card.title}</h3>
          {card.description ? (
            <div className="card-preview" dangerouslySetInnerHTML={{ __html: renderMarkdown(card.description) }} />
          ) : null}
        </div>
        <div className="notice-card-footer">
          <div className="notice-card-footer-left">
            {assigneesBlock}
            {dateBlock}
          </div>
          {card.link ? (
            <a href={card.link} target="_blank" rel="noopener noreferrer" className="card-link-btn" onClick={(e) => e.stopPropagation()}>
              <i className="fas fa-external-link-alt"></i> Acessar
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default CardItem;
