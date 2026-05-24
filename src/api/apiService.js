import axios from 'axios';

// Base do backend. Em dev, crie `.env.local` na raiz do frontend com:
//   VITE_API_BASE_URL=http://localhost:8080/api
// Sem essa env var, cai no backend de produção (DigitalOcean) — o que faz
// o build da Vercel funcionar de fora da caixa.
export const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || 'https://forum-helper-zmqxu.ondigitalocean.app/api';

export const LATAM_USER_MAPPING = {
    'victos-costa': 'victor-costa',
    'nathqueiroz': 'nathalia-queiroz',
    'monalisa-silva1': 'monalisa-silva',
    'rafaela-petelin-silverio': 'rafaela-petelin',
};

export function getLatamUsername(brUsername) {
    if (!brUsername) return null;
    const normalizedUsername = brUsername.trim().toLowerCase();
    return LATAM_USER_MAPPING[normalizedUsername] || normalizedUsername;
}

export async function fetchTopics(region = 'BR') {
    try {
        const endpoint = region === 'LATAM' ? '/topics/latam' : '/topics';

        const response = await axios.get(`${API_BASE_URL}${endpoint}`);
        return response.data;
    } catch (error) {
        console.error('Erro no fetchTopics:', error);
        throw error;
    }
}

export async function fetchLatamStats(username) {
    try {
        const latamUsername = getLatamUsername(username);
        if (!latamUsername) {
            return { postsToday: 0, postsMonth: 0, platform: 'LATAM' };
        }
        console.log(`[API] Traduzido: ${username} -> LATAM: ${latamUsername}`);
        const response = await axios.get(`${API_BASE_URL}/latam-user-stats?username=${latamUsername}`);
        return response.data;
    } catch (error) {
        console.error('Erro no fetchLatamStats:', error);
        return { postsToday: 0, postsMonth: 0, platform: 'LATAM' };
    }
}

export async function claimTopic(topicLink, username, avatarUrl = null) {
    try {
        // Mesmo padrão do /rescue-claim: front manda o avatar pronto (que ele
        // já tem cacheado no localStorage). Backend valida e usa, evitando
        // scrappear na hora — claim fica instantâneo.
        const response = await axios.post(`${API_BASE_URL}/claim`, {
            topicLink,
            username,
            avatar: avatarUrl,
        });
        return response.data;
    } catch (error) {
        console.error('Erro no claimTopic:', error);
        throw error;
    }
}

export async function unclaimTopic(topicLink, username) {
    try {
        const response = await axios.post(`${API_BASE_URL}/unclaim`, {
            topicLink,
            username
        });
        return response.data;
    } catch (error) {
        console.error('Erro no unclaimTopic:', error);
        throw error;
    }
}

export async function fetchUserStats(username) {
    try {
        const response = await axios.get(`${API_BASE_URL}/user-stats?username=${username}`);
        return response.data;
    } catch (error) {
        console.error('Erro no fetchUserStats:', error);
        return { postsToday: 0, postsMonth: 0 };
    }
}

export async function fetchTeamStats(usersArray) {
    try {
        const usersParam = usersArray.join(',');
        const response = await axios.get(`${API_BASE_URL}/team-stats?users=${usersParam}`);
        return response.data;
    } catch (error) {
        console.error('Erro no fetchTeamStats:', error);
        return [];
    }
}

export async function fetchDashboardStats(startDate, endDate, users) {
    try {
        const usersParam = users || '';
        const encodedUsers = encodeURIComponent(usersParam);
        const encodedStart = encodeURIComponent(startDate);
        const encodedEnd = encodeURIComponent(endDate);
        const response = await axios.get(
            `${API_BASE_URL}/dashboard-stats?users=${encodedUsers}&startDate=${encodedStart}&endDate=${encodedEnd}`
        );
        return response.data;
    } catch (error) {
        console.error('Erro no fetchDashboardStats:', error);
        return { summary: {}, users: [] };
    }
}

