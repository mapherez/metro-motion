# Metro Lisboa Live — homelab

Mapa e tempos de chegada do Metro de Lisboa, alojados numa única máquina Linux
ARM64 com Docker Engine e Docker Compose v2. São necessários apenas dois
containers: `app` (React compilado + Fastify + ingestor) e `redis` (cache e pub/sub).

```text
Browser na LAN → servidor:8080 → app → Redis privado
                                 ↓
                           API oficial do Metro
```

## Instalação

```sh
cp .env.example .env
# Editar .env: preencher METRO_API_KEY com o token da API do Metro.
docker compose pull
docker compose up -d --wait
```

Abrir `http://IP_DO_SERVIDOR:8080`. Para escolher outra porta, definir
`APP_PORT` no `.env`. Não é necessário instalar Node ou pnpm no servidor.
O Compose usa `ghcr.io/mapherez/metro-motion-app` e Redis oficial
`redis:8-alpine`. No ARM64, o Docker seleciona a variante nativa da aplicação.
O primeiro arranque requer que a versão escolhida já tenha sido publicada no
GHCR. Se o pacote for privado, autenticar primeiro com `docker login ghcr.io`
e uma credencial com acesso de leitura ao pacote; a app não precisa dessa
credencial em execução.

Para compilar a aplicação localmente, sem precisar de uma publicação no GHCR:

```sh
docker compose -f compose.yaml -f compose.local.yaml up -d --build --wait
```

Redis não publica portas e não tem volume persistente. Guarda apenas dados
temporários que o ingestor reconstrói. Executar uma única réplica da aplicação,
para centralizar as chamadas ao fornecedor dos dados.

## Demonstração offline

Definir `METRO_MOCK=1` no `.env` e executar novamente:

```sh
docker compose up -d --wait
```

O mock usa um cenário temporal determinístico incluído na imagem, com dois
comboios por linha, paragens e inversões nos terminais. Não precisa de token,
ignora o horário de encerramento e nunca consulta a API externa. Este cenário
é sintético: serve para desenvolvimento e testes, não para calibrar posições
reais. A fixture antiga permanece nos testes auxiliares.

## Configuração

| Variável | Valor padrão / função |
| --- | --- |
| `APP_PORT` | `8080`, porta publicada na LAN |
| `APP_IMAGE_TAG` | Versão publicada no GHCR; o exemplo acompanha a versão do projeto |
| `METRO_API_BASE` | Endpoint HTTPS oficial, definido no exemplo |
| `METRO_API_KEY` | Token obrigatório em modo real; apenas no `.env` local |
| `METRO_MOCK` | `0`; usar `1` para dados locais |
| `POLL_INTERVAL_MS` | `2000`, intervalo entre ciclos de polling |
| `DWELL_SECONDS` | `25`, estimativa inicial de paragem; as observações ajustam as estimativas |
| `REDIS_TTL_SECONDS` | `15`, validade da cache |
| `MAP_TILE_URL` | Vazio: tiles OpenStreetMap; permite configurar outro fornecedor |
| `MAP_TILE_ATTRIBUTION` | Atribuição visível do fornecedor de tiles |

No Compose, `REDIS_URL` é fixado em `redis://redis:6379`; o frontend usa
`/api` na mesma origem, sem configuração de domínio ou IP no build.
O token não é argumento de build nem entra na imagem. Não partilhar o `.env`
ou a saída completa de `docker compose config`, que pode incluir o token.

A verificação TLS permanece ativa. O certificado CA do Metro é incluído na
imagem através de `NODE_EXTRA_CA_CERTS`. Não usar `METRO_TLS_INSECURE` ou
`NODE_TLS_REJECT_UNAUTHORIZED=0`; essas configurações são rejeitadas.

## API e comportamento

