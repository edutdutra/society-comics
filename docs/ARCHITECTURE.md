# Arquitetura

## O fluxo de uma requisição

```
navegador
   │
   ├─── GET /                      página (Server Component)
   │       │
   │       └──► listPublications() ──► Mongoose ──► MongoDB Atlas
   │            (repositório, chamado DIRETO — sem HTTP)
   │
   └─── GET /api/publications      API
           │
           ▼
    src/app/api/[[...slug]]/route.ts     única rota do Next
           │
           ▼
    src/server/bridge.ts
           │  Request (Web API) → InjectOptions
           ▼
    fastify.inject()                     em memória, mesmo processo
           │
           ▼
    src/server/app.ts  (prefix /api)
           ├─ plugins/errors.ts          handler de erro único
           ├─ plugins/swagger.ts         OpenAPI em /api/docs
           ├─ routes/health.ts
           └─ routes/publications.ts
                   │
                   ▼
           repositories/publications.ts  ← mesma camada que a página usa
                   │
                   ▼
           models/Publication.ts (Mongoose) ──► MongoDB Atlas
```

## Por que Fastify dentro do Next

A alternativa seria um servidor Fastify em outra porta com o Next fazendo proxy. Isso significaria
dois processos para rodar em desenvolvimento e dois serviços para implantar. Com `fastify.inject()`
a requisição é processada em memória, sem passar por socket, e ganhamos os plugins, hooks, schemas e
a geração de OpenAPI do Fastify dentro do processo do Next.

O custo está registrado em [adr/0001-fastify-dentro-do-next.md](adr/0001-fastify-dentro-do-next.md):
a resposta é bufferizada (sem streaming real) e não há upgrade para WebSocket.

## Por que a página não chama a própria API

`src/app/page.tsx` é Server Component e chama `listPublications()` direto. Um `fetch` do servidor
para `localhost:3000/api/publications` seria uma volta pela rede para buscar dados que estão a uma
chamada de função de distância — mais latência, mais um ponto de falha, e serialização JSON
desnecessária.

As rotas HTTP continuam existindo, mas para quem realmente precisa delas: clientes externos, o
importador e a documentação Swagger.

## Os dois caches, e por que são diferentes

Este é o detalhe menos óbvio do projeto.

| | Fastify (`app.ts`) | Mongoose (`db.ts`) |
|---|---|---|
| Onde | variável de módulo | `globalThis` |
| Sobrevive ao HMR? | **Não**, de propósito | **Sim**, de propósito |
| Por quê | O HMR reavalia `app.ts` quando qualquer rota ou plugin muda, e a variável zerada faz a próxima requisição reconstruir o Fastify já com o código novo | Uma conexão nova a cada reload abriria um pool novo; depois de alguns minutos editando arquivos o banco recusaria conexões |

A regra por trás: **instância de Fastify é barata de recriar** (não segura socket nem pool),
**conexão de banco não é**.

Trocar isso produz um bug traiçoeiro: com o Fastify em `globalThis`, o servidor continua servindo as
rotas antigas depois de você editá-las, e o stack trace mostra o código-fonte novo — parece que a
mudança não fez efeito, quando na verdade ela nunca foi carregada.

Os dois caches também limpam a promise em caso de rejeição. Sem isso, uma falha no boot ficaria
cacheada e toda requisição seguinte repetiria o erro original, mesmo depois do código corrigido.

## `serverExternalPackages`

`next.config.ts` lista Fastify, Mongoose e afins como pacotes externos. Não é otimização: sem isso o
Turbopack reescreve o `__dirname` do `@fastify/swagger-ui` e ele procura seus assets estáticos num
caminho que não existe, derrubando toda a API com `ENOENT`.

Qualquer pacote de servidor que leia arquivos do próprio diretório precisa entrar nessa lista.

## Zod como fonte de verdade

`src/server/schemas/publication.ts` define o domínio uma vez, e daí sai:

- a validação do corpo e da query nas rotas Fastify
- a serialização da resposta
- o tipo TypeScript (`z.infer`)
- o documento OpenAPI em `/api/docs`
- a validação dos `searchParams` na página
- o portão de escrita do importador e do seed

O model Mongoose é tipado com `z.infer<typeof PublicationCore>`, de forma que uma divergência entre
os dois vira erro de compilação em vez de erro em runtime. O raciocínio completo está em
[adr/0002-mongoose-mais-zod.md](adr/0002-mongoose-mais-zod.md).
