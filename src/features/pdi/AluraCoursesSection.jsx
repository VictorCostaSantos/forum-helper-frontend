import React, { useMemo, useState } from 'react';
import { aluraCourseUrl } from './aluraUrl';

// Helpers de status — mesma régua usada no resto do app.
const STATUSES = [
  { id: 'all', label: 'Todos' },
  { id: 'in-progress', label: 'Em andamento' },
  { id: 'done', label: 'Concluídos' },
  { id: 'just-started', label: 'Recém iniciados' },
];

function statusOf(course) {
  const p = Number(course.porcentagem_concluida) || 0;
  if (p >= 100) return 'done';
  if (p > 0 && p < 10) return 'just-started';
  return 'in-progress';
}

const SORTS = [
  { id: 'recent', label: 'Mais recentes' },
  { id: 'progress-desc', label: 'Maior progresso' },
  { id: 'progress-asc', label: 'Menor progresso' },
];

// Cor por escola pra dar identidade visual nos chips.
const SCHOOL_COLORS = {
  'Programação': 'var(--cor-programacao)',
  'Front-end': 'var(--cor-frontend)',
  'Data Science': 'var(--cor-data-science)',
  'DevOps': 'var(--cor-devops)',
  'UX & Design': 'var(--cor-ux-design)',
  'Mobile': 'var(--cor-mobile)',
  'Inovação & Gestão': 'var(--cor-inovacao-gestao)',
  'Inteligência Artificial': 'var(--cor-ia)',
  'Outros': 'var(--cor-default)',
  'Cursos proprietários': 'var(--cor-default)',
  'Cursos proprietários escolas': 'var(--cor-default)',
};

function relativeTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return '';
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'agora';
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  if (diff < 604800) return `há ${Math.floor(diff / 86400)} dias`;
  if (diff < 2592000) return `há ${Math.floor(diff / 604800)} sem`;
  if (diff < 31536000) return `há ${Math.floor(diff / 2592000)} meses`;
  return `há ${Math.floor(diff / 31536000)} anos`;
}

function CourseCard({ course }) {
  const pct = Math.min(100, Math.max(0, Number(course.porcentagem_concluida) || 0));
  const done = pct >= 100;
  const accent = SCHOOL_COLORS[course.escola_nome] || 'var(--cor-default)';
  const url = aluraCourseUrl(course);

  // Card inteiro é um <a> — clique abre o curso na Alura em nova aba.
  // Mantém UX direta: você bateu o olho, clicou, foi estudar.
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className={`alura-course ${done ? 'is-done' : ''}`}
      style={{ '--course-accent': accent }}
      title="Abrir na Alura"
    >
      <div className="alura-course__top">
        <span className="alura-course__school">{course.escola_nome}</span>
        <span className="alura-course__time">{relativeTime(course.ultimo_acesso)}</span>
      </div>

      <div className="alura-course__title">{course.curso_nome}</div>

      <div className="alura-course__bar">
        <div className="alura-course__bar-fill" style={{ width: `${pct}%` }} />
      </div>

      <div className="alura-course__foot">
        <span className="alura-course__pct">{pct}%</span>
        <span className="alura-course__activities">
          {course.atividades_feitas} / {course.atividades_totais} atividades
        </span>
      </div>

      <span className="alura-course__open" aria-hidden="true">
        <i className="fa-solid fa-arrow-up-right-from-square"></i>
        Estudar agora
      </span>
    </a>
  );
}

