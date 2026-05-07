import React, { useEffect, useMemo, useState } from 'react';

// Cache local "pegajoso" de avatares por username/nome. A Alura tá lenta às
// vezes e o backend cai no Portrait_Placeholder. Quando uma vez vimos a foto
// REAL de um colega, gravamos aqui — e nas próximas renders (mesmo que o
// backend volte a mandar placeholder) usamos a real.
//
// Cache survive entre navegações (localStorage) e expira em 30 dias pra dar
// chance de pegar foto nova caso a pessoa atualize.
const STICKY_KEY_PREFIX = 'sticky_avatar_v1_';
const STICKY_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function normalizeKey(name) {
  return (name || '').trim().toLowerCase();
}

function readStickyAvatar(name) {
  const k = normalizeKey(name);
  if (!k) return null;
  try {
    const raw = localStorage.getItem(STICKY_KEY_PREFIX + k);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.url) return null;
    if (Date.now() - (parsed.t || 0) > STICKY_TTL_MS) return null;
    return parsed.url;
  } catch {
    return null;
  }
}

function writeStickyAvatar(name, url) {
  const k = normalizeKey(name);
  if (!k || !url) return;
  try {
    localStorage.setItem(
      STICKY_KEY_PREFIX + k,
      JSON.stringify({ url, t: Date.now() }),
    );
  } catch {
    /* localStorage cheio, ok */
  }
}

// Avatar reutilizável: tenta carregar `src` (URL da Alura ou outra),
// e se a imagem falhar (404, sem rede, URL bloqueada) cai pro fallback
// LOCAL — círculo colorido com a inicial do nome. Sem texto "Avatar"
// vazando porque a imagem quebrou.
//
// Uso:
//   <UserAvatar src={url} name="Victor" size={36} className="..." />
//
// Se `src` é vazio/null, vai direto pro fallback (sem fazer request).
// Se a imagem que carregou der erro depois (`onError`), também cai.
//
// Cor do círculo é estável por nome (mesmo nome = mesma cor sempre),
// gerada via hash → HSL pra ter boa distribuição e contraste com texto branco.

function hashStringToHue(str) {
  if (!str) return 200;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0;
  }
  return Math.abs(hash) % 360;
}

// URLs/padrões de avatares "placeholder" conhecidos — geralmente são
// imagens default da Alura ou de serviços tipo Gravatar quando o user
// não tem foto. A gente prefere o fallback colorido com inicial em vez
// dessas imagens genéricas (estátuas, silhuetas, etc.).
//
// Adicione aqui qualquer URL nova que aparecer — basta um pedaço único
// que apareça no path.
// Lista enxuta de URLs sabidamente quebradas/feias. Mantenha curta:
// patterns largos demais já causaram regressão (esconderam imagens reais
// servidas pelo gravatar/Alura que mostram bolinhas com letra como avatar
// "padrão" da plataforma — essas devem aparecer normais).
const PLACEHOLDER_PATTERNS = [
  // Portrait Placeholder da Wikipedia — busto romano que vinha como default
  // do `claimedBy` em alguns claims antigos.
  'portrait_placeholder',
  // via.placeholder.com — serviço externo que estava caindo (ERR_CONNECTION_CLOSED).
  'via.placeholder.com',
];

function isPlaceholderUrl(url) {
  if (!url) return false;
  const lower = url.toLowerCase();
  return PLACEHOLDER_PATTERNS.some((pattern) => {
    if (pattern.includes('.*')) {
      return new RegExp(pattern).test(lower);
    }
    return lower.includes(pattern);
  });
}

function initialOf(name) {
  const trimmed = (name || '').trim();
  if (!trimmed) return '?';
  // Pega primeiro caractere alfanumérico (ignora "@", ".", "-", etc.)
  const match = trimmed.match(/[\p{L}\p{N}]/u);
  return (match ? match[0] : trimmed[0]).toUpperCase();
}

function UserAvatar({
  src,
  name,
  size = 32,
  className = '',
  title,
  // Chave estável e única por pessoa pra usar o sticky cache. Sem isso, NÃO
  // cacheia — evita confusão entre avatares de autor (sem identidade clara)
  // e avatares de quem assumiu (identidade clara). Use apenas onde você tem
  // CERTEZA que `cacheKey` identifica unicamente o usuário (ex: username).
  cacheKey = null,
}) {
  const [errored, setErrored] = useState(false);

  // Reseta erro quando a src muda (nova URL → tenta carregar de novo).
  useEffect(() => {
    setErrored(false);
  }, [src]);

  // Resolve a URL "efetiva". Sticky cache só atua quando `cacheKey` é passado.
  const effectiveSrc = useMemo(() => {
    if (!cacheKey) {
      return src || '';
    }
    const stickyUrl = readStickyAvatar(cacheKey);
    if (!src) return stickyUrl || '';
    if (isPlaceholderUrl(src)) return stickyUrl || src;
    // src é uma URL "real" — grava no cache pra usos futuros.
    writeStickyAvatar(cacheKey, src);
    return src;
  }, [src, cacheKey]);

  const initial = useMemo(() => initialOf(name), [name]);
  const hue = useMemo(() => hashStringToHue(name || ''), [name]);

  const fallbackStyle = {
    width: size,
    height: size,
    fontSize: Math.max(10, Math.round(size * 0.42)),
    background: `hsl(${hue}, 55%, 48%)`,
  };

  const showFallback = !effectiveSrc || errored || isPlaceholderUrl(effectiveSrc);

  if (showFallback) {
    return (
      <span
        className={`user-avatar user-avatar--fallback ${className}`}
        style={fallbackStyle}
        title={title || name || ''}
        aria-label={name || 'Usuário'}
        role="img"
      >
        {initial}
      </span>
    );
  }

  return (
    <img
      src={effectiveSrc}
      alt={name || ''}
      width={size}
      height={size}
      loading="lazy"
      className={`user-avatar ${className}`}
      title={title || name || ''}
      onError={() => setErrored(true)}
    />
  );
}

export default UserAvatar;
