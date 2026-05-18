import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchAtividades,
  createAtividade,
  updateAtividade,
  deleteAtividade,
} from '../../api/apiService';
import {
  PLACEHOLDER_USER,
  TEAM,
  getMaxLoad,
  isPlaceholder,
} from './team';
import { refreshAllocationSummary } from './useAllocationSummary';
import { addDays, detectCycle, fromISODate, isPerennial, mondayOf, toISODate, workWeekDays } from './dateHelpers';

/*
  Hook do painel de Alocação — modelo "flight board" (estações).

  Cada NOME de atividade vira uma "estação" no painel. Linhas distintas no
  banco com o mesmo `nome` representam diferentes plantões dessa estação
  (Discord 04/05–15/05, Discord 18/05–29/05, etc).

  Pra cada estação, identificamos:
    - currentShift: a instância cujo range [data_inicio, data_fim] contém HOJE
                    (ou, se nenhuma contém, a próxima ainda no futuro — assim
                    o card sempre tem "alguém pra mostrar" quando faz sentido)
    - nextShift:    a próxima instância depois de currentShift, ordenada por
                    data_inicio. Pode ser null.

  Carga por pessoa = soma de pesos de TODAS as estações em que ela está no
  currentShift, dividida por maxLoad. Sinal de saturação.
*/
export function useAllocation(anchorDate) {
  const [items, setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);
  const reqId = useRef(0);

  const weekDays = useMemo(() => workWeekDays(anchorDate), [anchorDate]);
  const monday   = useMemo(() => mondayOf(anchorDate), [anchorDate]);

  // ISO da segunda + sexta da semana ancorada. currentShift = qualquer
  // instância cujo range CRUZA esse intervalo (overlap, não só "contém HOJE").
  // Isso faz as setas ◀▶ realmente mudarem o que aparece no painel.
  const weekStartIso = useMemo(() => toISODate(monday), [monday]);
  const weekEndIso   = useMemo(() => toISODate(addDays(monday, 4)), [monday]);

  // Range largo pra capturar perenes e prox. plantões. Backend filtra por
  // overlap; o nosso agrupamento por nome cuida do resto.
  const range = useMemo(() => ({
    dataInicio: toISODate(addDays(monday, -365 * 2)),
    dataFim:    toISODate(addDays(monday, 365 * 2)),
  }), [monday]);

  const load = useCallback(async () => {
    const myReq = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAtividades(range);
      if (myReq !== reqId.current) return;
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      if (myReq !== reqId.current) return;
      setError(e?.message || 'Erro ao carregar atividades');
      setItems([]);
    } finally {
      if (myReq === reqId.current) setLoading(false);
    }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  /*
    Agrupa instâncias por `nome` (case-insensitive, trim) → array de "stations":
      { id, name, displayName, instances[], currentShift, nextShift }
    A station "principal" usa o nome mais limpo (primeira ocorrência preservada).
  */
  const stations = useMemo(() => {
    const byKey = new Map();

    for (const a of items) {
      if (!a?.nome) continue;
      const key = String(a.nome).trim().toLowerCase();
      if (!byKey.has(key)) {
        byKey.set(key, { id: key, name: a.nome, instances: [] });
      }
      byKey.get(key).instances.push(a);
    }

    const stationList = [];
    for (const st of byKey.values()) {
      // Ordena instâncias por data_inicio asc.
      st.instances.sort((x, y) => {
        const dx = String(x.data_inicio || '').slice(0, 10);
        const dy = String(y.data_inicio || '').slice(0, 10);
        return dx < dy ? -1 : dx > dy ? 1 : 0;
      });

      // currentShift = primeira instância cujo range CRUZA a semana
      // selecionada [weekStartIso, weekEndIso]. Isso faz as setas ◀▶ do
      // header realmente alterarem o conteúdo do painel.
      let currentShift = null;
      let nextShift    = null;
      for (const inst of st.instances) {
        const di = String(inst.data_inicio || '').slice(0, 10);
        const df = String(inst.data_fim    || '').slice(0, 10);
        if (di && df && !(df < weekStartIso || di > weekEndIso)) {
          currentShift = inst;
          break;
        }
      }
      if (currentShift) {
        // próxima = instância cujo data_inicio começa DEPOIS do fim da current
        const currentEnd = String(currentShift.data_fim || '').slice(0, 10);
        nextShift = st.instances.find((x) => {
          const xs = String(x.data_inicio || '').slice(0, 10);
          return xs > currentEnd;
        }) || null;
      } else {
        // Sem current na semana visível: próxima = primeira que começa
        // depois do fim da semana.
        nextShift = st.instances.find((x) => {
          const xs = String(x.data_inicio || '').slice(0, 10);
          return xs > weekEndIso;
        }) || null;
      }

      // Estação sem nenhuma instância passada/futura não aparece (raríssimo).
      if (!currentShift && !nextShift && st.instances.length === 0) continue;

      // Use peso/peridicidade da currentShift se houver, senão da nextShift,
      // senão da última instância conhecida — pro card sempre saber a "cor".
      const reference = currentShift || nextShift || st.instances[st.instances.length - 1];

      stationList.push({
        id: st.id,
        name: st.name,
        reference,
        currentShift,
        nextShift,
        instances: st.instances,
      });
    }

    // Ordena: estações com currentShift primeiro, depois por nome.
    // Ordem de listagem:
    //   1. Fixas (perenes) primeiro — alfabético entre si, peso ignorado
    //   2. Não-fixas com currentShift, ordenadas por peso desc (3→1) + alfa
    //   3. Não-fixas sem currentShift (futuras/passadas), alfa
    stationList.sort((a, b) => {
      const aFixed = a.reference ? isPerennial(a.reference) ? 0 : 1 : 2;
      const bFixed = b.reference ? isPerennial(b.reference) ? 0 : 1 : 2;
      if (aFixed !== bFixed) return aFixed - bFixed;

      // Mesmo bucket — comparações finas.
      if (aFixed === 1) {
        // Não-fixas com currentShift: peso desc primeiro.
        const aHas = a.currentShift ? 0 : 1;
        const bHas = b.currentShift ? 0 : 1;
        if (aHas !== bHas) return aHas - bHas;
        const aPeso = Number(a.reference?.peso) || 0;
        const bPeso = Number(b.reference?.peso) || 0;
        if (aPeso !== bPeso) return bPeso - aPeso; // desc
      }
      return a.name.localeCompare(b.name);
    });

    return stationList;
  }, [items, weekStartIso, weekEndIso]);

  // Mapeia pessoa → estações em que ela está no currentShift. Pro tooltip
  // rico ("Victor: Discord (alta), Fórum (baixa)") e pra qualquer outra
  // view que queira detalhar o que a pessoa está fazendo hoje.
  const stationsByUser = useMemo(() => {
    const map = new Map();
    for (const m of TEAM) map.set(m.username, []);
    for (const st of stations) {
      if (!st.currentShift) continue;
      const list = Array.isArray(st.currentShift.responsaveis) ? st.currentShift.responsaveis : [];
      for (const u of list) {
        if (map.has(u)) map.get(u).push(st);
      }
    }
    return map;
  }, [stations]);

  // Carga por pessoa: soma de pesos das estações em que está NO currentShift.
  const loadByUser = useMemo(() => {
    const totals = new Map();
    for (const m of TEAM) totals.set(m.username, 0);

    for (const st of stations) {
      if (!st.currentShift) continue;
      const peso = Number(st.currentShift.peso) || 0;
      const list = Array.isArray(st.currentShift.responsaveis) ? st.currentShift.responsaveis : [];
      // Filtra placeholder __vago__ explicitamente — hoje totals.has() já
      // ignora porque ele não está em TEAM, mas dependência implícita é
      // frágil. Filtrar antes deixa a intenção clara.
      for (const u of list) {
        if (isPlaceholder(u)) continue;
        if (totals.has(u)) totals.set(u, totals.get(u) + peso);
      }
    }

    // Converte pra { points, pct, tone }
    const result = new Map();
    for (const [u, points] of totals) {
      const max = Math.max(1, getMaxLoad(u));
      const pct = Math.min(150, Math.round((points / max) * 100));
      let tone = 'ok';
      if (pct >= 90) tone = 'danger';
      else if (pct >= 60) tone = 'warn';
      result.set(u, { points, pct, tone });
    }
    return result;
  }, [stations]);

  // ----- mutations otimistas (inalteradas) -----

  const createActivity = useCallback(async (payload) => {
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const optimistic = { id: tempId, _optimistic: true, ...payload };
    setItems((curr) => [...curr, optimistic]);
    try {
      const created = await createAtividade(payload);
      setItems((curr) => curr.map((x) => (x.id === tempId ? created : x)));
      refreshAllocationSummary();
      return created;
    } catch (e) {
      setItems((curr) => curr.filter((x) => x.id !== tempId));
      throw e;
    }
  }, []);

  const editActivity = useCallback(async (id, payload) => {
    let prev = null;
    setItems((curr) => curr.map((x) => {
      if (x.id !== id) return x;
      prev = x;
      return { ...x, ...payload };
    }));
    try {
      const updated = await updateAtividade(id, payload);
      setItems((curr) => curr.map((x) => (x.id === id ? updated : x)));
      refreshAllocationSummary();
      return updated;
    } catch (e) {
      if (prev) setItems((curr) => curr.map((x) => (x.id === id ? prev : x)));
      throw e;
    }
  }, []);

  const removeActivity = useCallback(async (id) => {
    let snapshot = null;
    setItems((curr) => {
      snapshot = curr;
      return curr.filter((x) => x.id !== id);
    });
    try {
      await deleteAtividade(id);
      refreshAllocationSummary();
    } catch (e) {
      if (snapshot) setItems(snapshot);
      throw e;
    }
  }, []);

  /*
    Edita uma "estação" inteira: aplica nome/peso novos a TODAS as instâncias
    que casam com o `oldName` (case-insensitive, trim). Mantém datas e
    responsáveis de cada instância preservados.

    Útil pra "demanda do Fórum subiu, sobe peso de 1 → 3 em todas as ocorrências
    futuras" ou "renomei a estação".
  */
  const editStation = useCallback(async (oldName, { nome, peso }) => {
    const key = String(oldName || '').trim().toLowerCase();
    const targets = items.filter((x) => String(x.nome || '').trim().toLowerCase() === key);
    if (targets.length === 0) return [];

    // Otimismo em massa: atualiza local antes do round-trip.
    const ids = new Set(targets.map((t) => t.id));
    setItems((curr) => curr.map((x) => ids.has(x.id) ? { ...x, nome, peso: Number(peso) } : x));

    try {
      await Promise.all(
        targets.map((t) => updateAtividade(t.id, {
          nome,
          peso: Number(peso),
          data_inicio: String(t.data_inicio).slice(0, 10),
          data_fim:    String(t.data_fim).slice(0, 10),
          responsaveis: Array.isArray(t.responsaveis) ? t.responsaveis : [],
        })),
      );
      refreshAllocationSummary();
      return targets.map((t) => t.id);
    } catch (e) {
      // Rollback grosso: recarrega tudo.
      load();
      throw e;
    }
  }, [items, load]);

  /*
    Apaga TODAS as instâncias de uma estação — passado, presente e futuro.
    Diferente de deleteStationFuture, esse não preserva histórico. Use quando
    a atividade deixou de existir e ninguém mais quer vê-la (ex: estação
    duplicada por erro, ou ciclo encerrado sem precisar de registro).
  */
  const deleteStation = useCallback(async (stationName) => {
    const key = String(stationName || '').trim().toLowerCase();
    const targets = items.filter(
      (x) => String(x.nome || '').trim().toLowerCase() === key,
    );
    if (targets.length === 0) return 0;
    const ids = new Set(targets.map((t) => t.id));
    setItems((curr) => curr.filter((x) => !ids.has(x.id)));
    try {
      await Promise.all(targets.map((t) => deleteAtividade(t.id)));
      refreshAllocationSummary();
      return targets.length;
    } catch (e) {
      load(); // rollback grosso
      throw e;
    }
  }, [items, load]);

  /*
    Apaga TODAS as instâncias futuras de uma estação (data_inicio > hoje).
    Útil pra "essa atividade vai parar" mantendo histórico do que já passou.
  */
  const deleteStationFuture = useCallback(async (stationName) => {
    const today = toISODate(new Date());
    const key = String(stationName || '').trim().toLowerCase();
    const targets = items.filter((x) => {
      const di = String(x.data_inicio || '').slice(0, 10);
      return String(x.nome || '').trim().toLowerCase() === key && di > today;
    });
    if (targets.length === 0) return 0;
    const ids = new Set(targets.map((t) => t.id));
    setItems((curr) => curr.filter((x) => !ids.has(x.id)));
    try {
      await Promise.all(targets.map((t) => deleteAtividade(t.id)));
      refreshAllocationSummary();
      return targets.length;
    } catch (e) {
      load();
      throw e;
    }
  }, [items, load]);

  /*
    Estender estação cíclica: pega a última instância conhecida e cria uma
    nova ocorrência um ciclo à frente (semanal/quinzenal/mensal). Nasce com
    o admin como semente (mesma lógica das criações cíclicas iniciais).

    Útil quando o admin esqueceu de criar mais ocorrências e a fila tá
    chegando ao fim — "virar plantão" em 1 clique.
  */
  const extendStation = useCallback(async (stationName, seedUser) => {
    const key = String(stationName || '').trim().toLowerCase();
    const instances = items
      .filter((x) => String(x.nome || '').trim().toLowerCase() === key)
      .sort((a, b) => {
        const da = String(a.data_inicio || '').slice(0, 10);
        const db = String(b.data_inicio || '').slice(0, 10);
        return da < db ? -1 : da > db ? 1 : 0;
      });
    if (instances.length === 0) throw new Error('Estação sem instâncias.');

    const cycle = detectCycle(instances) || 'biweekly'; // fallback razoável
    const last  = instances[instances.length - 1];
    const lastDi = fromISODate(String(last.data_inicio).slice(0, 10));
    const lastDf = fromISODate(String(last.data_fim).slice(0, 10));
    if (!lastDi || !lastDf) throw new Error('Datas inválidas.');

    let newDi, newDf;
    if (cycle === 'weekly')   { newDi = addDays(lastDi, 7);  newDf = addDays(lastDf, 7);  }
    else if (cycle === 'biweekly') { newDi = addDays(lastDi, 14); newDf = addDays(lastDf, 14); }
    else if (cycle === 'monthly')  {
      newDi = new Date(lastDi); newDi.setMonth(newDi.getMonth() + 1);
      newDf = new Date(lastDf); newDf.setMonth(newDf.getMonth() + 1);
    } else {
      newDi = addDays(lastDi, 14); newDf = addDays(lastDf, 14);
    }

    // Próxima ocorrência nasce VAZIA (placeholder) — admin preenche depois.
    // Decisão: replicar responsáveis da última só faz sentido pra atividades
    // realmente fixas (Fórum Helper), o que se modela com `keepTeam` na
    // criação. Pra extensão em massa não há essa intenção declarada, então
    // o seguro é nascer vazio.
    return createActivity({
      nome: last.nome,
      data_inicio: toISODate(newDi),
      data_fim:    toISODate(newDf),
      peso: Number(last.peso),
      responsaveis: [PLACEHOLDER_USER],
    });
  }, [items, createActivity]);

  /*
    "Snooze" / férias: remove a pessoa de TODAS as instâncias com data_inicio
    no futuro (não mexe nos plantões correntes pra não criar buraco operacional).
    Útil pra "vou tirar férias 15 dias — me tira das próximas".

    Cuidado: backend exige min 1 responsável. Se uma instância tiver SÓ essa
    pessoa, a remoção é pulada (não dá pra deixar vazio). Retorna lista de
    instâncias que ficaram sem ela.
  */
  const snoozePerson = useCallback(async (username) => {
    const today = toISODate(new Date());
    const futureWithUser = items.filter((x) => {
      const di = String(x.data_inicio || '').slice(0, 10);
      const list = Array.isArray(x.responsaveis) ? x.responsaveis : [];
      return di > today && list.includes(username);
    });

    const updatable = futureWithUser.filter((x) => (x.responsaveis || []).length > 1);
    const skipped   = futureWithUser.filter((x) => (x.responsaveis || []).length <= 1);

    // Otimismo em massa
    const ids = new Set(updatable.map((t) => t.id));
    setItems((curr) => curr.map((x) => {
      if (!ids.has(x.id)) return x;
      return { ...x, responsaveis: (x.responsaveis || []).filter((u) => u !== username) };
    }));

    try {
      await Promise.all(updatable.map((t) => updateAtividade(t.id, {
        nome: t.nome,
        peso: Number(t.peso),
        data_inicio: String(t.data_inicio).slice(0, 10),
        data_fim:    String(t.data_fim).slice(0, 10),
        responsaveis: (t.responsaveis || []).filter((u) => u !== username),
      })));
      return { updated: updatable.length, skipped: skipped.length };
    } catch (e) {
      load();
      throw e;
    }
  }, [items, load]);

  /*
    Toggle de pessoa em uma INSTÂNCIA específica (currentShift ou nextShift).
    Backend espera o payload completo, então mandamos os outros campos preservados.
  */
  const togglePerson = useCallback(async (instanceId, username) => {
    const activity = items.find((x) => x.id === instanceId);
    if (!activity) return null;
    const current = Array.isArray(activity.responsaveis) ? activity.responsaveis : [];

    let next;
    if (current.includes(username)) {
      // Saindo: tira a pessoa. Se ficaria vazio, planta um placeholder
      // "vago" — atende o backend (min 1) e o front esconde o placeholder
      // visualmente. Sair é livre, sem aviso de tirania.
      next = current.filter((u) => u !== username);
      if (next.length === 0) next = [PLACEHOLDER_USER];
    } else {
      // Entrando: se a lista atual é só placeholder, tira ele antes de
      // adicionar a pessoa real — assim não fica "Vago + Fulano".
      const withoutPlaceholder = current.filter((u) => !isPlaceholder(u));
      next = [...withoutPlaceholder, username];
    }

    try {
      return await editActivity(instanceId, {
        nome:         activity.nome,
        data_inicio:  String(activity.data_inicio).slice(0, 10),
        data_fim:     String(activity.data_fim).slice(0, 10),
        peso:         Number(activity.peso),
        responsaveis: next,
      });
    } catch (e) {
      // NÃO mostrar toast aqui — o Facepile já faz catch e exibe o toast
      // com a mensagem completa. Mostrar nos dois lugares gerava duplicata.
      throw e;
    }
  }, [items, editActivity]);

  return {
    items,
    loading,
    error,
    weekDays,
    monday,
    stations,
    loadByUser,
    reload: load,
    createActivity,
    editActivity,
    editStation,
    removeActivity,
    togglePerson,
    snoozePerson,
    extendStation,
    deleteStationFuture,
    deleteStation,
    stationsByUser,
  };
}