function AluraCoursesSection({
  data,
  loading,
  error,
  onRefetch,
  fromCache,
  lastFetchedAt,
  pdiCourseSet,
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [schoolFilter, setSchoolFilter] = useState('all');
  const [sort, setSort] = useState('recent');

  const allFromBi = data?.courses || [];

  // Filtra ao subset que está no PDI. Se um curso vinculado não veio no BI
  // (renomeado/removido), ele sai daqui silenciosamente — o chip do Linker
  // ainda mostra o nome, mas o card aqui some.
  const pdiCourses = useMemo(() => {
    if (!pdiCourseSet || pdiCourseSet.size === 0) return [];
    return allFromBi.filter((c) => pdiCourseSet.has(c.curso_nome));
  }, [allFromBi, pdiCourseSet]);

  const schools = useMemo(() => {
    const set = new Set(pdiCourses.map((c) => c.escola_nome));
    return ['all', ...[...set].sort()];
  }, [pdiCourses]);

  const stats = useMemo(() => {
    const total = pdiCourses.length;
    const done = pdiCourses.filter((c) => Number(c.porcentagem_concluida) >= 100).length;
    const inProg = pdiCourses.filter((c) => {
      const p = Number(c.porcentagem_concluida) || 0;
      return p > 0 && p < 100;
    }).length;
    const avg = total
      ? Math.round(pdiCourses.reduce((a, c) => a + (Number(c.porcentagem_concluida) || 0), 0) / total)
      : 0;
    return { total, done, inProg, avg };
  }, [pdiCourses]);

  const filteredSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = pdiCourses;
    if (q) list = list.filter((c) => c.curso_nome.toLowerCase().includes(q));
    if (statusFilter !== 'all') list = list.filter((c) => statusOf(c) === statusFilter);
    if (schoolFilter !== 'all') list = list.filter((c) => c.escola_nome === schoolFilter);

    const sorted = [...list];
    if (sort === 'recent') {
      sorted.sort((a, b) => (a.ultimo_acesso < b.ultimo_acesso ? 1 : -1));
    } else if (sort === 'progress-desc') {
      sorted.sort((a, b) => (Number(b.porcentagem_concluida) || 0) - (Number(a.porcentagem_concluida) || 0));
    } else if (sort === 'progress-asc') {
      sorted.sort((a, b) => (Number(a.porcentagem_concluida) || 0) - (Number(b.porcentagem_concluida) || 0));
    }
    return sorted;
  }, [pdiCourses, search, statusFilter, schoolFilter, sort]);

  const hasPdiCourses = pdiCourses.length > 0;

  return (
    <section className="alura-section">
      <header className="alura-section__head">
        <div className="alura-section__title-block">
          <h2 className="alura-section__title">
            <i className="fa-solid fa-graduation-cap"></i>
            Cursos do meu PDI
          </h2>
          <p className="alura-section__subtitle">
            Cursos vinculados às suas tarefas do PDI. Clique em qualquer card pra abrir o
            curso direto na Alura e ir pra atividade.
          </p>
        </div>

        <button
          type="button"
          className="alura-section__refresh"
          onClick={onRefetch}
          disabled={loading}
          title="Buscar dados atualizados"
        >
          <i className={`fa-solid fa-rotate ${loading ? 'fa-spin' : ''}`}></i>
          <span>{loading ? 'Buscando…' : 'Atualizar'}</span>
        </button>
      </header>

      {error ? (
        <div className="alura-section__error">
          <i className="fa-solid fa-triangle-exclamation"></i>
          <div>
            <strong>Não foi possível carregar.</strong>
            <span>{error}</span>
            <span className="alura-section__error-hint">
              Verifica se o backend está rodando em <code>http://localhost:3001</code>.
            </span>
          </div>
          <button type="button" onClick={onRefetch}>Tentar de novo</button>
        </div>
      ) : null}

      {!error && loading && !data ? (
        <div className="alura-section__loading">
          <i className="fa-solid fa-spinner fa-spin"></i>
          Carregando seus cursos…
        </div>
      ) : null}

      {!error && data && !hasPdiCourses ? (
        <div className="alura-section__empty alura-section__empty--cta">
          <i className="fa-solid fa-link-slash"></i>
          <div>
            <strong>Nenhum curso vinculado ao PDI ainda.</strong>
            <span>
              Expanda uma tarefa acima e clique em <em>"Vincular curso"</em> pra começar a
              acompanhar o progresso real direto da Alura.
            </span>
          </div>
        </div>
      ) : null}

      {!error && hasPdiCourses ? (
        <>
          <div className="alura-section__stats">
            <div className="alura-section__stat">
              <span className="alura-section__stat-num">{stats.total}</span>
              <span className="alura-section__stat-lbl">No PDI</span>
            </div>
            <div className="alura-section__stat">
              <span className="alura-section__stat-num">{stats.done}</span>
              <span className="alura-section__stat-lbl">Concluídos</span>
            </div>
            <div className="alura-section__stat">
              <span className="alura-section__stat-num">{stats.inProg}</span>
              <span className="alura-section__stat-lbl">Em andamento</span>
            </div>
            <div className="alura-section__stat">
              <span className="alura-section__stat-num">{stats.avg}%</span>
              <span className="alura-section__stat-lbl">Média</span>
            </div>
          </div>

          <div className="alura-section__filters">
            <div className="alura-section__search">
              <i className="fa-solid fa-magnifying-glass"></i>
              <input
                type="search"
                placeholder="Buscar curso do PDI…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="alura-section__chips">
              {STATUSES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`alura-chip ${statusFilter === s.id ? 'is-active' : ''}`}
                  onClick={() => setStatusFilter(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="alura-section__selects">
              <select
                value={schoolFilter}
                onChange={(e) => setSchoolFilter(e.target.value)}
                aria-label="Filtrar por escola"
              >
                {schools.map((s) => (
                  <option key={s} value={s}>{s === 'all' ? 'Todas as escolas' : s}</option>
                ))}
              </select>

              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                aria-label="Ordenação"
              >
                {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
          </div>

          {filteredSorted.length === 0 ? (
            <div className="alura-section__empty">
              <i className="fa-solid fa-folder-open"></i>
              Nenhum curso do PDI bate com os filtros atuais.
            </div>
          ) : (
            <div className="alura-courses-grid">
              {filteredSorted.map((c, i) => (
                <CourseCard key={`${c.curso_nome}-${i}`} course={c} />
              ))}
            </div>
          )}

          <div className="alura-section__meta">
            {fromCache ? (
              <span><i className="fa-solid fa-bolt"></i> Servido do cache · 5min</span>
            ) : (
              <span><i className="fa-solid fa-cloud-arrow-down"></i> Dados frescos do BI</span>
            )}
            {lastFetchedAt ? (
              <span className="alura-section__meta-time">
                {new Date(lastFetchedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
              </span>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
}

export default AluraCoursesSection;
