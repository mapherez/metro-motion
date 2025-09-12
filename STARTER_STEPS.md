# Metro Lisboa — Live Map (Realtime)

Aplicação web que mostra o **mapa completo do Metro de Lisboa** e anima, em tempo quase real (2–3s), as **posições dos comboios** nas 4 linhas. O sistema respeita rate‑limits da API oficial e escala de poucos testers para milhares de utilizadores.

> **TL;DR**
>
> * Realtime: **SSE** (Server‑Sent Events) do backend → frontend.
> * Ingestor único a **polling 2–3s** ao endpoint oficial `tempoEspera/Estacao/todos`.
> * **Redis** para snapshot + pub/sub.
> * Front em **React** (Vite) com animações do mapa.
> * Deploy: backend (Northflank/Fly.io), front (Vercel/Netlify), Redis (Upstash).

---

## Arquitectura

```
Metro API  ──► Ingestor (Node)
                 │  polling 2–3s
                 ▼
             Redis (snapshot + pub/sub)
                 │
         ┌───────┴────────┐
         │ API Gateway     │  /now (REST)
         │  (Node)         │  /stream (SSE)
         └───────┬────────┘
                 │ broadcast SSE
                 ▼
            Frontend (React)
```

* **Ingestor**: 1 processo que chama `tempoEspera/Estacao/todos` a cada 2–3s, normaliza dados por comboio e guarda **snapshot** no Redis + publica num canal.
* **API Gateway**: expõe `GET /now` (snapshot imediato) e `GET /stream` (SSE com updates). Não fala com a API do Metro diretamente.
* **Frontend**: faz `GET /now` no carregamento e liga ao `EventSource(/stream)`; anima marcadores no mapa de acordo com `progress01` (0..1 entre estações).

### Porquê SSE (e não WebSocket)?

* Unidireccional, leve e simples (ideal para difusão de snapshots frequentes). WebSocket fica para cenários bi‑direction.

### Rate‑limit

* Só o ingestor fala com a API do Metro → 1 pedido/2–3s, independentemente do nº de utilizadores.
* Backoff: em `429/5xx`, dobrar temporariamente o intervalo (p.ex. 6s por 1–2 min) e regressar depois.

---

## Endpoints da API oficial utilizados

* **Obrigatório (realtime)**: `tempoEspera/Estacao/todos`

  * Dá, por cais, até 3 próximas chegadas (tempo em segundos), ID(s) do comboio e destino.
* **Opcional (pouco frequente)**: `estadoLinha/todos` (p.ex. 1x / 30–60 min) para indicar perturbações/alertas na UI.
* **Estático (front)**: `infoEstacao/todos` e `infoDestinos/todos` (nomes, coords, mapeamentos). Parseado e empacotado como JSON estático no repo.

> **Nota**: toda a lógica de animação é inferida só com `tempoEspera/Estacao/todos`.

---

## Monorepo & Pastas

Monorepo com **pnpm workspaces** + **Turborepo**.

```
metro-live/
  apps/
    frontend/           # React (Vite) — SPA
    backend/            # Node (Fastify) — ingestor + API
  packages/
    shared-types/       # Tipos TS + schemas Zod do Snapshot
    station-data/       # Dados estáticos: ordem das estações por linha, coords, destinos
    shared-utils/       # Utils comuns (normalização, helpers)
  infra/
    docker/             # Dockerfile backend
    deploy/             # manifests (Northflank/Fly.io), env samples
  pnpm-workspace.yaml
  turbo.json
  README.md
```

**`pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "infra/*"
```

**`turbo.json` (básico)**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**", ".next/**"] },
    "lint": {},
    "dev": { "cache": false }
  }
}
```

---

## Variáveis de Ambiente (backend)

Criar `.env` na root do `apps/backend`:

```
# API Metro
METRO_API_BASE=https://<base-oficial>
METRO_API_KEY=            # se aplicável (opcional)
POLL_INTERVAL_MS=2000     # 2000–3000 recomendado
DWELL_SECONDS=25          # tempo médio parado em estação

# Redis (Upstash)
REDIS_URL=                # redis://... OU REST URL da Upstash
REDIS_TOKEN=              # se for REST
REDIS_TTL_SECONDS=15      # TTL do snapshot
REDIS_CHANNEL=metro:events
REDIS_SNAPSHOT_KEY=metro:snapshot

# CORS/Segurança
CORS_ORIGIN=https://teu-front.com
PORT=8080
```

---

## Esquema de Dados (shared-types)

```ts
import { z } from "zod";

export const Train = z.object({
  id: z.string(),                 // ex.: "4C"
  line: z.enum(["verde","azul","amarela","vermelha"]),
  from: z.string(),               // stop_id de onde vem
  to: z.string(),                 // próximo stop_id
  etaNext: z.number(),            // segundos até próxima estação
  progress01: z.number().min(0).max(1),
  dest: z.string()                // destino (nome)
});

export const Line = z.object({
  trains: z.array(Train)
});

export const Snapshot = z.object({
  t: z.number(),                  // epoch secs
  lines: z.record(Line)           // { verde: { trains: [...] }, ... }
});

export type Snapshot = z.infer<typeof Snapshot>;
```

### Chaves Redis

* `metro:snapshot`: JSON do `Snapshot` (TTL \~ 15s).
* `metro:events`: canal pub/sub com novo `Snapshot` (ou diffs pequenos).

---

## Backend (Fastify) — Tarefas

1. **Bootstrap do servidor**

   * Fastify + `fastify-cors` (origens permitidas).
   * Rotas: `GET /healthz`, `GET /now`, `GET /stream` (SSE).

2. **Ingestor (loop 2–3s)**

   * `fetch` a `tempoEspera/Estacao/todos`.
   * Normalizar: agrupar por `comboio`, inferir `line` (pela estação/destino), `from`/`to`, `etaNext`, `dest`.
   * **Direção**: usar destino (terminal) + ordem canónica das estações por linha.
   * **Interpolação**: manter estado anterior por comboio para calcular `progress01` contínuo entre ticks.
   * Escrever `metro:snapshot` (TTL) e `publish metro:events`.

3. **/now (REST)**

   * Lê `metro:snapshot` do Redis e devolve o JSON (validar com Zod).

