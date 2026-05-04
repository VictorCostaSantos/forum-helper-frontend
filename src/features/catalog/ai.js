// Integração com Gemini para busca contextual.

export async function searchWithAI(query, allItems) {
  const API_KEY = localStorage.getItem('googleApiKey');
  if (!API_KEY) throw new Error('Chave de API não configurada nas Configurações.');
  if (!query || query.length < 5) return { links: [], tags: [], summary: '' };

  const MODEL = 'gemini-2.5-flash-lite';
  const URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

  const prompt = `Atue como um Mentor Sênior da Alura analisando a dúvida de um aluno. ENTRADA: """${query}""" TAREFA: Retorne um OBJETO JSON com duas chaves: "tags": array de até 6 palavras-chave para buscar conteúdos relevantes; "summary": frase curta (máx 12 palavras) explicando o tema central. REGRAS PARA TAGS: 1. Se o tema for "Acessibilidade", inclua "UX Design". 2. Se pedir carreira, inclua "Podcast", "Hipsters", "Carreira". 3. IGNORE datas, nomes e lixo de interface. 4. Priorize termos técnicos encontrados em títulos de cursos Alura. Exemplo: {"tags": ["CSS", "Flexbox"], "summary": "..."}`;

  const response = await fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { response_mime_type: 'application/json', temperature: 0.4 },
    }),
  });

  if (!response.ok) {
    if (response.status === 400 || response.status === 403) {
      throw new Error('Chave de API inválida ou expirada.');
    }
    throw new Error(response.statusText);
  }

  const data = await response.json();
  const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '{"tags":[],"summary":""}';

  let parsed;
  try { parsed = JSON.parse(textResponse); }
  catch { parsed = { tags: [], summary: '' }; }

  const keywords = Array.isArray(parsed) ? parsed : (parsed.tags || []);
  const summary = parsed.summary || '';
  const searchTerms = keywords.map((k) => k.toLowerCase().trim()).filter((k) => k.length > 1);

  const scored = allItems.map((item) => {
    let score = 0;
    const title = (item.title || '').toLowerCase();
    const kind = (item.kind || '').toLowerCase();
    searchTerms.forEach((term, idx) => {
      const w = 15 - idx;
      if (title.includes(term)) score += 30 + w;
      if (kind.includes(term)) score += 25;
      if (title === term) score += 50;
    });
    return { item, score };
  });

  const links = scored
    .filter((s) => s.score > 10)
    .sort((a, b) => b.score - a.score)
    .slice(0, 30)
    .map((r) => r.item.link);

  return { links, tags: keywords, summary };
}
