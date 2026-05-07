// Resolve URL pra abrir um curso na Alura.
// Preferência (em ordem):
//   1. course.link_curso — URL direta vinda do backend, mais preciso
//   2. busca pelo nome — fallback robusto pra qualquer caso em que o link
//      não venha (curso novo/raro, ou apenas o nome conhecido sem objeto).
//
// Aceita tanto o objeto course inteiro (preferido) quanto só o nome (string)
// pra retro-compat com chamadas antigas/parciais.
export function aluraCourseUrl(courseOrName) {
  if (!courseOrName) return 'https://cursos.alura.com.br/';
  if (typeof courseOrName === 'object') {
    if (courseOrName.link_curso) return courseOrName.link_curso;
    return aluraSearchUrl(courseOrName.curso_nome);
  }
  return aluraSearchUrl(courseOrName);
}

export function aluraSearchUrl(courseName) {
  if (!courseName) return 'https://cursos.alura.com.br/';
  const head = courseName.split(':')[0].trim();
  return `https://cursos.alura.com.br/search?query=${encodeURIComponent(head)}`;
}