4. **/stream (SSE)**

   * Handshake SSE; subscrever `metro:events`; `res.write("data: ...\n\n")` por update.
   * Heartbeat (ping a cada 15–30s) para manter conexões ativas.

5. **Resiliência & limites**

   * Timeouts curtos no `fetch` (p.ex. 3s) + retries exponenciais.
   * Em falha, re‑emitir último snapshot com `staleAge` (front mostra “Atualizado há Xs”).

6. **Dockerfile**

   * Multi‑stage: build + runtime alpine. Expor `PORT`.

7. **Deploy**

   * **Northflank** ou **Fly.io**: 1 serviço com auto‑restart; definir envs do Redis e Metro.
   * Readiness: `GET /healthz`.

---

## Frontend (React + Vite) — Tarefas

1. **Setup**

   * React + TypeScript + Vite.
   * State manager: **Zustand** (leve) ou Context.

2. **Dados estáticos**

   * `packages/station-data`: JSON com **ordem das estações por linha** + coords + mapeamento de destinos.
   * Importar no front para desenhar o mapa (SVG/Canvas) e para lógica de direção.

3. **Carga inicial**

   * `GET /now` → `setSnapshot` (validar com `zod`).

4. **Realtime**

   * Abrir `EventSource('/stream')` → `onmessage`: atualizar estado.
   * Mostrar “Atualizado há Xs”.

5. **Mapa & Animação**

   * Render estático dos percursos por linha (SVG paths).
   * Para cada `train`: posicionar entre `from`→`to` usando `progress01` → `getPointAtLength` no path.
   * `requestAnimationFrame` para suavizar entre snapshots.
   * Dwell: quando `etaNext≈0`, estacionar \~`DWELL_SECONDS` antes de transitar.

6. **UX**

   * Filtro por linha.
   * Indicador de estado da linha (`estadoLinha/todos`, fetch esporádico).
   * Mobile‑first (pane com lista de próximas chegadas por estação).

7. **PWA (opcional)**

   * Service Worker para cache do último snapshot + ícones + offline leve.

---

## Scripts & Comandos (pnpm)

```bash
# instalar dependências
pnpm i

# dev: backend e frontend em paralelo
pnpm -w dev

# build tudo
pnpm -w build

# lint
pnpm -w lint
```

No `package.json` da root:

```json
{
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint"
  }
}
```

---

## Roadmap (MVP → Plus)

**MVP**

* [ ] Parser dos dados estáticos (estações/destinos) → JSON.
* [ ] Ingestor: polling 2–3s → Redis (snapshot + pub/sub).
* [ ] API: `/now` + `/stream` (SSE) + `/healthz`.
* [ ] Front: carga inicial + SSE + mapa com animação linear + dwell.
* [ ] Deploy: backend (Northflank/Fly.io), frontend (Vercel), Redis (Upstash).

**Polish**

* [ ] Backoff inteligente (429/5xx) e métricas (p75 latência, taxa de erro).
* [ ] Curva de velocidade (ease‑in/out) por troço.
* [ ] Badge de estado da linha (fetch 30–60 min).
* [ ] Logs estruturados (pino) + dashboards.

**Escala**

* [ ] Horizontalizar API Gateway (várias réplicas) com Redis pub/sub.
* [ ] Cluster Node (PM2/Node cluster) se necessário.
* [ ] CDN/WAF (Cloudflare) à frente do Gateway.

---

## Exemplos de Código (trechos)

**SSE (server)**

```ts
app.get('/stream', async (req, reply) => {
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });

  const sub = redis.subscribe(process.env.REDIS_CHANNEL!);
  const ping = setInterval(() => reply.raw.write(`:\n\n`), 20000);

  sub.on('message', (_ch, msg) => reply.raw.write(`data: ${msg}\n\n`));
  req.raw.on('close', () => { clearInterval(ping); sub.unsubscribe(); });
});
```

**SSE (client)**

```ts
useEffect(() => {
  fetch('/now').then(r => r.json()).then(setSnapshot);
  const es = new EventSource('/stream');
  es.onmessage = (e) => setSnapshot(merge(JSON.parse(e.data)));
  es.onerror = () => es.close();
  return () => es.close();
}, []);
```

---

## Contribuir / Dev Notes

* Estilo: TypeScript estrito, eslint + prettier.
* Commits: Conventional Commits.
* CI: Lint + build (GitHub Actions) e preview deploy no front.

---

## Licença

A definir pelo autor do repositório.

---

## Créditos

* Dados: API oficial do Metro de Lisboa.
* Autor: Pedro + contribs.
