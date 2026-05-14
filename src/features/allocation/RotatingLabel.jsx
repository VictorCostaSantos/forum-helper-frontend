import React, { useEffect, useState } from 'react';

/*
  Mostra uma lista de rótulos alternando entre eles a cada N ms, com
  animação fade-up no momento da troca.

  Pra não causar layout shift quando os textos têm largura diferente
  ("Esta semana" vs "11/05 – 15/05"), renderizamos o MAIOR label como
  shadow invisível pra "reservar" largura, e o atual por cima absoluto.
*/
function RotatingLabel({ labels = [], intervalMs = 8000, className = '' }) {
  // Dedup: se as variações são iguais ("Fixo" / "Fixo"), não tem o que
  // alternar. Visualmente isso evita o "trêmulo" da animação trocando o
  // mesmo texto consigo mesmo.
  const clean = Array.from(new Set(labels.filter(Boolean)));
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (clean.length < 2) return undefined;
    const id = setInterval(() => {
      setIdx((i) => (i + 1) % clean.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [clean.length, intervalMs]);

  if (clean.length === 0) return null;

  // Label mais comprido reserva largura.
  const longest = clean.reduce((a, b) => (b.length > a.length ? b : a), '');
  const current = clean[idx % clean.length];

  return (
    <span className={`alloc-rotating ${className}`}>
      <span className="alloc-rotating__shadow" aria-hidden="true">{longest}</span>
      <span key={`${idx}-${current}`} className="alloc-rotating__slot">
        {current}
      </span>
    </span>
  );
}

export default RotatingLabel;
