# 0001 — Fastify dentro da API interna do Next

**Status:** aceito · **Data:** 2026-09

## Contexto

O projeto precisa de uma API HTTP com validação de schema, documentação OpenAPI e um lugar
organizado para hooks e plugins. Os Route Handlers do Next dão o transporte, mas não dão nada disso
— cada rota reinventa validação, tratamento de erro e serialização.

Queríamos o ecossistema do Fastify sem passar a operar dois serviços.

## Decisão

Uma única rota catch-all do Next, `src/app/api/[[...slug]]/route.ts`, converte o `Request` da Web
API em opções de `fastify.inject()` e converte a resposta de volta em `Response`.

O Fastify é registrado com `prefix: "/api"`, de modo que o pathname passa inteiro e não há remoção
de prefixo em lugar nenhum. Nada trafega por socket: a requisição é processada em memória, no mesmo
processo do Next.

A conversão vive em [`src/server/bridge.ts`](../../src/server/bridge.ts).

## Alternativas consideradas

**Servidor Fastify em processo separado, com rewrite do Next.** Ganharia streaming real e WebSocket.
Custaria dois processos em desenvolvimento e dois serviços em produção — desproporcional para o
tamanho do projeto.

**Só Route Handlers do Next, com Zod na mão.** Menos peças, mas sem OpenAPI automático, sem
serialização validada e sem um ponto único de tratamento de erro.

## Consequências

**A favor**

- Um processo, um deploy, um `pnpm dev`
- Plugins, hooks, schemas e type providers do Fastify disponíveis
- OpenAPI gerado dos mesmos schemas Zod que validam as rotas — documentação que não sai de sincronia
- Rotas testáveis com `inject()` direto, sem subir servidor

**Contra**

- **Sem streaming real de resposta.** O `inject()` bufferiza o corpo inteiro antes de devolver.
  Downloads grandes ou SSE não funcionam bem por este caminho
- **Sem WebSocket.** Não há upgrade de conexão
- Uma camada de conversão a mais, com detalhes que precisam estar certos: `set-cookie` múltiplo
  exige `headers.append` (o objeto plano juntaria tudo numa string com vírgulas e quebraria os
  cookies); cabeçalhos hop-by-hop precisam ser descartados; 204 e 304 não podem ter corpo

**Efeito colateral não óbvio:** o Turbopack reescreve `__dirname` nos pacotes que empacota, e o
`@fastify/swagger-ui` passa a procurar seus assets num caminho inexistente, derrubando toda a API
com `ENOENT`. A correção é listar os pacotes de servidor em `serverExternalPackages` no
`next.config.ts`.

## Quando revisitar

Se o projeto precisar de streaming de resposta, SSE ou WebSocket, esta decisão bloqueia. A migração
para processo separado é direta: `buildFastify()` já é independente do Next; bastaria um `listen()`
e um rewrite.
