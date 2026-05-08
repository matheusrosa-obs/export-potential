# Rotas Maritimas Precalculadas para `MarketFlightsGLMap`

> Documento da feature mantido em `branch/searoutes/` para preservar o historico de decisoes desta branch.

## Contexto

O componente [components/MarketFlightsGLMap.tsx](/C:/Projetos/Nova%20pasta/export-potential/components/MarketFlightsGLMap.tsx:1) hoje desenha os fluxos comerciais como linhas quase retas entre `exporter` e `importer`, usando apenas as coordenadas ISO3 de `lib/country-coords.json`.

Isso funciona, mas produz um mapa pouco plausivel para fluxos maritimos. O objetivo desta feature e trocar a linha simples por uma polilinha maritima precomputada, sem executar `searoute-js` no browser nem no request path da Vercel.

## Objetivo

Fazer o mapa de fluxos internacionais usar rotas maritimas precomputadas por par de paises, com particionamento por `importer`, para manter:

- plausibilidade visual melhor que a linha reta atual
- custo previsivel no runtime
- independencia de `sh6` na geometria
- reaproveitamento da mesma rota para qualquer produto entre os mesmos paises
- compatibilidade futura com o fluxo atual de dados do projeto, sem depender de blob nesta fase

## Fora de Escopo

- navegacao comercial exata
- ETA, custo logistico, tempo de viagem ou previsao operacional
- modelagem multimodal terra + mar
- rotas dinamicas recalculadas por usuario no navegador
- usar `sh6` para determinar a geometria da rota

## Decisoes Aprovadas

1. O calculo da geometria acontece offline.
2. A geometria e precalculada por `exporter -> importer`, sem inflar por `sh6`.
3. O armazenamento continua particionado por `importer`.
4. A implementacao atual fica toda em modo local; qualquer adaptacao para blob fica para uma fase posterior.
5. Se a rota maritima nao existir, o endpoint devolve fallback em linha reta quando as coordenadas basicas existirem.
6. Nesta fase, os datasets de rotas ficam apenas locais no repositorio; publicacao em blob fica fora do escopo atual.
7. A documentacao desta feature fica em `branch/searoutes/`.
8. A particao de rotas deve ser cacheada por `importer` no servidor para evitar releitura desnecessaria quando o usuario trocar apenas o `sh6`.
9. Nenhum commit ou criacao de branch deve acontecer sem solicitacao explicita do usuario.
10. Na Sprint 5, o ponto do Brasil (`BRA`) passa a usar um porto especifico: Porto de Itajai (SC).

## Decisoes de Execucao (2026-05-08)

1. A geracao full de rotas foi executada com `npm run routes:generate-maritime`, sem `MARITIME_IMPORTERS` e sem `MARITIME_MAX_IMPORTERS`.
2. Em Windows, houve erro `EPERM` para `unlink`/`move` em `public/data/routes_by_importer`. Para estabilizar a execucao local:
   - a escrita temporaria de parquet passou a usar `os.tmpdir()`
   - o arquivo final `importer=XXX.parquet` passa a ser atualizado via `copyFile`
   - a limpeza do temporario e best-effort
3. Arquivos `.__tmp*` e `tmp_importer=*` nao fazem parte do contrato do dataset e podem ser removidos manualmente.
4. O dataset final esperado na pasta `public/data/routes_by_importer/` continua sendo:
   - `importer=*.parquet`
   - `index.json`

## Validacao Executada (2026-05-08)

### Geracao full e auditoria

- Comando: `npm run routes:generate-maritime`
- Resultado: `228` particoes geradas e `index.json` com `228` entradas.
- Comando: `npm run routes:audit-maritime`
- Resultado:
  - `partitions`: `228`
  - `totalRows`: `51756`
  - `totalBytes`: `5345536` (`5.1 MB`)
  - `coverage.maritime`: `42174`
  - `coverage.straightFallback`: `0` (esperado no dataset bruto)
  - `coverage.unavailable`: `9582`

### Smoke test (suite tecnica da feature)