| Endpoint | Resposta |
| --- | --- |
| `GET /healthz` | `200`: processo HTTP ativo |
| `GET /readyz` | `200`: Redis acessível; `503`: dependência indisponível |
| `GET /api/now` | Snapshot; `204` se ainda não existir |
| `GET /api/lines/:lineId/etas` | ETAs de `azul`, `amarela`, `verde` ou `vermelha` |
| `GET /api/stream` | Eventos SSE e heartbeat a cada 20 segundos |
| `GET /api/stations/:stationId` | Metadados, chegadas de todas as linhas e configuração do mapa local |

O contrato do snapshot é `schemaVersion: 2`. Trajetórias, chegadas por estação
e estado do operador partilham uma única chave Redis. `t` identifica a última
observação utilizável (ou a criação de um estado sem observações); `receivedAt`
identifica o processamento. A frescura depende de `observedAt` por comboio/cais,
nunca da data do último HTTP 200. O header `X-Server-Time` em `/api/now`
sincroniza o relógio de apresentação do browser.

Os endpoints antigos sem `/api` foram substituídos. Rotas como `/about` e
`/line/azul` e `/station/AM` funcionam ao carregar diretamente no browser. APIs e assets
inexistentes devolvem `404`.

Entre 01:00 e 06:30 em `Europe/Lisbon`, o ingestor não consulta o Metro e
renova o estado de serviço fechado antes da expiração. Erros temporários
aplicam backoff e mantêm os timestamps originais dos últimos dados. A interface
assinala dados com mais de 30 segundos e oculta ETAs antigos. Uma falha do
fornecedor não torna o container unhealthy; o healthcheck verifica Redis.
Ligações Redis são restabelecidas automaticamente, e o browser reconecta SSE.

O acompanhamento distingue cada viagem das previsões de regresso do mesmo
comboio. As curvas preservam posição e velocidade nas correções de ETA,
respeitam limites em unidades esquemáticas de estações e não avançam para
segmentos não confirmados. Após 30 segundos sem observações frescas, os
marcadores param e ficam assinalados como desatualizados. Correções incompatíveis
e mudanças de sentido exigem reconfirmação e usam desaparecimento/reaparecimento
gradual. Uma resposta repetida não renova a validade dos dados.

Após duas respostas globais vazias durante o horário de serviço, o ingestor
consulta as quatro linhas, verificando a recuperação do endpoint global a cada
60 segundos. Dados `--`, negativos, antigos ou sem sentido resolvido não criam
posições fictícias. Horário normal, estado comunicado pelo operador e ausência
de dados são conceitos separados, incluindo durante greves. Metadados são
consultados no arranque e diariamente; estado das linhas, a cada 60 segundos.

## Interface e validação com dados reais

O desktop abre o mapa a partir de 1200 px com ponteiro preciso. Mobile/tablet
abrem as linhas; o seletor Mapa/Linhas guarda a preferência. As listas de
estações apresentam a linha vertical e os comboios nos dois sentidos, usando
o mesmo motor que o mapa geral. O desenho, posições e cores do mapa oficial
permanecem preservados.

Os dots e nomes abrem um drawer à direita: até 440 px no desktop, ecrã inteiro
em mobile/tablet. Fecha por botão, Escape, Voltar ou swipe à direita a partir
do cabeçalho/margem. A lista e o scroll permanecem por baixo do drawer.
Os detalhes incluem chegadas, correspondências, horários com fonte e data de
verificação, links oficiais e Leaflet/OpenStreetMap carregado apenas ao abrir
a estação. O mapa local não exige chave. Os tiles são externos e requerem
atribuição visível; não existe download em massa nem cache offline da app.

A animação ajusta-se às previsões atuais da API; não depende de recolher
sessões anteriores nem de assumir durações constantes ao longo do dia.
Gravar uma sequência é opcional e permite reproduzir alterações de ETA e
investigar problemas de movimento. A duração é livre; por exemplo, com Node 24:

```sh
pnpm record:metro --probe
pnpm record:metro --sessions 1 --minutes 15
pnpm replay:metro .test-artifacts/recordings/metro-SESSAO.jsonl .test-artifacts/replay.json
```

