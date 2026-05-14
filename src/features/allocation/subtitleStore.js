/*
  Subtítulo customizado por estação, salvo no localStorage. Backend não tem
  campo `subtitulo` na atividade — então fica client-side por enquanto.
  Chave canônica: nome da estação em lowercase + trim (mesma normalização do
  agrupamento em useAllocation).
*/

const KEY = 'alloc_subtitle_v1';

function readAll() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    return obj && typeof obj === 'object' ? obj : {};
  } catch {
    return {};
  }
}

function writeAll(obj) {
  try { localStorage.setItem(KEY, JSON.stringify(obj)); } catch {}
}

function keyOf(stationName) {
  return String(stationName || '').trim().toLowerCase();
}

export function getStationSubtitle(stationName) {
  const k = keyOf(stationName);
  if (!k) return '';
  return readAll()[k] || '';
}

export function setStationSubtitle(stationName, subtitle) {
  const k = keyOf(stationName);
  if (!k) return;
  const all = readAll();
  const clean = String(subtitle || '').trim();
  if (clean) all[k] = clean;
  else delete all[k];
  writeAll(all);
}