export async function fetchAvatarFromBackend(username) {
    if (!username) return { success: false, url: null };

    const normalizedUsername = username.trim().toLowerCase();
    const cacheKey = `alura_avatar_v1_${normalizedUsername}`;
    const CACHE_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000;
    // "Negative cache": quando o backend FALHA explicitamente (success: false
    // ou erro de rede), evita request repetido por 5 min. Tempo curto porque
    // o backend tem cache próprio que se popula aos poucos — é normal a 1ª
    // chamada falhar e a 2ª (segundos depois) já dar certo.
    //
    // ATENÇÃO: success:true + avatarUrl:null NÃO conta como falha — o backend
    // simplesmente ainda não tem essa URL no cache dele. Próxima request pode
    // já ter (após scraping). Tratamos como "ausência neutra".
    const NEGATIVE_CACHE_MS = 5 * 60 * 1000;

    const cachedData = localStorage.getItem(cacheKey);
    if (cachedData) {
        try {
            const parsedCache = JSON.parse(cachedData);
            const now = Date.now();
            // Cache positivo válido — devolve.
            if (parsedCache.url && now - parsedCache.timestamp < CACHE_EXPIRATION_MS) {
                return { success: true, url: parsedCache.url, cached: true };
            }
            // Cache negativo válido — devolve fail sem fazer request.
            if (parsedCache.negative && now - parsedCache.timestamp < NEGATIVE_CACHE_MS) {
                return { success: false, url: null, cached: true };
            }
        } catch (e) {
            console.warn("Cache do avatar corrompido. Buscando novo...");
        }
    }

    try {
        const response = await axios.get(`${API_BASE_URL}/user-avatar?username=${normalizedUsername}`);
        const data = response.data;

        // FALHA explícita do backend (success: false) → negative cache.
        if (data.success === false) {
            localStorage.setItem(cacheKey, JSON.stringify({
                negative: true,
                timestamp: Date.now(),
            }));
            return { success: false, url: null };
        }

        // success: true mas avatarUrl null/vazio → ausência neutra. Não cacheia
        // negative pra próxima request poder pegar quando o backend popular.
        if (!data.avatarUrl) {
            return { success: false, url: null };
        }

        localStorage.setItem(cacheKey, JSON.stringify({
            url: data.avatarUrl,
            timestamp: Date.now(),
        }));

        return { success: true, url: data.avatarUrl, cached: false };
    } catch (error) {
        console.error(`Erro de rede ao buscar avatar para ${normalizedUsername}:`, error);

        // Reuso de cache positivo expirado — melhor que nada se o backend caiu.
        if (cachedData) {
            try {
                const parsedCache = JSON.parse(cachedData);
                if (parsedCache.url) {
                    return { success: true, url: parsedCache.url, cached: true };
                }
            } catch (e) {}
        }

        // Negative cache pra próximas tentativas falharem rápido.
        try {
            localStorage.setItem(cacheKey, JSON.stringify({
                negative: true,
                timestamp: Date.now(),
            }));
        } catch (e) { /* localStorage cheio, ok */ }

        return { success: false, url: null };
    }
}

const BI_ANNUAL_URL = "https://bi.caelumalura.com.br/public/result?id=SEU_ID_DA_QUERY_ANUAL_AQUI&format=json";
const userAnnualCache = {};

export async function fetchUserAnnualData(username) {
    if (userAnnualCache[username]) return userAnnualCache[username];
    try {
        if (BI_ANNUAL_URL.includes("SEU_ID")) return [];
        const response = await axios.get(BI_ANNUAL_URL);
        const data = response.data;
        if (data.result) {
            data.result.forEach(row => {
                const u = row[0]; const d = row[1]; const c = row[2];
                if (!userAnnualCache[u]) userAnnualCache[u] = [];
                userAnnualCache[u].push({ date: d, count: c });
            });
        }
        return userAnnualCache[username] || [];
    } catch (error) {
        console.error("Erro histórico anual:", error);
        return [];
    }
}

export async function fetchRescueQueue() {
    try {
        const response = await axios.get(`${API_BASE_URL}/rescue-queue`);
        return response.data;
    } catch (error) {
        console.error('Erro no fetchRescueQueue:', error);
        return { topics: [], waiting_queue: [] };
    }
}

export async function claimRescueTopic(topicId, username, avatarUrl) {
    const response = await axios.post(`${API_BASE_URL}/rescue-claim`, {
        topic_id: topicId,
        username: username,
        avatar: avatarUrl
    });
    return response.data;
}

export async function unclaimRescueTopic(topicId) {
    const response = await axios.post(`${API_BASE_URL}/rescue-unclaim`, {
        topic_id: topicId
    });
    return response.data;
}

/*
  Marca um tópico do Fora do Radar como resolvido. Backend faz soft-delete
  (status=RESOLVED, deixa de aparecer em /api/rescue-queue). Quem chama é
  responsável por sumir o card otimisticamente — próximo poll já não
  retorna ele.
*/
export async function resolveRescueTopic(topicId, username) {
    const response = await axios.post(`${API_BASE_URL}/rescue-resolve`, {
        topic_id: topicId,
        username,
    });
    return response.data;
}

