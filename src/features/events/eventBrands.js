// Detecção de marcas a partir do nome da tarefa do Radar de Eventos do ClickUp.
//
// Como adicionar nova marca:
//   1. (opcional) salvar logo PNG transparente em /src/assets/events/{key}.png
//   2. importar a logo aqui (ou deixar `logo: null` pra usar o fallback)
//   3. adicionar uma entrada no array EVENT_BRANDS
//
// O `match` é regex case-insensitive testado contra task.name. A primeira
// marca que bater ganha — ordem importa quando há ambiguidade. Marcas mais
// específicas devem vir antes das genéricas (ex: Google antes de Imersão).
//
// Cores oficiais das marcas vêm dos brand books (brandfetch.com). O banner
// usa estilo "frosted glass" com blobs coloridos — cada marca define accent
// (cor sólida principal) e a paleta de blobs vem do CSS por classe de tema.

import santanderLogo from '../../assets/events/santander1.png';
import oracleLogo from '../../assets/events/Oracle_ideA555_no_1.png';
import googleLogo from '../../assets/events/google1.png';
import aluraLogo from '../../assets/events/alura.png';

export const EVENT_BRANDS = [
  {
    key: 'santander',
    name: 'Santander',
    match: /santander/i,
    accent: '#EA1D25', // Alizarin Crimson — oficial
    logo: santanderLogo,
  },
  {
    key: 'oracle',
    name: 'Oracle ONE',
    match: /oracle/i,
    accent: '#C74634', // Mojo — oficial Oracle
    logo: oracleLogo,
  },
  {
    key: 'google',
    name: 'Google',
    match: /google/i,
    accent: '#4285F4', // Cornflower Blue — oficial Google
    logo: googleLogo,
  },
  {
    key: 'alura',
    name: 'Alura',
    // Catch-all pra Imersões sem marca-parceira reconhecível.
    match: /imers[ãa]o|alura/i,
    accent: '#051933', // Black Pearl — cor primária Alura
    logo: aluraLogo,
  },
];

const DEFAULT_BRAND = {
  key: 'default',
  name: null,
  accent: '#495057',
  logo: null,
};

export function detectBrand(taskName = '') {
  return EVENT_BRANDS.find((b) => b.match.test(taskName)) || DEFAULT_BRAND;
}
