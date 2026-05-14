import { useEffect, useRef, useState } from 'react';

// Hook pra puxar progresso de cursos do Caelum BI via backend proxy.
// Endpoint: GET /api/bi-progress?colaborador=X
// Estados: { data, loading, error, refetch, lastFetchedAt, fromCache, unavailable }.
//
// `unavailable: true` é setado quando a primeira request falha com sintomas
// de "backend não existe nesse ambiente" (502 Bad Gateway, ou erro de rede /
// 404). Nessa hora a seção pode se auto-esconder em vez de mostrar banner
// vermelho. Em dev local com o backend rodando, fica normal.

const ENDPOINT = '/api/bi-progress';

// Códigos que indicam "backend não está aí" (em prod, sem o proxy).
// 502 é o que aparece na Vercel quando a rota /api/* não existe.
const BACKEND_ABSENT_STATUSES = new Set([404, 502, 503, 504]);

export function useAluraProgress(colaborador) {
  const [state, setState] = useState({
    data: null,
    loading: true,
    error: null,
    fromCache: false,
    lastFetchedAt: null,
    unavailable: false,
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
        // 502/404 etc. → backend não está disponível nesse ambiente.
        if (BACKEND_ABSENT_STATUSES.has(res.status)) {
          setState({
            data: null, loading: false, error: null,
            fromCache: false, lastFetchedAt: null,
            unavailable: true,
          });
          return;
        }
        // 400 = colaborador inválido (whitelist) ou outro erro genuíno.
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
        unavailable: false,
      });
    } catch (err) {
      if (err.name === 'AbortError') return;
      // Erro de rede (Failed to fetch) também conta como "backend ausente".
      const isNetworkError = err.message?.toLowerCase().includes('failed to fetch')
        || err.message?.toLowerCase().includes('networkerror');
      setState({
        data: null,
        loading: false,
        error: isNetworkError ? null : (err.message || 'Falha desconhecida'),
        fromCache: false,
        lastFetchedAt: null,
        unavailable: isNetworkError,
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
