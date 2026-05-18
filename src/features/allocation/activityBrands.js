/*
  "Marcas" de atividade — cor + ícone/imagem.

  O lookup é case-insensitive e por inclusão (a string da atividade só precisa
  CONTER a chave). Ex: "Alura Latam — Espanhol" bate em "alura latam".

  Pra adicionar uma marca nova, adicione um item aqui. Ordem importa: a
  primeira chave que casa ganha. Coloque variantes específicas antes das
  genéricas (ex: "fórum helper" antes de "fórum").

  Campos suportados:
    - match     (string)  chave de busca por inclusão case-insensitive
    - icon      (string)  classe FontAwesome (ex: 'fa-solid fa-rocket')
    - image     (string)  import opcional. Quando presente, renderiza
                          <img> em vez de <i>.
    - color     (string)  cor base — usada no fundo do ícone, na borda
                          e em gradientes do banner
    - solidBg   (boolean) se true, container usa cor sólida (não translúcida)
                          como fundo. Útil pra logos brancas sobre transparente
                          (ex: Latam) que precisam de fundo escuro pra aparecer.
    - imageZoom (number)  scale aplicado à <img> dentro do container. Default 1.
                          Use > 1 quando a logo tem muito espaço em branco em
                          volta (ex: Latam = 1.6).
    - imageWhite (boolean) aplica filter `brightness(0) invert(1)` na imagem
                          → vira branca pura. Útil pra logos monocromáticas
                          escuras que precisam contrastar com fundo escuro.
    - gradient  (string)  CSS gradient custom pro fundo do container.
                          Sobrescreve solidBg/cor base. Use pra fundos
                          dramáticos (ex: Latam preto→azul Alura).

  NOTA: subtitle foi removido. O subtítulo do card mostra só cadência/Fixo,
  sem "Moderação/Produção/etc" antes — decisão de design.
*/

import articleImg     from '../../assets/activities/article.png';
import forumImg       from '../../assets/activities/forum.png';
import suggestionsImg from '../../assets/activities/suggestions.svg';
import moderadorImg   from '../../assets/activities/moderador.svg';
import latamImg       from '../../assets/activities/latam.png';
import forumHelperImg from '../../assets/icon.png';

// Paleta refinada: tons profundos e harmônicos (Material 3 / Tailwind 700).
// Saturação alta mas brilho controlado — nada de neon, nada de pastel.
// Cada brand tem sua própria família de cor pra não virar monotonia.
// Fundo padrão escuro neutro — slate gradient sóbrio, look "Notion/Linear".
// Aplicado em TODAS as brands exceto Discord/WhatsApp (cores oficiais).
const DEFAULT_GRADIENT = 'linear-gradient(135deg, #0F172A 0%, #1E293B 60%, #334155 100%)';
const DEFAULT_COLOR    = '#334155';

