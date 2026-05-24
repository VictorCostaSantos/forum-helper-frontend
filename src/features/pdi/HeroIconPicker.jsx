import React, { useEffect, useState } from 'react';
import { PDI_EMOJIS } from './pdiData';

// Popover de escolha do ícone do PDI: grid de emojis curados + campo pra
// digitar qualquer emoji + campo de URL pra foto que vira avatar.
function HeroIconPicker({
  emoji,
  avatarUrl,
  onPickEmoji,
  onSetAvatar,
  onClearAvatar,
  onClose,
}) {
  const [customEmoji, setCustomEmoji] = useState('');
  const [urlDraft, setUrlDraft] = useState(avatarUrl || '');

  useEffect(() => { setUrlDraft(avatarUrl || ''); }, [avatarUrl]);

  const commitUrl = () => {
    const trimmed = urlDraft.trim();
    if (trimmed && trimmed !== avatarUrl) onSetAvatar(trimmed);
    else if (!trimmed && avatarUrl) onClearAvatar();
  };

  return (
    <div className="hero__icon-picker" onClick={(e) => e.stopPropagation()}>
      <div className="hero__icon-grid">
        {PDI_EMOJIS.map((e) => (
          <button
            key={e}
            type="button"
            className={`hero__icon-opt ${e === emoji && !avatarUrl ? 'is-active' : ''}`}
            onClick={() => { onPickEmoji(e); onClose?.(); }}
            title={e}
          >
            {e}
          </button>
        ))}
      </div>

      <div className="hero__icon-divider" />

      <label className="hero__icon-row">
        <span className="hero__icon-lbl">Outro emoji</span>
        <input
          className="hero__icon-input"
          type="text"
          placeholder="Cole/digite..."
          value={customEmoji}
          maxLength={4}
          onChange={(e) => setCustomEmoji(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && customEmoji.trim()) {
              onPickEmoji(customEmoji.trim());
              setCustomEmoji('');
              onClose?.();
            }
          }}
        />
      </label>

      <label className="hero__icon-row">
        <span className="hero__icon-lbl">Foto (URL)</span>
        <input
          className="hero__icon-input"
          type="url"
          placeholder="https://..."
          value={urlDraft}
          onChange={(e) => setUrlDraft(e.target.value)}
          onBlur={commitUrl}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commitUrl(); onClose?.(); }
          }}
        />
        {avatarUrl ? (
          <button
            type="button"
            className="hero__icon-clear"
            onClick={() => { onClearAvatar(); setUrlDraft(''); }}
            title="Remover foto"
          >
            <i className="fa-solid fa-trash"></i>
          </button>
        ) : null}
      </label>
    </div>
  );
}

export default HeroIconPicker;
