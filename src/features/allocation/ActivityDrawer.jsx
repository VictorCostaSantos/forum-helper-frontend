import React, { useEffect, useMemo, useState } from 'react';
import { useToast } from '../../shared/ui/ToastProvider';
import { PLACEHOLDER_USER, TEAM, canEditActivity, getDisplayName } from './team';
import { addDays, fromISODate, toISODate } from './dateHelpers';
import { brandContainerStyle, brandFor, brandImageStyle } from './activityBrands';
// Subtitle customizado foi removido — só fazia sentido se persistisse no
// backend; em localStorage só o próprio navegador via.

/*
  Repetição: gera N instâncias com o mesmo nome+responsáveis+peso e datas
  deslocadas por intervalo. Preserva a DURAÇÃO da 1ª ocorrência em cada
  instância (ex: ocorrência de 11/05–15/05 com repetição quinzenal gera
  25/05–29/05, 08/06–12/06, ...).
*/
const REPEAT_OPTIONS = [
  { value: 'none',     label: 'Sem repetição',         shortLabel: 'Não'        },
  { value: 'fixed',    label: 'Fixa (sem data de fim)', shortLabel: 'Fixa'      },
  { value: 'weekly',   label: 'Semanal',               shortLabel: 'Semanal'    },
  { value: 'biweekly', label: 'Quinzenal',             shortLabel: 'Quinzenal'  },
  { value: 'monthly',  label: 'Mensal',                shortLabel: 'Mensal'     },
];

/* Data "infinita" usada por atividades Fixas — passa do limiar de PERENNIAL_MIN_DAYS
   (180 dias), então o front trata como Fixo automaticamente. */
const FIXED_END_DATE = '2099-12-31';

function shiftPeriod(diIso, dfIso, repeat, n) {
  if (repeat === 'none' || n === 0) return { di: diIso, df: dfIso };
  const di = fromISODate(diIso);
  const df = fromISODate(dfIso);
  if (!di || !df) return { di: diIso, df: dfIso };
  if (repeat === 'weekly')   return { di: toISODate(addDays(di, 7 * n)),  df: toISODate(addDays(df, 7 * n))  };
  if (repeat === 'biweekly') return { di: toISODate(addDays(di, 14 * n)), df: toISODate(addDays(df, 14 * n)) };
  if (repeat === 'monthly') {
    const newDi = new Date(di); newDi.setMonth(newDi.getMonth() + n);
    const newDf = new Date(df); newDf.setMonth(newDf.getMonth() + n);
    return { di: toISODate(newDi), df: toISODate(newDf) };
  }
  return { di: diIso, df: dfIso };
}

/*
  Backend pode retornar erros em vários formatos (Sequelize, express-validator,
  ou string solta). Esse extrator tenta cada uma das formas e cai pra mensagem
  default do axios se nada bater. Também loga o body cru no console pra debug.
*/
/* Conta dias inclusivos entre duas datas ISO YYYY-MM-DD. */
function dayCount(startIso, endIso) {
  if (!startIso || !endIso) return 1;
  const [ys, ms, ds] = startIso.split('-').map(Number);
  const [ye, me, de] = endIso.split('-').map(Number);
  const s = Date.UTC(ys, ms - 1, ds);
  const e = Date.UTC(ye, me - 1, de);
  return Math.max(1, Math.round((e - s) / 86400000) + 1);
}

function extractApiError(e, fallback = 'Erro ao salvar.') {
  const data = e?.response?.data;
  if (data) console.error('[Alocação] resposta do backend:', data);

  if (typeof data === 'string' && data.trim()) return data;
  if (data?.message) return data.message;
  if (data?.error)   return data.error;
  if (Array.isArray(data?.errors) && data.errors.length) {
    return data.errors
      .map((er) => er?.message || er?.msg || er?.path || JSON.stringify(er))
      .join(' · ');
  }
  return e?.message || fallback;
}

const PESO_OPTIONS = [
  { value: 1, label: 'Baixa',  tone: 'p1' },
  { value: 2, label: 'Média',  tone: 'p2' },
  { value: 3, label: 'Alta',   tone: 'p3' },
];

