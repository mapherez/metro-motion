# Validação do acompanhamento e da interface

Verificação realizada em 14 e 15/10/2026. No dia 14, sem previsões atuais,
a validação usou o cenário mock sintético. No dia 15 foram consultados os
endpoints oficiais e recolhidas sequências reais, sem credenciais, para
reproduzir as atualizações e verificar o acompanhamento.

## Verificações concluídas

- `pnpm test`: build dos cinco packages, 42 testes do backend, 5 do motor
  de apresentação do frontend e 12 das ferramentas, incluindo o gravador.
  Os 59 testes passaram.
- ETAs numéricos e textuais são aceites na fronteira da API. `--`, valores
  negativos e fracionários continuam sem gerar previsões. A abertura depois
  do estado noturno recupera com as respostas numéricas reais.
- Relógios independentes dos cais não substituem a próxima estação por uma
  estação distante mais recente. Um zero residual numa estação já ultrapassada
  não faz recuar nem retirar o comboio. Previsões de regresso futuras, mesmo
  repetidas, não confirmam por si uma inversão da viagem atual.
- Gravações preservam os tipos originais dos ETAs e a hora de receção. O replay
  normaliza os dados para o motor e mantém a idade de cada cais, incluindo
  respostas que misturam registos atuais e antigos.
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

## Validação com dados reais em 15/10/2026

- O endpoint global e os quatro endpoints de linha responderam com HTTP 200.
  A primeira consulta global validada devolveu 111 registos e 324 observações
  numéricas frescas. A falha anterior era a validação exigir texto nos ETAs,
  embora a API devolva números; entrou no commit `4900e55`.
- A app local usou o ingestor, API HTTP e SSE reais com dados do operador;
  apenas o Redis deste preview foi substituído pelo adaptador de testes.
  A integração Compose verificou separadamente Redis real e dois containers.
  Não foi alterado nem reiniciado o serviço no homelab.
- Uma sessão com o acompanhamento corrigido reuniu 197 snapshots em 474,7 s,
  com 33 comboios na primeira amostra. Foram analisados 6 550 estados de
  comboios: nenhuma descontinuidade de posição/velocidade nas atualizações
  da mesma viagem e nenhum excesso de velocidade ou sentido contrário.
  Registaram-se 99 transições para paragem e 117 mudanças de próxima estação.
- O Chrome apresentou marcadores em movimento no mapa e na linha vertical;
  a pausa manteve as posições. O drawer de Alameda mostrou chegadas das duas
  linhas, localização Leaflet e ligações oficiais. Ligações diretas e fecho
  também foram verificados com dados reais no Firefox e WebKit, sem erros.
  O drawer mobile foi corrigido para não sair do viewport com scrollbar fixa.
- O comando do gravador foi exercitado numa sessão curta real: dois frames
  utilizáveis, com ETAs numéricos preservados. A conversão e reprodução
  produziram comboios nas quatro linhas (8/10/8/7 na amostra).
- As sequências e capturas locais estão em `.test-artifacts/` e
  `output/playwright/`, ignoradas pelo Git. Os testes de regressão reproduzem
  os casos encontrados sem depender da API ou destes ficheiros locais.

Limites: a observação é finita e não prova a posição física dos comboios.
Na sessão analisada, correções de ETA incompatíveis com os limites de
aceleração deixaram algumas chegadas animadas até cerca de 9 s depois da
previsão. O motor preserva continuidade em vez de saltar para a estação.
Safari/iPhone e dispositivos físicos continuam sem teste direto; WebKit e
layouts emulados não substituem essa verificação. O deploy e a revisão final
no homelab ficam a cargo do utilizador.

## Gravações opcionais

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
após reiniciar a app. `DWELL_SECONDS` configura a paragem inicial; na ausência
de observações anteriores existe uma estimativa inicial de viagem de 90 s.
Os limites
de velocidade/aceleração são expressos em intervalos de estações do esquema,
não em km/h. Nenhuma imagem foi publicada e não foi feito deploy.