- Comando:
  - `npm run test -- lib/maritime-routes.test.ts lib/maritime-route-service.test.ts app/api/market-flows-maritime/route.test.ts components/MarketFlightsGLMap.test.tsx`
- Resultado:
  - `4` arquivos de teste aprovados
  - `7` testes aprovados

## Validacao Sprint 5 (2026-05-08)

Escopo executado:

- atualizacao de `BRA` em `lib/country-coords.json` para `[-48.661944, -26.907778]` (`[lon, lat]`)
- regeneracao full do dataset com `npm run routes:generate-maritime`
- reauditoria com `npm run routes:audit-maritime`
- smoke test tecnico da feature com a suite de `4` arquivos

Resultado da auditoria apos a mudanca do ponto de `BRA`:

- `partitions`: `228`
- `totalRows`: `51756`
- `totalBytes`: `5338609` (`5.1 MB`)
- `coverage.maritime`: `42172`
- `coverage.straightFallback`: `0`
- `coverage.unavailable`: `9584`

Resultado do smoke test:

- `4` arquivos de teste aprovados
- `7` testes aprovados

## Esclarecimento Sobre Quantidade de Arquivos

Esta feature **nao** cria um parquet por par de paises.

O particionamento aprovado e:

- `1` parquet por `importer`
- cada parquet contem varias linhas `exporter -> importer`

Com `228` paises no `country-coords.json`, o teto teorico e:

- `51.756` pares direcionados no dataset logico
- ate `228` arquivos parquet fisicos se todos os paises tiverem particao

Exemplo:

- `public/data/routes_by_importer/importer=USA.parquet` contem `BRA -> USA`, `CHN -> USA`, `DEU -> USA`, etc.
- `public/data/routes_by_importer/importer=BEL.parquet` contem `BRA -> BEL`, `CHN -> BEL`, `DEU -> BEL`, etc.

Isso mantem a pasta organizada, previsivel e alinhada com a estrategia ja usada em `public/data/competitors/`.

## Fases de Entrega

Esta feature sera implementada em `3` sprints, com validacao progressiva:

### Sprint 1: Dataset local offline

Entrega:

- contrato final do dataset de rotas
- script de geracao por `importer`
- `index.json` local
- auditoria basica de cobertura e tamanho
- suporte a execucao parcial controlada para validar o pipeline antes do batch completo

Objetivo:

- garantir que a malha maritima exista localmente antes de acoplar qualquer parte do app

### Sprint 2: Backend local e cache

Entrega:

- leitura local das particoes de rotas
- cache server-side por `importer`
- endpoint `/api/market-flows-maritime`
- merge entre `df_competitors` e rotas

Objetivo:

- validar que o servidor consegue responder ao caso de uso do mapa sem depender de blob

### Sprint 3: Integracao no mapa

Entrega:

- consumo do novo endpoint no `MarketFlightsGLMap`
- renderizacao de polylines
- fallback reto
- checklist visual e funcional

Objetivo:

- fechar a feature visivel no produto com base no pipeline local ja validado

### Sprint 5: Coordenada portuaria especifica para o Brasil (Porto de Itajai)

Entrega:

- atualizar o ponto base de `BRA` para o Porto de Itajai
- documentar coordenadas adotadas no dataset
- regenerar o dataset de rotas por `importer`
- reexecutar auditoria e smoke test da feature

Coordenadas de referencia:

- graus/min/seg: `26° 54' 28" S`, `48° 39' 43" W`
- decimal aproximado: `[-48.661944, -26.907778]` (`[lon, lat]`)

Objetivo:

- aumentar a plausibilidade visual das rotas envolvendo o Brasil ao ancorar origem/destino em um porto real
- manter o contrato atual de dados e endpoint sem alterar o modelo por `sh6`

Impacto esperado:

- como `BRA` aparece como `importer` e `exporter`, a mudanca impacta particoes em toda a malha
- portanto, a execucao recomendada e regeneracao completa com `npm run routes:generate-maritime`

## Motivacao Tecnica

O runtime atual do mapa ja depende de `df_competitors` para descobrir os maiores fluxos por `importer` e `sh6`, mas a linha depende apenas de `exporter -> importer`. Isso implica:

