/*
  Scroll suave até o card do tópico no Forum Helper, com flash de destaque.
  Procura pelo `data-topic-link` adicionado em TopicsView.

  Retorna true se achou e fez scroll, false caso contrário.
*/
export function scrollToTopicCard(topicLink) {
  if (!topicLink) return false;
  const safe = String(topicLink).replace(/"/g, '\\"');
  const el = document.querySelector(`[data-topic-link="${safe}"]`);
  if (!el) return false;

  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.remove('topic-card--flash'); // reset se já tava rodando
  // Força reflow pra reanimar
  void el.offsetWidth;
  el.classList.add('topic-card--flash');
  setTimeout(() => el.classList.remove('topic-card--flash'), 2400);

  return true;
}

/*
  Espera o elemento aparecer no DOM (até `timeout` ms) e então faz scroll.
  Necessário quando navegamos de outra rota — a TopicsView precisa
  montar antes de conseguirmos achar o card.
*/
export function scrollToTopicCardEventually(topicLink, timeout = 3000) {
  if (!topicLink) return;
  const start = Date.now();
  const tryScroll = () => {
    if (scrollToTopicCard(topicLink)) return;
    if (Date.now() - start >= timeout) return;
    setTimeout(tryScroll, 150);
  };
  // Pequeno delay inicial pra deixar a rota trocar de fato.
  setTimeout(tryScroll, 80);
}
