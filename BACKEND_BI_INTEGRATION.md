# Integração BI - Tópicos por Membro

## Visão Geral
O gráfico "Volume de Contribuições" do Dashboard tem um toggle Brasil/Latam. Quando
LATAM está selecionado, ele troca a fonte de dados pro endpoint `/api/bi-topics`,
que agrega os posts da query do BI da LATAM por `responder_username`.

Implementado em:
- Backend: `forum-helper-backend/src/services/scraperService.js` (`fetchMemberTopics`),
  `src/controllers/apiController.js` (`getBiTopics`), `src/routes/apiRoutes.js`
- Frontend: `src/api/apiService.js` (`fetchMemberTopicsByRegion`),
  `src/features/dashboard/DashboardView.jsx` (reaproveita o mesmo canvas/chart.js
  do "Volume de Contribuições" — não é um painel separado)

## Endpoint

**GET** `/api/bi-topics?region=BR|LATAM`

O backend decide o ID do BI internamente (`URLS.BI_STATS_URL` / `URLS.BI_LATAM_STATS_URL`
em `utils/urls.js`) — o frontend só manda a região, sem `biId`.

### Resposta
```typescript
Array<{
  name: string;
  username: string;      // já normalizado pro username BR do roster (ver abaixo)
  totalTopics: number;
  openTopics: number;     // status DISCUSSING
  closedTopics: number;   // status EXPIRED ou SOLVED
  rate: number;           // % de posts marcados como is_solution
}>
```

## Tradução de username LATAM → BR

Algumas pessoas logam com usernames diferentes na LATAM (ex: `victos-costa` no BR é
`victor-costa` na LATAM). A query do BI da LATAM já filtra pelo username correto de
cada plataforma no `WHERE` — mas a coluna `responder_username` que ela devolve ainda
vem no formato nativo da LATAM.

Por isso `fetchMemberTopics('LATAM')` traduz de volta pro username BR do roster via
`LATAM_TO_BR_USERNAME` (espelha `LATAM_USER_MAPPING` do frontend, em `apiService.js`).
Sem isso, o mesmo colaborador apareceria com identidades diferentes entre os toggles
BR e LATAM (nome duplicado, sem agrupar histórico, e o realce do próprio usuário no
gráfico — self-avatar/anonimização por "Membro N" — quebraria).

Se alguém novo com username diferente entre plataformas entrar pro time: atualizar
os dois mapeamentos (frontend `LATAM_USER_MAPPING` e backend `LATAM_TO_BR_USERNAME`).

## Cache

10 minutos, em memória, no backend (`biCacheLatam` em `scraperService.js`) — mesmo
padrão já usado pra query BR (`biCache`/`fetchGeneralStats`).

## Teste rápido
```bash
curl 'https://forum-helper-zmqxu.ondigitalocean.app/api/bi-topics?region=LATAM'
```