- a mesma rota serve para qualquer `sh6`
- precalcular por `importer + sh6 + exporter` seria redundante
- gerar uma vez offline reduz CPU em runtime e estabiliza a latencia

## Arquitetura Proposta

### 1. Dataset auxiliar de rotas

Criar um novo conjunto de dados em `public/data/routes_by_importer/`, com:

- `importer=USA.parquet`
- `importer=BEL.parquet`
- `index.json`

Cada particao contem todas as rotas `exporter -> importer` daquele importador.

O `index.json` e a fonte local de descoberta nesta fase.
O suporte a `index.blob.json` pode ser retomado depois, mas nao faz parte da implementacao atual.

### 2. Pipeline offline de geracao

Criar um script Node em `scripts/` para:

- percorrer `lib/country-coords.json`
- gerar os pares direcionados validos
- chamar `searoute-js`
- registrar falhas e metadados
- emitir uma particao por `importer`
- medir tamanho final das particoes

Esse script e um passo manual de preparo de dados. Ele nao faz parte do request path.
Para validacao incremental em ambiente local, o script pode aceitar filtros de importador, por exemplo via `MARITIME_IMPORTERS` ou `MARITIME_MAX_IMPORTERS`, antes da execucao completa.

### 3. Leitura server-side local

Criar uma camada server-side dedicada para:

- ler a particao do `importer`
- cachear a particao carregada por `importer`
- hidratar as rotas por `exporter`
- servir o endpoint composto do mapa

Quando o usuario mantiver o mesmo `importer` e trocar apenas o `sh6`, a geometria deve ser reutilizada a partir do cache da particao ja carregada, reduzindo transferencia de dados e latencia.

### 4. Endpoint composto do mapa

Criar um endpoint especifico para o caso de uso do mapa:

- rota: `/api/market-flows-maritime`

Esse endpoint deve:

1. receber `importer`, `sh6` e `limit`
2. consultar `df_competitors`
3. identificar o `year` mais recente
4. agregar os valores do ano mais recente por `exporter`
5. ordenar por `value`
6. aplicar `limit`
7. fazer merge com as rotas do `importer`
8. devolver o payload pronto para o frontend

### 5. Frontend simplificado

O `MarketFlightsGLMap.tsx` deixa de montar a linha a partir de dois pontos e passa a consumir:

- `path_coords` quando houver rota maritima
- linha reta de fallback quando a rota estiver ausente
- `route_mode` explicito para tooltip e observabilidade

Como a geometria passa a ser multiponto, a serie `lines` do ECharts deve ser configurada para renderizar polylines, nao apenas o segmento simples atual.

## Formato do Dataset de Rotas

Cada linha da particao representa um par `exporter -> importer`.

Campos persistidos:

- `importer`
- `exporter`
- `distance_km`
- `route_mode`: `maritime` ou `unavailable`
- `path_coords_json`: string JSON com `[[lon, lat], ...]`
- `source`: `searoute-js`
- `snap_origin`
- `snap_destination`

### Observacoes Sobre o Formato

- nao salvar o GeoJSON completo por linha
- salvar apenas a lista de coordenadas
- `straight_fallback` nao precisa ser persistido no parquet
- `straight_fallback` e um estado derivado pelo endpoint quando a rota maritima nao existir, mas ainda houver `origin_coord` e `importer_coord`
- por isso, a auditoria do dataset bruto deve esperar `straight_fallback = 0`

## Contrato do Endpoint do Mapa

### Query params

- `importer` obrigatorio
- `sh6` obrigatorio
- `limit` opcional

### Resposta

```json
{
  "importer": "USA",
  "sh6": "020130",
  "year": 2024,
  "rows": [
    {
      "exporter": "BRA",
      "exporter_name": "Brazil",
      "value": 1234567,
      "route_mode": "maritime",
      "path_coords": [[-48.55, -27.59], [-42.0, -23.0], [-80.0, 25.0]],
      "origin_coord": [-48.55, -27.59],
      "importer_coord": [-95.71, 37.09]
    }
  ]
}
```