export async function fetchFocusData() {
    const SHEET_ID = '1746BtlDdh97YV0CV0s941WezEgkhEJx8geFNPYf2ulk';
    const GID = '1835095510';
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&gid=${GID}&_=${new Date().getTime()}`;
    try {
        const response = await axios.get(url);
        const textData = response.data;
        const jsonData = JSON.parse(textData.substring(47).slice(0, -2));
        return jsonData.table.rows.map(row => ({
            nome: row.c[0]?.v || '',
            foco1: row.c[2]?.v || '',
            foco2: row.c[3]?.v || ''
        }));
    } catch (error) {
        console.error("Erro ao buscar dados de foco:", error);
        return [];
    }
}

/* ============================================
   ALOCAÇÃO — CRUD de atividades do time

   Backend usa Sequelize com armazenamento persistente. `data` é DATEONLY
   (YYYY-MM-DD), `peso` é 1..3, `responsaveis` é array de strings.
   Front sempre filtra por range de datas pra economizar payload — o
   quadro mostra uma semana por vez.
   ============================================ */

export async function fetchAtividades({ dataInicio, dataFim, peso } = {}) {
    try {
        const params = new URLSearchParams();
        if (dataInicio) params.set('dataInicio', dataInicio);
        if (dataFim)    params.set('dataFim', dataFim);
        if (peso)       params.set('peso', String(peso));
        const qs = params.toString();
        const url = `${API_BASE_URL}/atividades${qs ? `?${qs}` : ''}`;
        const response = await axios.get(url);
        return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
        console.error('Erro no fetchAtividades:', error);
        throw error;
    }
}

export async function createAtividade(payload) {
    const response = await axios.post(`${API_BASE_URL}/atividades`, payload);
    return response.data;
}

export async function updateAtividade(id, payload) {
    const response = await axios.put(`${API_BASE_URL}/atividades/${id}`, payload);
    return response.data;
}

export async function deleteAtividade(id) {
    const response = await axios.delete(`${API_BASE_URL}/atividades/${id}`);
    return response.data;
}

/* ============================================
   CLICKUP — Personal API Token (header `Authorization: pk_...`)
   ClickUp permite CORS pra origins web com personal tokens.
   ============================================ */

const CLICKUP_API = 'https://api.clickup.com/api/v2';

function clickupHeaders(token) {
    return {
        'Authorization': token,
        'Accept': 'application/json',
    };
}

async function clickupFetch(path, token) {
    const response = await fetch(`${CLICKUP_API}${path}`, { headers: clickupHeaders(token) });
    if (!response.ok) {
        let detail = '';
        try {
            const body = await response.json();
            detail = body?.err || body?.ECODE || '';
        } catch {
            // ignore
        }
        const err = new Error(`ClickUp HTTP ${response.status}${detail ? ` · ${detail}` : ''}`);
        err.status = response.status;
        throw err;
    }
    return response.json();
}

export async function fetchClickUpUser(token) {
    const data = await clickupFetch('/user', token);
    return data.user;
}

export async function fetchClickUpTeams(token) {
    const data = await clickupFetch('/team', token);
    return data.teams || [];
}

/*
  Tasks de uma lista específica (independente de assignee).
  Usado pelo Radar de Eventos — todo mundo do time vê as mesmas tarefas
  da lista, não só as suas. Paginação simples (page=0) cobre listas com
  até ~100 itens; eventos são poucos por natureza.
*/
export async function fetchClickUpListTasks(token, listId) {
  const params = new URLSearchParams();
  params.set('include_closed', 'false');
  params.set('subtasks', 'false');
  params.set('page', '0');
  const data = await clickupFetch(`/list/${listId}/task?${params.toString()}`, token);
  return data.tasks || [];
}

/*
  Tasks atribuídas ao usuário em uma equipe (workspace).
  include_closed=false ignora tarefas concluídas.
  subtasks=true inclui subtarefas — útil pra deadline tracking.
*/
export async function fetchClickUpTasksForTeam(token, teamId, userId) {
    const params = new URLSearchParams();
    params.set('assignees[]', String(userId));
    params.set('include_closed', 'false');
    params.set('subtasks', 'true');
    params.set('page', '0');
    const data = await clickupFetch(`/team/${teamId}/task?${params.toString()}`, token);
    return data.tasks || [];
}

/*
  Conveniência: pega user + teams + todas as tarefas de todos os workspaces.
  Usado tanto pelo botão "Testar conexão" quanto pelo watcher de notificações.
*/
export async function fetchAllClickUpData(token) {
    const [user, teams] = await Promise.all([
        fetchClickUpUser(token),
        fetchClickUpTeams(token),
    ]);
    const tasksByTeam = await Promise.all(
        teams.map(async (team) => {
            try {
                const tasks = await fetchClickUpTasksForTeam(token, team.id, user.id);
                return tasks.map((t) => ({ ...t, _teamName: team.name }));
            } catch {
                return [];
            }
        }),
    );
    return { user, teams, tasks: tasksByTeam.flat() };
}