# Ferramentas e fixtures

- `assets/map.svg`: SVG de origem para extrair coordenadas. Não é necessário no runtime.
- `extract-stations.mjs`: incorpora coordenadas em `packages/station-data/src/stations.ts`.
- `assets/tempoEspera_Estacao_todos.json`: fixture antiga para testes auxiliares.
- `assets/mock-sequence.json`: cenário temporal sintético incluído na imagem Docker para `METRO_MOCK=1`.
- `record-metro.mjs`: grava sequências de duração configurável para diagnóstico, recusa iniciar sem dados frescos e nunca grava credenciais. `--sessions 1 --minutes 15` permite uma sessão curta; o default continua a ser duas sessões de 45 minutos.
- `replay-metro.mjs`: converte JSONL do gravador em sequência temporal para `METRO_MOCK_FILE`.
- `test-compose.mjs`: teste integrado isolado, em modo mock, com SSE e reinícios da app/Redis.
- `release.mjs`: release interativo (versão, commit, tag e push atómico).
- `version.mjs`: validação/sincronização da versão do projeto.
- `image-metadata.mjs`: tags versionadas da aplicação no GHCR.

Depois de alterar o SVG, executar `pnpm extract:stations`. Para testar o stack
Docker executar `pnpm test:integration` com Docker ativo. A fixture também é
usada pelos testes unitários; em modo mock nunca existe fallback para a API.

Consultar o [README principal](../README.md) para configuração e operação.
