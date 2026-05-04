import React, { useCallback, useEffect, useState } from 'react';
import { collection, getDocs, limit, query } from 'firebase/firestore';
import {
  fetchTopics,
  fetchUserStats,
  fetchLatamStats,
  fetchFocusData,
  fetchRescueQueue,
  fetchClickUpUser,
} from '../../api/apiService';
import { db } from '../../features/mural/firebase';

const SHEET_ID = '1746BtlDdh97YV0CV0s941WezEgkhEJx8geFNPYf2ulk';

const SHEET_GIDS = [
  { gid: '1812290880', label: 'Alocação · Sugestões' },
  { gid: '1034627386', label: 'Alocação · Discord' },
  { gid: '1145495672', label: 'Alocação · LATAM' },
  { gid: '1966976426', label: 'Alocação · Imersão' },
  { gid: '1902907481', label: 'Alocação · Artigos' },
  { gid: '1463294778', label: 'Avisos' },
];

async function fetchSheetRows(gid) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&gid=${gid}&_=${Date.now()}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const text = await r.text();
  return JSON.parse(text.substring(47).slice(0, -2));
}

// Testa se o Firestore do Mural está acessível (lê 1 doc da coleção mural_cards).
async function checkMuralFirebase() {
  const q = query(collection(db, 'mural_cards'), limit(1));
  await getDocs(q);
}

// Testa se o token ClickUp tá válido. Vermelho se não configurado ou se a API rejeitar.
async function checkClickUp() {
  const token = localStorage.getItem('clickupToken');
  if (!token) throw new Error('Token não configurado em Configurações > Integrações.');
  await fetchClickUpUser(token);
}

// Mensagem de erro humanizada — extrai o que importa (axios, fetch, firebase).
function describeError(err) {
  if (!err) return 'Erro desconhecido';
  // Axios
  if (err.response) {
    const status = err.response.status;
    const detail = err.response.data?.message || err.response.data?.error || err.response.statusText;
    return `HTTP ${status}${detail ? ` · ${detail}` : ''}`;
  }
  if (err.request) return 'Sem resposta do servidor (timeout/rede)';
  // Firebase / fetch / generic
  if (err.code) return `${err.code}${err.message ? ` · ${err.message}` : ''}`;
  return err.message || String(err);
}

function StatusPanel({ username }) {
  const [checks, setChecks] = useState([]);
  const [running, setRunning] = useState(false);

  const runChecks = useCallback(async () => {
    setRunning(true);

    const tasks = [
      { id: 'topics-br', label: 'Tópicos · BR', fn: () => fetchTopics('BR') },
      { id: 'topics-latam', label: 'Tópicos · LATAM', fn: () => fetchTopics('LATAM') },
    ];

    if (username) {
      tasks.push(
        { id: 'stats-br', label: 'Stats do usuário · BR', fn: () => fetchUserStats(username) },
        { id: 'stats-latam', label: 'Stats do usuário · LATAM', fn: () => fetchLatamStats(username) },
      );
    }

    tasks.push({ id: 'focus', label: 'Foco diário', fn: () => fetchFocusData() });
    tasks.push({ id: 'mural', label: 'Mural · Firebase', fn: checkMuralFirebase });
    tasks.push({ id: 'rescue', label: 'Fora do Radar · API', fn: () => fetchRescueQueue() });

    // Só roda o check do ClickUp se o token tá configurado, pra não mostrar
    // vermelho permanente pra quem não usa a integração.
    if (localStorage.getItem('clickupToken')) {
      tasks.push({ id: 'clickup', label: 'ClickUp · API', fn: checkClickUp });
    }

    SHEET_GIDS.forEach((s) => {
      tasks.push({ id: `sheet-${s.gid}`, label: s.label, fn: () => fetchSheetRows(s.gid) });
    });

    setChecks(tasks.map((t) => ({ id: t.id, label: t.label, state: 'loading' })));

    await Promise.all(
      tasks.map(async (task) => {
        try {
          await task.fn();
          setChecks((prev) =>
            prev.map((c) => (c.id === task.id ? { ...c, state: 'ok', error: null } : c)),
          );
        } catch (err) {
          const message = describeError(err);
          console.warn(`[Status] ${task.label} falhou:`, err);
          setChecks((prev) =>
            prev.map((c) => (c.id === task.id ? { ...c, state: 'fail', error: message } : c)),
          );
        }
      }),
    );

    setRunning(false);
  }, [username]);

  // Auto-roda assim que monta (quando o usuário abre a seção colapsável)
  useEffect(() => {
    runChecks();
  }, [runChecks]);

  return (
    <div className="status-panel">
      <ul className="status-bullets">
        {checks.map((c) => (
          <li key={c.id} className={`status-bullet status-bullet--${c.state}`}>
            <span className="status-bullet__dot" aria-hidden="true"></span>
            <div className="status-bullet__main">
              <span className="status-bullet__label">{c.label}</span>
              {c.state === 'fail' && c.error ? (
                <span className="status-bullet__error" title={c.error}>{c.error}</span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className="status-refresh"
        onClick={runChecks}
        disabled={running}
      >
        <i className={`fa-solid fa-rotate-right ${running ? 'fa-spin' : ''}`}></i>
        {running ? 'Verificando…' : 'Atualizar'}
      </button>
    </div>
  );
}

export default StatusPanel;
