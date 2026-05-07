import React, { useEffect, useMemo, useRef, useState } from 'react';
import { aluraCourseUrl } from './aluraUrl';

// Vincula cursos do BI da Alura a uma tarefa do PDI. Os vínculos viram a fonte
// de progresso da tarefa (média dos %), substituindo o slider manual quando há
// pelo menos 1 vínculo. Identificador é o curso_nome (não tem ID estável no CSV).

function clsx(...arr) { return arr.filter(Boolean).join(' '); }

function CourseChip({ course, onRemove }) {
  const pct = Number(course?.porcentagem_concluida) || 0;
  const done = pct >= 100;
  const courseName = course?.curso_nome;
  const url = course ? aluraCourseUrl(course) : null;
  return (
    <span className={clsx('linker-chip', done && 'is-done')} title={courseName || ''}>
      <span className="linker-chip__pct">{pct}%</span>
      <span className="linker-chip__name">{courseName || '(curso não encontrado)'}</span>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="linker-chip__open"
          aria-label="Abrir curso na Alura"
          title="Abrir curso na Alura"
          onClick={(e) => e.stopPropagation()}
        >
          <i className="fa-solid fa-arrow-up-right-from-square"></i>
        </a>
      ) : null}
      <button
        type="button"
        className="linker-chip__remove"
        onClick={onRemove}
        aria-label="Desvincular curso"
        title="Desvincular"
      >
        <i className="fa-solid fa-xmark"></i>
      </button>
    </span>
  );
}

function CourseLinker({ allCourses, linkedNames, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  // Fecha ao clicar fora ou apertar Esc.
  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onEsc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  // Hidrata vínculos salvos com objetos do dataset atual. Curso pode ter sumido
  // do BI — mantemos o nome no chip pra o usuário saber o que estava ali.
  const linkedCourses = useMemo(() => {
    const map = new Map((allCourses || []).map((c) => [c.curso_nome, c]));
    return (linkedNames || []).map((name) => map.get(name) || { curso_nome: name });
  }, [allCourses, linkedNames]);

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    const linkedSet = new Set(linkedNames || []);
    let list = (allCourses || []).filter((c) => !linkedSet.has(c.curso_nome));
    if (q) list = list.filter((c) => c.curso_nome.toLowerCase().includes(q));
    // Cursos em andamento primeiro, depois recém iniciados, depois concluídos.
    list.sort((a, b) => {
      const pa = Number(a.porcentagem_concluida) || 0;
      const pb = Number(b.porcentagem_concluida) || 0;
      const ka = pa >= 100 ? 2 : pa > 0 ? 0 : 1;
      const kb = pb >= 100 ? 2 : pb > 0 ? 0 : 1;
      if (ka !== kb) return ka - kb;
      return pb - pa;
    });
    return list.slice(0, 25);
  }, [allCourses, linkedNames, search]);

  const handleAdd = (course) => {
    onChange([...(linkedNames || []), course.curso_nome]);
    setSearch('');
    // Mantém aberto pra o usuário poder adicionar vários em sequência.
  };

  const handleRemove = (name) => {
    onChange((linkedNames || []).filter((n) => n !== name));
  };

  if (!allCourses || allCourses.length === 0) {
    return (
      <div className="linker linker--disabled">
        <span className="linker__lbl">
          <i className="fa-solid fa-link"></i> Cursos vinculados
        </span>
        <span className="linker__hint">
          Carregue os cursos da Alura primeiro pra poder vincular.
        </span>
      </div>
    );
  }

  return (
    <div className="linker" ref={ref}>
      <span className="linker__lbl">
        <i className="fa-solid fa-link"></i>
        Cursos vinculados
        <span className="linker__count">{linkedCourses.length}</span>
      </span>

      {linkedCourses.length > 0 ? (
        <div className="linker__chips">
          {linkedCourses.map((c) => (
            <CourseChip
              key={c.curso_nome}
              course={c}
              onRemove={() => handleRemove(c.curso_nome)}
            />
          ))}
        </div>
      ) : (
        <p className="linker__empty">
          Nenhum curso vinculado ainda. O % da tarefa segue manual até você vincular pelo menos 1.
        </p>
      )}

      <button
        type="button"
        className={clsx('linker__add', open && 'is-open')}
        onClick={() => setOpen((v) => !v)}
      >
        <i className="fa-solid fa-plus"></i>
        {open ? 'Fechar' : 'Vincular curso'}
      </button>

      {open ? (
        <div className="linker__pop">
          <div className="linker__search">
            <i className="fa-solid fa-magnifying-glass"></i>
            <input
              type="search"
              autoFocus
              placeholder="Buscar curso da Alura…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {candidates.length === 0 ? (
            <div className="linker__pop-empty">Nenhum curso encontrado.</div>
          ) : (
            <ul className="linker__pop-list">
              {candidates.map((c) => {
                const pct = Number(c.porcentagem_concluida) || 0;
                return (
                  <li key={c.curso_nome}>
                    <button type="button" onClick={() => handleAdd(c)}>
                      <span className="linker__pop-pct">{pct}%</span>
                      <span className="linker__pop-info">
                        <span className="linker__pop-name">{c.curso_nome}</span>
                        <span className="linker__pop-school">{c.escola_nome}</span>
                      </span>
                      <i className="fa-solid fa-plus"></i>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default CourseLinker;
