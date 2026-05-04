// Geração do HTML da recomendação copiada (3 formatos: card, list, text).
import { ICONS } from './helpers';

function escapeHtml(t) {
  return String(t || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function removeEmojis(text) {
  if (!text) return '';
  return text
    .replace(
      /([✀-➿]|[-]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[‑-⛿]|\uD83E[\uDD10-\uDDFF])/g,
      ''
    )
    .trim();
}

function resolveIcon(kindRaw, existingIcon) {
  if (existingIcon && existingIcon.startsWith('http') && !existingIcon.includes('undefined')) return existingIcon;
  const kind = (kindRaw || '').toUpperCase();
  if (kind.includes('VIDEO') || kind.includes('VÍDEO')) return ICONS.VIDEO;
  if (kind.includes('PODCAST')) return ICONS.PODCAST;
  if (kind.includes('ARTIGO') || kind.includes('POST')) return ICONS.ARTIGO;
  if (kind.includes('CURSO')) return ICONS.CURSO;
  if (kind.includes('FERRAMENTA') || kind.includes('CHALLENGE')) return ICONS.FERRAMENTA;
  if (kind.includes('DOC') || kind.includes('APOSTILA') || kind.includes('MANUAL')) return ICONS.DOC;
  return ICONS.DEFAULT;
}

function getOutputPriority(kind) {
  const k = (kind || '').toUpperCase();
  if (k.includes('CARREIRA') || k.includes('SOFT') || k.includes('PODCAST') || k.includes('HIPSTERS') || k.includes('LAYERS')) return 0;
  if (k.includes('FORMACAO') || k.includes('FORMAÇÃO') || k.includes('TRILHA')) return 1;
  return 2;
}

function parseDateText(t) {
  if (!t) return 0;
  const parts = t.split('/');
  if (parts.length !== 3) return 0;
  return new Date(parts[2], parts[1] - 1, parts[0]).getTime();
}

function sortItemsForOutput(items, allData) {
  return [...items].sort((a, b) => {
    const pa = getOutputPriority(a.kind);
    const pb = getOutputPriority(b.kind);
    if (pa !== pb) return pa - pb;
    const da = allData.find((d) => d.link === a.link);
    const db = allData.find((d) => d.link === b.link);
    return parseDateText(db?.date_text) - parseDateText(da?.date_text);
  });
}

function getCardStyle(items, intro) {
  const HEADER_ICON = 'https://cursos.alura.com.br/assets/images/classPage/icon-suggest.svg';
  const itemsHtml = items
    .map((i) => {
      const kindRaw = (i.kind || 'OUTRO').toUpperCase().trim();
      const kind = escapeHtml(kindRaw);
      const title = escapeHtml(removeEmojis(i.title));
      const link = escapeHtml(i.link);
      const iconUrl = resolveIcon(i.kind, i.icon);

      let badgeBg = '#e3f2fd';
      let badgeTxt = '#023570ff';
      if (kindRaw.includes('VIDEO') || kindRaw.includes('VÍDEO')) { badgeBg = '#ffebee'; badgeTxt = '#c62828'; }
      else if (kindRaw.includes('PODCAST')) { badgeBg = '#fff3e0'; badgeTxt = '#ef6c00'; }
      else if (kindRaw.includes('ARTIGO') || kindRaw.includes('POST')) { badgeBg = '#e0f7fa'; badgeTxt = '#006064'; }
      else if (kindRaw.includes('LEITURA')) { badgeBg = '#f5f5f5'; badgeTxt = '#616161'; }
      else if (kindRaw.includes('FERRAMENTA') || kindRaw.includes('PRÁTICA') || kindRaw.includes('EXERCÍCIO')) { badgeBg = '#f3e5f5'; badgeTxt = '#7b1fa2'; }

      return `<div style="margin-bottom:8px; background:#fff; border:1px solid #e1e4e8; border-radius:8px; padding:10px 14px; display:flex; align-items:flex-start; gap:10px; box-sizing:border-box;"><div style="width:28px; height:28px; flex-shrink:0; background:${badgeBg}; border-radius:6px; display:flex; align-items:center; justify-content:center;"><img src="${iconUrl}" width="16" height="16" style="object-fit:contain;" referrerpolicy="no-referrer"></div><div style="flex:1; min-width:0;"><div style="font-size:10px; font-weight:700; letter-spacing:0.5px; color:${badgeTxt}; text-transform:uppercase; margin-bottom:3px;">${kind}</div><a href="${link}" style="font-size:13px; font-weight:600; text-decoration:none; color:#0056b3; line-height:1.4; display:block; word-break:break-word;">${title}</a></div></div>`;
    })
    .join('');

  return `<div style="font-family:Arial,sans-serif; background:#edf1f2; color:#333; border-radius:10px; box-shadow:0 4px 6px rgba(0,0,0,0.1); border:1px solid #ddd; padding:20px; max-width:600px; box-sizing:border-box;"><div style="display:flex; align-items:center; gap:8px; margin-bottom:15px;"><img src="${HEADER_ICON}" width="20" height="20" referrerpolicy="no-referrer"><strong>${escapeHtml(intro)}</strong></div><div>${itemsHtml}</div></div>`;
}

function getListStyle(items, intro) {
  const HEADER_ICON = 'https://cursos.alura.com.br/assets/images/classPage/icon-suggest.svg';
  const itemsHtml = items
    .map((i) => {
      const kind = escapeHtml(i.kind || 'CONTEÚDO');
      const title = escapeHtml(removeEmojis(i.title));
      return `<li style="margin-bottom: 6px; font-size: 0.95em;"><strong style="color:#666; font-size:0.9em;">[${kind}]</strong> <a href="${escapeHtml(i.link)}" target="_blank" style="color:#2A7AE4; text-decoration:underline; font-weight:bold;">${title}</a></li>`;
    })
    .join('');
  return `<div style="font-family: Arial, sans-serif; line-height: 1.5; color: #333; max-width: 600px; box-sizing: border-box; border-left: 4px solid #2A7AE4; padding-left: 15px; background-color: #f9f9f9; padding: 15px;"><div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;"><img src="${HEADER_ICON}" width="16" height="16" referrerpolicy="no-referrer"><strong style="font-size: 1em;">${escapeHtml(intro)}</strong></div><ul style="margin: 0; padding-left: 20px; list-style-type: disc; width: 100%;">${itemsHtml}</ul></div>`;
}

function getTextStyle(items, intro) {
  const itemsHtml = items
    .map((i) => {
      const title = escapeHtml(removeEmojis(i.title));
      return `<li style="margin-bottom:5px;"><strong>${escapeHtml(i.kind)}:</strong> <a href="${escapeHtml(i.link)}" style="color:#0056b3; text-decoration:underline;">${title}</a></li>`;
    })
    .join('');
  return `<div style="font-family: Arial, sans-serif; color: #333; max-width: 600px;"><p style="font-weight:bold; margin-bottom:8px;">${escapeHtml(intro)}</p><ul style="margin: 0; padding-left: 20px; list-style-type: circle;">${itemsHtml}</ul></div>`;
}

export function buildHTMLString(items, format, allData, introLabel) {
  if (items.length === 0) return '<p>Nenhum item selecionado.</p>';
  const sorted = sortItemsForOutput(items, allData);
  if (format === 'list') return getListStyle(sorted, introLabel);
  if (format === 'text') return getTextStyle(sorted, introLabel);
  return getCardStyle(sorted, introLabel);
}
