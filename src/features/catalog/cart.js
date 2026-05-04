// Persistência da seleção do usuário em localStorage.
const STORAGE_KEY = 'alura_support_cart_v1';

export function loadCart() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const entries = JSON.parse(raw);
    return entries.map(([, value]) => value);
  } catch {
    return [];
  }
}

export function saveCart(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.map((i) => [i.link, i])));
}