// `icon` + `iconColor` são usados em contextos compactos onde a `image`
// fica grande demais (ex: carrossel do sidebar). No painel principal a
// `image` continua sendo o protagonista visual.
export const ACTIVITY_BRANDS = [
  { match: 'discord',           icon: 'fa-brands fa-discord',  iconColor: '#5865F2', color: '#5865F2' },
  { match: 'whats',             icon: 'fa-brands fa-whatsapp', iconColor: '#25D366', color: '#25D366' },

  // Latam.
  { match: 'alura latam',       image: latamImg, icon: 'fa-solid fa-earth-americas', iconColor: '#10B981',
    color: DEFAULT_COLOR, gradient: DEFAULT_GRADIENT, imageZoom: 1.6 },
  { match: 'latam',             image: latamImg, icon: 'fa-solid fa-earth-americas', iconColor: '#10B981',
    color: DEFAULT_COLOR, gradient: DEFAULT_GRADIENT, imageZoom: 1.6 },

  // Fórum Helper: ANTES de "fórum" — o match é por inclusão.
  { match: 'fórum helper',      image: forumHelperImg, icon: 'fa-solid fa-screwdriver-wrench', iconColor: '#7C3AED',
    color: DEFAULT_COLOR, gradient: DEFAULT_GRADIENT },
  { match: 'forum helper',      image: forumHelperImg, icon: 'fa-solid fa-screwdriver-wrench', iconColor: '#7C3AED',
    color: DEFAULT_COLOR, gradient: DEFAULT_GRADIENT },

  // Demais.
  { match: 'revisão de artigo', image: articleImg, icon: 'fa-solid fa-pen-nib', iconColor: '#F59E0B',
    color: DEFAULT_COLOR, gradient: DEFAULT_GRADIENT, imageWhite: true },
  { match: 'artigo',            image: articleImg, icon: 'fa-solid fa-pen-nib', iconColor: '#F59E0B',
    color: DEFAULT_COLOR, gradient: DEFAULT_GRADIENT, imageWhite: true },
  { match: 'imersão',           image: moderadorImg, icon: 'fa-solid fa-shield-halved', iconColor: '#A855F7',
    color: DEFAULT_COLOR, gradient: DEFAULT_GRADIENT, imageWhite: true },
  { match: 'fórum',             image: forumImg, icon: 'fa-solid fa-comments', iconColor: '#3B82F6',
    color: DEFAULT_COLOR, gradient: DEFAULT_GRADIENT, imageWhite: true },
  { match: 'forum',             image: forumImg, icon: 'fa-solid fa-comments', iconColor: '#3B82F6',
    color: DEFAULT_COLOR, gradient: DEFAULT_GRADIENT, imageWhite: true },
  { match: 'sugest',            image: suggestionsImg, icon: 'fa-solid fa-lightbulb', iconColor: '#EC4899',
    color: DEFAULT_COLOR, gradient: DEFAULT_GRADIENT, imageWhite: true },
];

const DEFAULT_BRAND = {
  icon: 'fa-solid fa-circle-dot',
  color: '#71717A',
};

export function brandFor(nome) {
  if (!nome) return DEFAULT_BRAND;
  const key = String(nome).toLowerCase();
  for (const b of ACTIVITY_BRANDS) {
    if (key.includes(b.match)) return b;
  }
  return DEFAULT_BRAND;
}

/*
  Style inline pro container do ícone — background, color, border e shadow
  consistentes em todos os lugares que renderizam um brand. Usa `gradient`
  custom quando definido; senão deriva da cor base (sólido vs translúcido).

  Sombra colorida sutil (não-blur) dá elevação sem turvar a imagem.
*/
export function brandContainerStyle(brand) {
  if (!brand) return undefined;
  const bg = brand.gradient
    || (brand.solidBg
      ? `linear-gradient(135deg, ${brand.color}, ${brand.color}D8)`
      : `linear-gradient(160deg, ${brand.color}26, ${brand.color}0A)`);
  return {
    color: brand.color,
    background: bg,
    borderColor: 'transparent',
    boxShadow: `0 1px 2px rgba(0,0,0,0.05), 0 2px 6px ${brand.color}1A`,
  };
}

/*
  Style inline pra <img> de brand — aplica transform (zoom) e/ou filter
  (white). Retorna undefined quando nenhum aplica, pra não criar style
  desnecessário. Usado nos 5 lugares que renderizam brand.image.
*/
export function brandImageStyle(brand) {
  if (!brand?.imageZoom && !brand?.imageWhite) return undefined;
  const s = {};
  if (brand.imageZoom) s.transform = `scale(${brand.imageZoom})`;
  if (brand.imageWhite) {
    // Drop-shadow alinhado com o do CSS (mais sutil que antes pra não
    // borrar o ícone branco em fundo escuro).
    s.filter = 'brightness(0) invert(1) drop-shadow(0 1px 1px rgba(0,0,0,0.18))';
  }
  return s;
}

