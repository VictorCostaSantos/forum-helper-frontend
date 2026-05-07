import { useEffect, useRef, useState } from 'react';

// Hook pra puxar progresso de cursos do Caelum BI via backend proxy.
// Endpoint: GET /api/bi-progress?colaborador=X
// Estados: { data, loading, error, refetch, lastFetchedAt, fromCache }.

const ENDPOINT = '/api/bi-progress';

export function useAluraProgress(colaborador) {
  const [state, setState] = useState({
    data: null,
    loading: true,
    error: null,
    fromCache: false,
    lastFetchedAt: null,
  });
  const abortRef = useRef(null);

  const load = async () => {
    if (!colaborador) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState((s) => ({ ...s, loading: true, error: null }));

    try {
      const url = `${ENDPOINT}?colaborador=${encodeURIComponent(colaborador)}`;
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        // 502 do backend = upstream falhou. 400 = colaborador inválido (whitelist).
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const json = await res.json();
      setState({
        data: json,
        loading: false,
        error: null,
        fromCache: !!json.from_cache,
        lastFetchedAt: json.fetched_at || new Date().toISOString(),
      });
    } catch (err) {
      if (err.name === 'AbortError') return;
      setState({
        data: null,
        loading: false,
        error: err.message || 'Falha desconhecida',
        fromCache: false,
        lastFetchedAt: null,
      });
    }
  };

  useEffect(() => {
    load();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colaborador]);

  return { ...state, refetch: load };
}
