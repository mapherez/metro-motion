# Deploy no homelab

O deploy usa `compose.yaml` para puxar a imagem versionada da aplicação do
GHCR e a imagem oficial `redis:8-alpine`, sem persistência nem portas Redis.
As imagens suportam Linux ARM64 e amd64. `compose.local.yaml` ativa builds
locais através de `infra/docker/backend.Dockerfile`.

Consultar o [README principal](../../README.md) para configuração, healthchecks,
operação, atualização, rollback e teste integrado em modo mock.