O gravador recusa iniciar sem ETAs numéricos atuais; grava apenas campos de
dados permitidos, sem URLs de API, headers ou credenciais. Cada sessão tem
manifesto com duração, completude, frames utilizáveis e erros. Uma gravação
interrompida não conta como sessão completa. Os ficheiros ficam fora do Git.
Selecionar o JSON convertido com `METRO_MOCK_FILE` para reproduzir a sequência;
fora de Docker pode usar o caminho local, em Docker deve montar o ficheiro.
O replay preserva intervalos, timestamps relativos e falhas de atualização:
quando a sequência acaba, os dados tornam-se antigos, sem renovação artificial.

## Operação, atualização e rollback

```sh
docker compose ps
docker compose logs --tail=100 -f app
docker compose logs --tail=100 redis
docker compose restart app
docker compose down
```

Os logs têm rotação: três ficheiros de até 10 MB por container. O Docker
reinicia processos que terminem com `restart: unless-stopped`; um estado
unhealthy, por si só, não reinicia o container. A aplicação trata a recuperação
de Redis sem depender de reinícios por healthcheck.

Antes de atualizar, preservar a imagem que está efetivamente em execução:

```sh
docker image tag "$(docker compose images -q app)" ghcr.io/mapherez/metro-motion-app:previous
# Editar APP_IMAGE_TAG no .env para a nova versão publicada.
docker compose pull
docker compose up -d --wait
```

Se necessário, voltar à imagem anterior sem reconstruir:

```sh
APP_IMAGE_TAG=previous docker compose up -d --no-build --wait app
```

Fixar também `APP_IMAGE_TAG=previous` no `.env` se esse rollback tiver de
persistir em futuros comandos. O rollback da app não requer migrações Redis.
Guardar revisões anteriores do Git para poder reconstruir as imagens.
O build da aplicação segue Node 24; Redis segue a imagem oficial Redis 8.
As atualizações entram ao publicar/puxar imagens, sem atualizações automáticas.

## GitHub Actions e releases

Existem dois workflows, ambos com execução manual no separador **Actions**:

- **CI**: corre automaticamente em pushes de branches, tags `v*` e pull
  requests. Valida versões, compila, executa testes e testa Compose em modo
  mock, sem token do Metro. Numa tag de release, só após todos os checks
  passarem chama o workflow de publicação da aplicação.
- **Docker App**: constrói/publica a aplicação em `linux/amd64` e `linux/arm64`.
  Pode correr isoladamente com **Run workflow**, escolhendo uma branch/tag e
  a opção `publish`. Desativar essa opção faz apenas o build. A publicação usa
  `GITHUB_TOKEN` com `packages: write`, sem secrets de Docker Hub nem token do
  Metro. O build valida a versão e executa os testes do backend.

A versão da aplicação está no `package.json` da raiz, inicialmente `1.0.0`.
As versões internas dos packages privados não representam releases independentes.
As imagens recebem tags como `:1.0.1` e `:sha-<commit>`; não é usada uma tag
`latest`, para que o homelab possa escolher explicitamente a versão a instalar.

Na branch `main`, com Node 24, pnpm 8.15.5 e Git autenticado no GitHub:

```sh
pnpm release
```

O script mostra a versão atual e pergunta a nova (`X.Y.Z`, superior à atual;
aceita também o prefixo `v`). Enter vazio cancela. Depois:

1. Verifica tags existentes e se `main` divergiu/ficou atrás do remoto.
2. Atualiza `package.json`, a versão padrão do Compose e `.env.example`.
3. Faz commit de todas as alterações, novos ficheiros e remoções não ignorados
   pelo Git. `.env`, caches e builds locais permanecem fora do commit.
4. Cria a tag anotada `vX.Y.Z` e envia branch + tag num push atómico, sem force.
5. O GitHub inicia CI pelo push; o CI da tag, se passar, publica a imagem.

