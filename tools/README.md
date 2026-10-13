# Ferramentas e fixtures

- `assets/map.svg`: SVG de origem para extrair coordenadas. Não é necessário no runtime.
- `extract-stations.mjs`: incorpora coordenadas em `packages/station-data/src/stations.ts`.
- `assets/tempoEspera_Estacao_todos.json`: fixture versionada, incluída na imagem Docker para `METRO_MOCK=1`.
- `test-compose.mjs`: teste integrado isolado, em modo mock, com SSE e reinícios da app/Redis.
- `release.mjs`: release interativo (versão, commit, tag e push atómico).
- `version.mjs`: validação/sincronização da versão do projeto.
- `image-metadata.mjs`: tags versionadas da aplicação no GHCR.

Depois de alterar o SVG, executar `pnpm extract:stations`. Para testar o stack
Docker executar `pnpm test:integration` com Docker ativo. A fixture também é
usada pelos testes unitários; em modo mock nunca existe fallback para a API.

Consultar o [README principal](../README.md) para configuração e operação.