### Regras do Endpoint

- `year` deve refletir o ano mais recente encontrado para o filtro
- `rows` deve vir agregado por `exporter`
- `rows` deve vir ordenado por `value desc`
- `limit` deve ser aplicado depois da agregacao
- `route_mode = maritime` quando existir rota precomputada valida
- `route_mode = straight_fallback` quando nao houver rota, mas houver coordenadas suficientes
- `route_mode = unavailable` quando nem a rota nem a linha reta puderem ser montadas

## Comportamento do Mapa

### Fluxo principal

1. Usuario seleciona `importer` e `sh6`.
2. Frontend consulta `/api/market-flows-maritime`.
3. O servidor monta os fluxos do ano mais recente.
4. O servidor injeta a geometria por `exporter`.
5. O frontend renderiza:
   - `lines` com `path_coords`
   - bolhas dos exportadores
   - bolha do importador

### Fallback

Se a rota maritima nao existir:

- `route_mode = straight_fallback`
- o payload inclui `origin_coord` e `importer_coord`
- o frontend desenha uma linha de dois pontos

Se nem isso for possivel:

- `route_mode = unavailable`
- a linha nao e desenhada
- a bolha do exportador ainda pode aparecer se a coordenada existir

## Impacto no Runtime Atual

Essa estrategia evita executar `searoute-js` em request.

Enquanto a feature estiver em modo local, o impacto esperado passa a ser:

- leitura do `index.json` local
- leitura do parquet do importador preferencialmente uma vez por instancia aquecida, com reaproveitamento em trocas de `sh6`
- merge leve entre fluxos e rotas
- serializacao do payload final

## Dependencias

Dependencia principal:

- `searoute-js`

Dependencias auxiliares ja presentes no projeto continuam validas para:

- escrita local de datasets
- leitura de parquet via API

## Riscos

1. Alguns pares podem nao gerar rota util via `searoute-js`.
2. Particoes podem crescer se as polilinhas tiverem muitos pontos.
3. O `path_coords_json` pode custar mais do que o desejado se a geometria nao for simplificada.
4. Paises sem litoral podem produzir trajetos visualmente estranhos por snap maritimo.
5. A geracao local pode ficar lenta ou pesada se a simplificacao de geometria nao for suficiente.

## Mitigacoes

1. Persistir `route_mode` e derivar fallback no endpoint.
2. Manter o particionamento por `importer`.
3. Medir tamanho das particoes e simplificar geometria se necessario.
4. Descrever explicitamente o dado como aproximacao visual.
5. Medir o custo da geracao local antes de ampliar o escopo para blob.

## Criterios de Sucesso

- O mapa deixa de usar linhas quase retas para a maioria dos fluxos principais.
- A geometria da rota nao depende de `sh6`.
- O request path nao executa `searoute-js`.
- O endpoint devolve apenas o ano mais recente agregado por `exporter`.
- O endpoint evita releitura da particao de rotas quando apenas o `sh6` muda e o `importer` permanece o mesmo.
- O componente continua funcional quando faltarem rotas para alguns pares.
- O fluxo local permanece coerente e suficiente para desenvolver a feature nesta fase.
- A documentacao da feature fica consolidada em `branch/searoutes/`.

## Arquivos Provavelmente Envolvidos

- `branch/searoutes/spec.md`
- `branch/searoutes/plan.md`
- `components/MarketFlightsGLMap.tsx`
- `app/api/market-flows-maritime/route.ts`
- `lib/maritime-route-service.ts`
- `lib/country-coords.json`
- `scripts/generate-maritime-routes-by-importer.mjs`
- `scripts/audit-maritime-route-coverage.mjs`
- `public/data/routes_by_importer/index.json`
- `public/data/routes_by_importer/importer=*.parquet`

## Resultado Esperado

O sistema continua usando `df_competitors` como fonte de verdade para valores e filtros, mas passa a usar uma malha auxiliar precalculada localmente para desenhar trajetos maritimos plausiveis, baratos de servir e desacoplados da geracao online.
