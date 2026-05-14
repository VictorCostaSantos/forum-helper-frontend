/*
  "Marcas" de atividade — cor + ícone + subtítulo padrão.

  O lookup é case-insensitive e por inclusão (a string da atividade só precisa
  CONTER a chave). Ex: "Alura Latam — Espanhol" bate em "alura latam".

  Pra adicionar uma marca nova, adicione um item aqui. Ordem importa: a
  primeira chave que casa ganha. Coloque variantes específicas antes das
  genéricas (ex: "fórum helper" antes de "fórum").
*/

export const ACTIVITY_BRANDS = [
  { match: 'discord',          icon: 'fa-brands fa-discord',         color: '#5865F2', subtitle: 'Moderação' },
  { match: 'alura latam',      icon: 'fa-solid fa-earth-americas',   color: '#10B981', subtitle: 'Fórum em Espanhol' },
  { match: 'latam',            icon: 'fa-solid fa-earth-americas',   color: '#10B981', subtitle: 'Fórum em Espanhol' },
  { match: 'revisão de artigo',icon: 'fa-solid fa-eye',              color: '#F59E0B', subtitle: 'Revisão técnica' },
  { match: 'artigo',           icon: 'fa-solid fa-pen-nib',          color: '#F59E0B', subtitle: 'Produção' },
  { match: 'imersão',          icon: 'fa-solid fa-rocket',           color: '#FF8C2A', subtitle: 'Evento temporário' },
  { match: 'fórum helper',     icon: 'fa-solid fa-screwdriver-wrench', color: '#7B71FF', subtitle: 'Ferramenta interna' },
  { match: 'forum helper',     icon: 'fa-solid fa-screwdriver-wrench', color: '#7B71FF', subtitle: 'Ferramenta interna' },
  { match: 'fórum',            icon: 'fa-solid fa-comments',         color: '#3B82F6', subtitle: 'Suporte público' },
  { match: 'forum',            icon: 'fa-solid fa-comments',         color: '#3B82F6', subtitle: 'Suporte público' },
  { match: 'whats',            icon: 'fa-brands fa-whatsapp',        color: '#25D366', subtitle: 'Comunidade' },
  { match: 'sugest',           icon: 'fa-solid fa-lightbulb',        color: '#EC4899', subtitle: 'Página de sugestões' },
];

const DEFAULT_BRAND = {
  icon: 'fa-solid fa-circle-dot',
  color: '#71717A',
  subtitle: 'Atividade',
};

export function brandFor(nome) {
  if (!nome) return DEFAULT_BRAND;
  const key = String(nome).toLowerCase();
  for (const b of ACTIVITY_BRANDS) {
    if (key.includes(b.match)) return b;
  }
  return DEFAULT_BRAND;
}

// Subtítulo customizado por estação mora em subtitleStore.js; re-exportamos
// aqui com nomes alternativos pra retrocompatibilidade dos consumidores que
// importam de activityBrands.
export {
  getStationSubtitle as getCustomSubtitle,
  setStationSubtitle as setCustomSubtitle,
} from './subtitleStore';
