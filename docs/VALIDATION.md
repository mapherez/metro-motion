# Validação do acompanhamento e da interface

Verificação realizada em 14/10/2026. A API do Metro não fornecia observações
numéricas frescas; a greve indicada pelo utilizador impede a recolha em
circulação normal. Não foram feitas gravações reais nem afirmada calibração
com telemetria real. O cenário mock é explicitamente sintético.

## Verificações concluídas

- `pnpm test`: build dos cinco packages, 35 testes do backend, 5 do motor
  de apresentação do frontend e 12 das ferramentas, incluindo o gravador.
  Os 52 testes passaram.
- Atualizações nos últimos décimos de segundo preservam uma chegada viável,
  sem impor novamente uma duração mínima de viagem. O limite de velocidade
  é verificado no extremo real da curva, incluindo picos entre amostras.
- O motor real do frontend foi testado com relógio determinístico, atraso
  de rede, ETAs oscilantes, timestamps repetidos e recuperação após dados
  desatualizados. O fade começa na receção pelo browser e preserva a
  trajetória apresentada durante a retirada de um marcador.
- `pnpm version:check`: versões consistentes; `git diff --check`: sem erros.
- `pnpm test:integration`: imagem Docker compilada, frontend e API servidos
  pelo mesmo container, Redis real, SSE com leitura de frames completos,
  dois leitores, um subscriber partilhado, reinícios de Redis/app e
  recuperação das ligações. Projeto isolado em mock, sem token; containers
  e rede temporários removidos no final. Executado em amd64.
- Replay determinístico de 35 minutos nas quatro linhas: continuidade de
  posição e velocidade, coordenadas dentro da linha, duas viagens por linha,
  paragens e mudanças de viagem. Casos adicionais cobrem destinos intermédios,
  previsões de regresso, reconfirmação, clocks de cais, DST, ETAs inválidos,
  tempos repetidos, respostas vazias e congelamento após 30 segundos.
- Gravador: argumentos, recusa de dados antigos/`--`, frames com campos
  permitidos e ausência de credenciais/headers/extras do fornecedor.
- Chrome, Firefox e WebKit: navegação entre linhas, drawer com nome acessível,
  foco dentro do diálogo, fecho por botão/Escape, URL direta e histórico.
  WebKit foi usado como teste do motor do Safari; não foi usado Safari nativo.
- Desktop 1440 px, tablet 1024 px e mobile 390 px: mapa ou lista conforme
  layout, drawer lateral ou completo, sem scroll horizontal.
- Chrome com emulação touch: fecho por toque e swipe real via eventos de
  entrada do browser, retorno à lista e preservação do scroll/foco.
- Texto a 200%: reflow corrigido, incluindo cabeçalho, navegação e linhas;
  os dots são reposicionados pelas medidas reais das linhas da lista.
- Pausa: transformações dos marcadores mantidas; movimento reduzido:
  animação contínua desativada. Snapshot com HTTP 200 e timestamps antigos:
  aviso visível e marcadores parados; recuperação devolve dados atuais.
- Geometria e coordenadas do mapa oficial não foram alteradas.

## Validação real pendente e gravações opcionais

Quando houver circulação normal e ETAs atuais, observar o movimento na app.
A animação usa as previsões atuais; não exige gravações prévias nem durações
constantes entre estações. Se for útil reproduzir algum comportamento,
gravar uma sequência de duração adequada ao problema, por exemplo:

```sh
pnpm record:metro --probe
pnpm record:metro --sessions 1 --minutes 15
pnpm replay:metro .test-artifacts/recordings/metro-SESSAO.jsonl .test-artifacts/replay.json
```

As duas sessões de 45 minutos propostas inicialmente não são um requisito
de funcionamento ou de aceitação. Os dados gravados não substituem as
previsões em produção: servem para repetir o mesmo caso durante uma correção.

Confirmar duração/completude nos manifestos e observar chegadas, partidas e
inversões nos terminais. Reproduzir o ficheiro com `METRO_MOCK_FILE` e comparar
a coerência da trajetória com os ETAs. Esta comparação não prova a posição
física exata, pois a API não disponibiliza posições ou velocidades medidas.

As estimativas de viagem/paragem são aprendidas em memória e reconstruídas
após reiniciar a app; os valores iniciais continuam configuráveis. Os limites
de velocidade/aceleração são expressos em intervalos de estações do esquema,
não em km/h. Nenhuma imagem foi publicada e não foi feito deploy.