const EMPTY_FORM = {
  nome: '',
  data_inicio: '',
  data_fim: '',
  responsaveis: [],
  peso: 2,
  repeat: 'none',          // só usado em mode='create'
  keepTeam: false,         // se true, replica responsáveis em todas as ocorrências
  repeatCount: 6,          // próximas ocorrências quando repeat ≠ 'none'
};

/*
  Drawer lateral pra criar/editar/visualizar uma atividade.

  Modos:
   - mode="create" → form em branco; pode chegar com prefill (pessoa/dia
     clicado na célula vazia).
   - mode="edit"   → form preenchido com a atividade.
   - mode="view"   → mesmo layout mas inputs read-only (quando o usuário
     não tem permissão pra editar).

  Permissão: admins editam tudo; demais só o que estão em responsaveis[].
*/
function ActivityDrawer({
  open,
  mode,                  // 'create' | 'edit' | 'view'
  activity,              // null em create
  prefill,               // { responsavel, data } pra célula clicada
  currentUsername,
  sameNameCount = 1,     // quantas instâncias têm o mesmo nome (toda a estação)
  onClose,
  onCreate,
  onUpdate,
  onUpdateStation,       // (oldName, { nome, peso }) → aplica em todas
  onDelete,
}) {
  const { showToast } = useToast();
  const [form, setForm]   = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [applyToAll, setApplyToAll]       = useState(false);

  // Reseta form sempre que abre. Em create, aplica prefill (mesmo dia em
  // início e fim — tarefa de 1 dia é o caso comum). Em edit/view, hidrata
  // com a atividade selecionada.
  useEffect(() => {
    if (!open) return;
    setConfirmDelete(false);
    setApplyToAll(false);
    if (mode === 'create') {
      const day = prefill?.data || toISODate(new Date());
      setForm({
        ...EMPTY_FORM,
        nome: prefill?.nome || '',
        data_inicio: day,
        data_fim: day,
        responsaveis: prefill?.responsavel ? [prefill.responsavel] : [],
      });
    } else if (activity) {
      const di = String(activity.data_inicio || activity.data || '').slice(0, 10);
      const df = String(activity.data_fim    || activity.data_inicio || activity.data || '').slice(0, 10);
      setForm({
        ...EMPTY_FORM,
        nome: activity.nome || '',
        data_inicio: di,
        data_fim: df,
        responsaveis: Array.isArray(activity.responsaveis) ? activity.responsaveis : [],
        peso: Number(activity.peso) || 2,
      });
    }
  }, [open, mode, activity, prefill]);

  // ESC fecha o drawer.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const readOnly = mode === 'view';
  const isEdit   = mode === 'edit';
  const isCreate = mode === 'create';

  const canDelete = useMemo(() => {
    if (!isEdit || !activity || !currentUsername) return false;
    return canEditActivity(currentUsername, activity);
  }, [isEdit, activity, currentUsername]);

  const valid = useMemo(() => {
    if (!form.nome || form.nome.trim().length < 3) return false;
    if (!form.data_inicio || !form.data_fim) return false;
    if (form.data_fim < form.data_inicio) return false;
    if (!Array.isArray(form.responsaveis) || form.responsaveis.length < 1) return false;
    if (![1, 2, 3].includes(Number(form.peso))) return false;
    return true;
  }, [form]);

  // Quando o usuário muda data_inicio, se data_fim estiver vazia ou antes
  // do novo início, alinha automaticamente. Evita inválido por descuido.
  const handleInicioChange = (val) => {
    setForm((f) => {
      const next = { ...f, data_inicio: val };
      if (!f.data_fim || f.data_fim < val) next.data_fim = val;
      return next;
    });
  };

  const toggleResp = (username) => {
    setForm((f) => {
      const has = f.responsaveis.includes(username);
      return {
        ...f,
        responsaveis: has
          ? f.responsaveis.filter((u) => u !== username)
          : [...f.responsaveis, username],
      };
    });
  };

  const handleSave = async () => {
    if (!valid || saving) return;
    setSaving(true);
    try {
      const basePayload = {
        nome: form.nome.trim(),
        responsaveis: form.responsaveis,
        peso: Number(form.peso),
      };
      if (isCreate) {
        const repeat = form.repeat;

        if (repeat === 'fixed') {
          // Atividade FIXA — 1 instância só, data_fim em 2099. Cai em isPerennial,
          // então o card mostra "Fixo" e nunca aparece como spot.
          await onCreate?.({
            ...basePayload,
            data_inicio: form.data_inicio,
            data_fim: FIXED_END_DATE,
          });
          showToast('Atividade fixa criada — sem data de fim definida.', 'success');
        } else {
          // Repetição cíclica (ou nenhuma): cria N instâncias com datas
          // deslocadas. 1ª SEMPRE leva os responsáveis selecionados; da 2ª em
          // diante depende do form.keepTeam:
          //   - keepTeam=true  → replica mesma equipe (ex: Fórum Helper)
          //   - keepTeam=false → nasce com placeholder (default, ex: Artigo)
          // Backend exige min 1 responsável; PLACEHOLDER_USER atende isso e
          // o front esconde visualmente como "Vago".
          const count = repeat === 'none' ? 1 : Math.max(1, Math.min(24, Number(form.repeatCount) || 1));
          const payloads = [];
          for (let i = 0; i < count; i++) {
            const { di, df } = shiftPeriod(form.data_inicio, form.data_fim, repeat, i);
            const isFirst = i === 0;
            payloads.push({
              ...basePayload,
              responsaveis: isFirst || form.keepTeam ? form.responsaveis : [PLACEHOLDER_USER],
              data_inicio: di,
              data_fim: df,
            });
          }
          await Promise.all(payloads.map((p) => onCreate?.(p)));
          showToast(
            count === 1
              ? 'Atividade criada!'
              : form.keepTeam
                ? `${count} ocorrências criadas com a mesma equipe.`
                : `${count} ocorrências criadas — as próximas nascem vazias, preencha conforme chegar a hora.`,
            'success',
          );
        }
      } else if (applyToAll && sameNameCount > 1 && onUpdateStation) {
        // "Aplicar a todas as ocorrências": muda nome+peso em toda a estação.
        // Datas e responsáveis de cada instância são preservados.
        await onUpdateStation(activity.nome, {
          nome: basePayload.nome,
          peso: basePayload.peso,
        });
        showToast(`Nome e peso atualizados nas ${sameNameCount} ocorrências.`, 'success');
      } else {
        // Edit normal — só atualiza a instância em foco.
        await onUpdate?.(activity.id, {
          ...basePayload,
          data_inicio: form.data_inicio,
          data_fim:    form.data_fim,
        });
        showToast('Atividade atualizada!', 'success');
      }
      onClose?.();
    } catch (e) {
      showToast(extractApiError(e, 'Erro ao salvar.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!canDelete) return;
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setSaving(true);
    try {
      await onDelete?.(activity.id);
      showToast('Atividade excluída.', 'success');
      onClose?.();
    } catch (e) {
      showToast(extractApiError(e, 'Erro ao excluir.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const title = isCreate ? 'Nova atividade' : (readOnly ? 'Atividade' : 'Editar atividade');

  return (
    <>
      <div className="alloc-drawer__backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="alloc-drawer" role="dialog" aria-modal="true" aria-label={title}>
        <header className="alloc-drawer__head">
          <h2 className="alloc-drawer__title">{title}</h2>
          <button type="button" className="alloc-drawer__close" onClick={onClose} aria-label="Fechar">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </header>

        <div className="alloc-drawer__body">
          {readOnly ? (
            <p className="alloc-drawer__hint">
              <i className="fa-solid fa-lock"></i>
              Você não está nessa atividade. Só admins e responsáveis podem editar.
            </p>
          ) : null}

          {/* Nome — com preview do ícone/cor quando o texto bate com um
              brand conhecido (Discord, Fórum, Imersão, etc). brandFor
              retorna DEFAULT_BRAND quando não bate; usamos a presença de
              `match` no retorno como sinal de "casou com um brand". */}
          {(() => {
            const brand = brandFor(form.nome);
            const brandMatched = Boolean(brand?.match);
            return (
              <div className="alloc-field">
                <label className="alloc-field__label">
                  Nome
                  {brandMatched ? (
                    <span
                      className="alloc-field__brand-preview"
                      style={brandContainerStyle(brand)}
                      title="Vai usar o ícone padrão dessa atividade"
                    >
                      {brand.image ? (
                        <img src={brand.image} alt="" className="alloc-field__brand-preview-img" style={brandImageStyle(brand)} />
                      ) : (
                        <i className={brand.icon}></i>
                      )}
                    </span>
                  ) : null}
                </label>
                <input
                  type="text"
                  className="alloc-field__input"
                  value={form.nome}
                  maxLength={255}
                  disabled={readOnly}
                  onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                  placeholder="Ex: Revisão de tópicos pendentes"
                />
              </div>
            );
          })()}

          {/* Período (data_inicio + data_fim) */}
          <div className="alloc-field">
            <label className="alloc-field__label">
              Período
              <span className="alloc-field__hint">
                {form.data_inicio === form.data_fim ? '1 dia' : `${dayCount(form.data_inicio, form.data_fim)} dias`}
              </span>
            </label>
            <div className="alloc-daterange">
              <input
                type="date"
                className="alloc-field__input"
                value={form.data_inicio}
                disabled={readOnly}
                onChange={(e) => handleInicioChange(e.target.value)}
                aria-label="Data de início"
              />
              <span className="alloc-daterange__sep" aria-hidden="true">→</span>
              <input
                type="date"
                className="alloc-field__input"
                value={form.data_fim}
                min={form.data_inicio || undefined}
                disabled={readOnly}
                onChange={(e) => setForm((f) => ({ ...f, data_fim: e.target.value }))}
                aria-label="Data de fim"
              />
            </div>
            {form.data_inicio && form.data_fim && form.data_fim < form.data_inicio ? (
              <p className="alloc-field__warn">
                <i className="fa-solid fa-triangle-exclamation"></i>
                A data de fim precisa ser posterior ou igual à data de início.
              </p>
            ) : null}
          </div>

          {/* Repetição — só faz sentido na criação. Em edit, escondemos. */}
          {isCreate ? (
            <div className="alloc-field">
              <label className="alloc-field__label">
                Repetição
                <span className="alloc-field__hint">
                  {form.repeat === 'none'
                    ? '1 ocorrência'
                    : form.repeat === 'fixed'
                    ? 'Sem data de fim'
                    : `${Math.max(1, Math.min(24, Number(form.repeatCount) || 1))} ocorrências`}
                </span>
              </label>
              <div className="alloc-repeat">
                {REPEAT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`alloc-repeat__btn ${form.repeat === opt.value ? 'is-active' : ''}`}
                    onClick={() => setForm((f) => ({ ...f, repeat: opt.value }))}
                    disabled={readOnly}
                  >
                    {opt.shortLabel}
                  </button>
                ))}
              </div>
              {form.repeat !== 'none' && form.repeat !== 'fixed' ? (
                <>
                  <div className="alloc-repeat__count">
                    <label htmlFor="alloc-repeat-count">Criar quantas?</label>
                    <input
                      id="alloc-repeat-count"
                      type="number"
                      min={2}
                      max={24}
                      step={1}
                      value={form.repeatCount}
                      onChange={(e) => setForm((f) => ({ ...f, repeatCount: Math.max(1, Math.min(24, Number(e.target.value) || 1)) }))}
                    />
                  </div>
                  <label className="alloc-repeat__keepteam">
                    <input
                      type="checkbox"
                      checked={form.keepTeam}
                      onChange={(e) => setForm((f) => ({ ...f, keepTeam: e.target.checked }))}
                    />
                    <span>
                      Manter mesma equipe nas próximas ocorrências
                      <small>
                        Sem marcar, só a 1ª ocorrência leva os responsáveis selecionados;
                        as demais nascem vazias pra você atribuir depois.
                      </small>
                    </span>
                  </label>
                </>
              ) : null}
            </div>
          ) : null}

          {/* Peso */}
          <div className="alloc-field">
            <label className="alloc-field__label">Prioridade (peso)</label>
            <div className="alloc-peso">
              {PESO_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`alloc-peso__btn alloc-peso__btn--${opt.tone} ${
                    Number(form.peso) === opt.value ? 'is-active' : ''
                  }`}
                  onClick={() => !readOnly && setForm((f) => ({ ...f, peso: opt.value }))}
                  disabled={readOnly}
                >
                  <span className="alloc-peso__dot" aria-hidden="true" />
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Toggle "aplicar em todas" — só aparece em edit quando a
                estação tem mais de 1 ocorrência (cíclica). */}
            {isEdit && sameNameCount > 1 && !readOnly ? (
              <label className="alloc-apply-all">
                <input
                  type="checkbox"
                  checked={applyToAll}
                  onChange={(e) => setApplyToAll(e.target.checked)}
                />
                <span>
                  Aplicar nome e peso a <b>todas as {sameNameCount} ocorrências</b>
                  <small>Datas e responsáveis de cada ocorrência ficam intactos.</small>
                </span>
              </label>
            ) : null}
          </div>

          {/* Responsáveis */}
          <div className="alloc-field">
            <label className="alloc-field__label">
              Responsáveis
              <span className="alloc-field__hint">{form.responsaveis.length} selecionado(s)</span>
            </label>
            <div className="alloc-resp-list">
              {TEAM.slice().sort((a, b) => a.displayName.localeCompare(b.displayName, 'pt-BR')).map((m) => {
                const checked = form.responsaveis.includes(m.username);
                return (
                  <button
                    key={m.username}
                    type="button"
                    className={`alloc-resp ${checked ? 'is-checked' : ''}`}
                    onClick={() => !readOnly && toggleResp(m.username)}
                    disabled={readOnly}
                  >
                    <span className="alloc-resp__check" aria-hidden="true">
                      {checked ? <i className="fa-solid fa-check"></i> : null}
                    </span>
                    <span className="alloc-resp__name">{m.displayName}</span>
                  </button>
                );
              })}
            </div>

            {/* Mostra responsáveis fora do TEAM (raríssimo, mas o backend
                aceita string livre — bom não perder a info na edição). */}
            {form.responsaveis.filter((u) => !TEAM.some((m) => m.username === u)).length > 0 ? (
              <p className="alloc-field__warn">
                <i className="fa-solid fa-triangle-exclamation"></i>
                Responsáveis fora da lista do time:&nbsp;
                {form.responsaveis
                  .filter((u) => !TEAM.some((m) => m.username === u))
                  .map(getDisplayName)
                  .join(', ')}
              </p>
            ) : null}
          </div>
        </div>

        {/* Footer só aparece quando edita; em view, só fecha. */}
        {!readOnly ? (
          <footer className="alloc-drawer__foot">
            {canDelete ? (
              <button
                type="button"
                className={`alloc-btn alloc-btn--danger ${confirmDelete ? 'is-confirming' : ''}`}
                onClick={handleDelete}
                disabled={saving}
              >
                <i className="fa-solid fa-trash"></i>
                {confirmDelete ? 'Confirmar exclusão' : 'Excluir'}
              </button>
            ) : <span />}

            <div className="alloc-drawer__actions">
              <button type="button" className="alloc-btn alloc-btn--ghost" onClick={onClose} disabled={saving}>
                Cancelar
              </button>
              <button
                type="button"
                className="alloc-btn alloc-btn--primary"
                onClick={handleSave}
                disabled={!valid || saving}
              >
                {saving ? <i className="fa-solid fa-spinner fa-spin"></i> : null}
                {isCreate ? 'Criar' : 'Salvar'}
              </button>
            </div>
          </footer>
        ) : null}
      </aside>
    </>
  );
}

export default ActivityDrawer;