O script termina depois do push, mostrando o link para acompanhar os Actions;
não espera pelos builds nem faz deploy no homelab. O push de branch e de tag
gera dois runs CI: o da branch valida; o da tag valida e publica.

Para rever o fluxo sem alterações locais ou remotas:

```sh
pnpm release --dry-run --version 1.0.1
```

Se o push falhar, commit e tag ficam preservados e o script indica o comando
para repetir o envio. Se o CI/build falhar após o push, corrigir o código e
criar uma nova release, ou reexecutar o CI/Docker App na tag para uma falha
transitória. O script não reutiliza uma tag já existente.

Depois de uma publicação bem-sucedida, atualizar `APP_IMAGE_TAG` no `.env`
do homelab e executar `docker compose pull && docker compose up -d --wait`.
O `.env` existente não é alterado pelo script de release.

## Desenvolvimento e testes

Fora dos containers, usar Node 24 e pnpm 8.15.5. O backend lê o `.env` da raiz;
Redis deve estar acessível em `REDIS_URL`. Para desenvolver no próprio servidor:

```sh
docker compose -f compose.yaml -f compose.dev.yaml up -d redis
corepack enable
pnpm install --frozen-lockfile
pnpm build
pnpm dev
```

Frontend de desenvolvimento: `http://localhost:5174`, com `/api` encaminhado
para `http://localhost:8080`. `BACKEND_PROXY_TARGET` em
`apps/frontend/.env.local` permite alterar apenas o destino do proxy Vite.
Definir `NODE_EXTRA_CA_CERTS` antes de iniciar Node em modo real; o script
`dev` do backend já usa o bundle do repo.
O override de desenvolvimento publica Redis apenas em `127.0.0.1:6379`;
o Compose de produção mantém Redis sem portas publicadas.

```sh
pnpm test                 # Build + node:test (sem Redis/API externos)
pnpm test:presentation    # Motor do frontend com relógio e snapshots simulados
pnpm version:check        # Verifica a versão do projeto/Compose/exemplo
pnpm typecheck           # Compila e verifica tipos dos workspaces
pnpm test:integration    # Stack Compose isolado, mock, reinícios e SSE real
```

O teste integrado requer Docker ativo e pode ser executado no próprio ARM64.
Cria um projeto Compose temporário, usa uma porta livre e elimina apenas os
seus containers no final. Nunca usa o token do `.env` principal.
Para verificar uma imagem ARM64 a partir de um host amd64 com emulação Docker:
`TEST_PLATFORM=linux/arm64 pnpm test:integration`. Se a emulação acionar a
proteção Redis `ARM64-COW-BUG`, usar
`TEST_PLATFORM=linux/arm64 TEST_ARM_EMULATION=1 pnpm test:integration` apenas
para esse teste mock descartável, com persistência desativada. Este override
não altera o Compose de produção. No homelab ARM64 não é necessário definir
essas variáveis: o teste usa a arquitetura nativa e mantém a proteção Redis.

Depois do teste automático, validar a partir de outro dispositivo da LAN:
abrir o mapa, as quatro linhas e fazer refresh numa página de linha. Em modo
real, confirmar atualização durante o horário de serviço. Para inspecionar
os dados: `curl -i http://IP_DO_SERVIDOR:8080/api/now`.

## Estrutura

- `apps/backend`: Fastify, ingestor, Redis e testes.
- `apps/frontend`: React/Vite, mapa SVG e páginas de linhas.
- `packages`: tipos Zod, normalização e geometria das estações.
- `infra/docker`: imagem multistage para a aplicação completa.
- `.github/workflows`: CI e publicação versionada da aplicação no GHCR.
- `tools/assets`: SVG e fixture Metro; `pnpm extract:stations` atualiza coordenadas.

Não são necessários serviços de hosting, caches geridas ou serviços de deploy
externos. A única integração externa durante o funcionamento real é a API do Metro.
