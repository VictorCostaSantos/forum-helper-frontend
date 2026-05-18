import React, { useEffect, useMemo, useState } from 'react';
import { brandContainerStyle, brandFor, brandImageStyle } from './activityBrands';
import { detectCycle, formatDateShort } from './dateHelpers';
import { isAdmin } from './team';

const PESO_LABEL = { 1: 'Baixa', 2: 'Média', 3: 'Alta' };
const PESO_TONES = { 1: 'p1', 2: 'p2', 3: 'p3' };

/*
  Modal "Central de Atividades" — gestão em massa.

  Lista uma linha por ESTAÇÃO única (agrupada por nome). Pra cada:
   - Ícone + nome + cadência (semanal/quinzenal/mensal/spot)
   - Quantas ocorrências futuras existem
   - Quick-edit do peso (aplica em todas as ocorrências da estação)
   - Botão "Apagar futuras" (mantém histórico passado)

  Não exige rota nova — abre como overlay encima do painel principal.
*/
function AllocationCentral({
  open,
  stations,
  currentUsername,
  onClose,
  onUpdateStation,
  onDeleteStationFuture,
  onDeleteStation,
  onExtendStation,
}) {
  const [busy, setBusy] = useState(null);     // station.name em ação
  // Estado do mini-modal de confirmação de delete (em vez de window.confirm).
  const [confirm, setConfirm] = useState(null); // { station, mode: 'future'|'all', count }
  const userIsAdmin = isAdmin(currentUsername);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const rows = useMemo(() => {
    return stations.map((st) => {
      const cycle = detectCycle(st.instances || []);
      const today = new Date();
      const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const futureCount = (st.instances || []).filter(
        (x) => String(x.data_inicio || '').slice(0, 10) > todayIso,
      ).length;
      return { station: st, cycle, futureCount };
    }).sort((a, b) => a.station.name.localeCompare(b.station.name));
  }, [stations]);

  if (!open) return null;

  const cycleLabel = (c) => c === 'weekly' ? 'Semanal'
    : c === 'biweekly' ? 'Quinzenal'
    : c === 'monthly' ? 'Mensal'
    : 'Pontual';

  const handleDeleteFuture = (station, futureCount) => {
    if (!userIsAdmin) return;
    setConfirm({ station, mode: 'future', count: futureCount });
  };

  const runDeleteFuture = async (station) => {
    setBusy(station.name);
    try {
      const n = await onDeleteStationFuture?.(station.name);
      window.__showToast?.(`${n} ocorrência(s) removida(s).`, 'success');
    } catch (e) {
      window.__showToast?.(e?.message || 'Erro ao apagar futuras.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleChangePeso = async (station, newPeso) => {
    // Defesa em profundidade: a Central só é acessível pelo botão "Gerenciar"
    // que só aparece pra admin, mas garantir aqui evita escalation se um dia
    // alguém abrir a Central por outra via.
    if (!userIsAdmin) return;
    try {
      await onUpdateStation?.(station.name, { nome: station.name, peso: newPeso });
    } catch (e) {
      window.__showToast?.(e?.message || 'Erro ao atualizar peso.', 'error');
    }
  };

  const handleDeleteAll = (station, totalCount) => {
    if (!userIsAdmin) return;
    setConfirm({ station, mode: 'all', count: totalCount });
  };

  const runDeleteAll = async (station) => {
    setBusy(station.name);
    try {
      const n = await onDeleteStation?.(station.name);
      window.__showToast?.(`"${station.name}" apagada (${n} ocorrências removidas).`, 'success');
    } catch (e) {
      window.__showToast?.(e?.message || 'Erro ao apagar atividade.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleExtend = async (station) => {
    if (!userIsAdmin) return;
    setBusy(station.name);
    try {
      await onExtendStation?.(station);
      window.__showToast?.(`Próxima ocorrência de "${station.name}" criada.`, 'success');
    } catch (e) {
      window.__showToast?.(e?.message || 'Erro ao estender ciclo.', 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <div className="alloc-central__backdrop" onClick={onClose} />
      <div className="alloc-central" role="dialog" aria-modal="true" aria-label="Central de atividades">
        <header className="alloc-central__head">
          <div>
            <h2 className="alloc-central__title">Central de Atividades</h2>
            <p className="alloc-central__subtitle">
              Edita peso em massa, estende ciclos, apaga ocorrências futuras. {rows.length} atividade(s).
            </p>
          </div>
          <button
            type="button"
            className="alloc-central__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </header>

        <div className="alloc-central__notice">
          <i className="fa-solid fa-circle-info"></i>
          <div>
            <b>Apagar futuras</b> remove só as ocorrências agendadas pra frente —
            histórico do que já passou fica intacto e ninguém é "expulso" do
            presente. Pra recolocar, use <b>Estender ciclo</b> (ou crie nova
            atividade com o mesmo nome).
          </div>
        </div>

        <div className="alloc-central__body">
          {rows.length === 0 ? (
            <p className="alloc-central__empty">Nenhuma atividade cadastrada.</p>
          ) : null}

          {rows.map(({ station, cycle, futureCount }) => {
            const brand = brandFor(station.name);
            const peso = Number(station.reference?.peso) || 1;
            const nextDate = station.nextShift ? formatDateShort(station.nextShift.data_inicio) : null;
            const isBusy = busy === station.name;

            return (
              <article key={station.id} className={`alloc-central__row ${isBusy ? 'is-busy' : ''}`}>
                <div className="alloc-central__identity">
                  <div
                    className="alloc-central__icon"
                    style={brandContainerStyle(brand)}
                  >
                    {brand.image ? (
                      <img src={brand.image} alt="" className="alloc-central__icon-img" style={brandImageStyle(brand)} />
                    ) : (
                      <i className={brand.icon}></i>
                    )}
                  </div>
                  <div>
                    <div className="alloc-central__name">{station.name}</div>
                    <div className="alloc-central__meta">
                      <span>{cycleLabel(cycle)}</span>
                      <span aria-hidden="true">·</span>
                      <span>{(station.instances || []).length} ocorrência(s)</span>
                      {nextDate ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>próxima {nextDate}</span>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="alloc-central__actions">
                  {/* Peso: 3 botões */}
                  <div className="alloc-central__peso" role="group" aria-label="Mudar peso">
                    {[1, 2, 3].map((p) => (
                      <button
                        key={p}
                        type="button"
                        className={`alloc-central__peso-btn alloc-central__peso-btn--${PESO_TONES[p]} ${peso === p ? 'is-active' : ''}`}
                        onClick={() => peso !== p && handleChangePeso(station, p)}
                        disabled={isBusy}
                        title={PESO_LABEL[p]}
                      >
                        {PESO_LABEL[p]}
                      </button>
                    ))}
                  </div>

                  {/* Estender ciclo — cria 1 próxima ocorrência baseada no
                      padrão detectado (mesmo do botão "Virar plantão" do card). */}
                  {cycle && onExtendStation && userIsAdmin ? (
                    <button
                      type="button"
                      className="alloc-central__ghost"
                      onClick={() => handleExtend(station)}
                      disabled={isBusy}
                      title={`Criar próxima ocorrência ${cycleLabel(cycle).toLowerCase()}`}
                    >
                      <i className="fa-solid fa-rotate-right"></i>
                      Estender ciclo
                    </button>
                  ) : null}

                  {/* Apagar futuras (preserva histórico) */}
                  <button
                    type="button"
                    className="alloc-central__danger"
                    onClick={() => handleDeleteFuture(station, futureCount)}
                    disabled={isBusy || futureCount === 0 || !userIsAdmin}
                    title={
                      futureCount === 0
                        ? 'Nenhuma futura pra apagar'
                        : `Apagar ${futureCount} ocorrência(s) futura(s)`
                    }
                  >
                    <i className="fa-solid fa-broom"></i>
                    {futureCount > 0 ? `Apagar ${futureCount} futura(s)` : 'Sem futuras'}
                  </button>

                  {/* Apagar atividade inteira — discreto, só ícone.
                      Confirmação acontece no ConfirmDialog. */}
                  <button
                    type="button"
                    className="alloc-central__icon-danger"
                    onClick={() => handleDeleteAll(station, (station.instances || []).length)}
                    disabled={isBusy || !userIsAdmin || !onDeleteStation}
                    title={`Apagar a atividade "${station.name}" inteira`}
                    aria-label={`Apagar a atividade "${station.name}" inteira`}
                  >
                    <i className="fa-solid fa-trash"></i>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {/* Mini-modal de confirmação. Substitui o window.confirm/prompt nativo
          por algo enxuto, com botão grande de cancelar (default) e ação
          destrutiva clara. */}
      {confirm ? (
        <>
          <div className="alloc-confirm__backdrop" onClick={() => setConfirm(null)} />
          <div
            className="alloc-confirm"
            role="alertdialog"
            aria-modal="true"
            aria-label="Confirmar exclusão"
          >
            <div className="alloc-confirm__icon" aria-hidden="true">
              <i className={`fa-solid ${confirm.mode === 'all' ? 'fa-trash' : 'fa-broom'}`}></i>
            </div>
            <div className="alloc-confirm__body">
              <h3 className="alloc-confirm__title">
                {confirm.mode === 'all' ? 'Apagar a atividade inteira?' : 'Apagar ocorrências futuras?'}
              </h3>
              <p className="alloc-confirm__text">
                {confirm.mode === 'all' ? (
                  <>
                    <b>"{confirm.station.name}"</b> e suas <b>{confirm.count}</b> ocorrência(s) serão removidas — passado, presente e futuro. Esta ação não pode ser desfeita.
                  </>
                ) : (
                  <>
                    Vai apagar <b>{confirm.count}</b> ocorrência(s) futura(s) de <b>"{confirm.station.name}"</b>. O histórico passado fica intacto.
                  </>
                )}
              </p>
            </div>
            <div className="alloc-confirm__actions">
              <button
                type="button"
                className="alloc-confirm__cancel"
                onClick={() => setConfirm(null)}
                autoFocus
              >
                Cancelar
              </button>
              <button
                type="button"
                className="alloc-confirm__confirm"
                onClick={() => {
                  const { station, mode } = confirm;
                  setConfirm(null);
                  if (mode === 'all') runDeleteAll(station);
                  else runDeleteFuture(station);
                }}
              >
                {confirm.mode === 'all' ? 'Sim, apagar tudo' : 'Sim, apagar futuras'}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}

export default AllocationCentral;
