---
name: add-api-route
description: Adiciona um endpoint à API Fastify do projeto. Use quando pedirem uma rota, endpoint ou recurso novo na API (listar, criar, atualizar, remover algo). Cobre schema Zod, repositório, rota tipada e registro.
---

# Adicionando uma rota à API

**Rotas novas nunca vão em `src/app/api/`.** Aquela pasta tem uma única rota catch-all que repassa
tudo ao Fastify. Criar outro Route Handler ali quebra o desenho descrito em `docs/ARCHITECTURE.md`.

O caminho tem quatro passos, nesta ordem.

## 1. Schema em `src/server/schemas/`

Zod, sempre. É daqui que saem a validação, o tipo TypeScript, a serialização da resposta e a
documentação OpenAPI — uma definição só.

```ts
export const CoisaInput = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug deve ser kebab-case"),
  nome: z.string().min(1),
});
export type CoisaInput = z.infer<typeof CoisaInput>;
```

Mensagens de erro em português: elas chegam ao cliente.

## 2. Repositório em `src/server/repositories/`

Todo acesso ao banco passa por aqui — as rotas **e** as páginas Server Component usam a mesma
camada. Comece com `await connectToDatabase()`, use `.lean()` na leitura e converta `_id` para `id`.

Veja `repositories/publications.ts` como referência; `toPublication` e `upsertPublication` são os
padrões a copiar.

## 3. Rota em `src/server/routes/`

```ts
import type { RouteModule } from "../types";

const coisaRoutes: RouteModule = async (app) => {
  app.get(
    "/coisas/:id",
    {
      schema: {
        tags: ["coisas"],
        summary: "Frase curta — vira o título no Swagger",
        params: IdParams,
        response: { 200: Coisa, 404: ErrorResponse },
      },
    },
    async (request, reply) => {
      // request.params.id já vem tipado do schema
    },
  );
};

export default coisaRoutes;
```

`RouteModule` é o que dispensa generics e casts. **Sempre declare o schema de resposta** — sem ele
não há serialização validada nem entrada no Swagger.

A função é `async` mesmo sem `await`: é contrato do Fastify, e a regra `require-await` já está
desligada para essa pasta.

## 4. Registrar em `src/server/app.ts`

Dentro do bloco com `prefix: "/api"`:

```ts
await api.register(coisaRoutes);
```

## Não trate erro na rota

O handler único em `plugins/errors.ts` já converte chave duplicada em 409, falha de validação em
400, banco fora em 503. Deixe o erro subir.

## Verificar

```bash
pnpm check
curl "http://localhost:3000/api/coisas/abc"
```

E confira se a rota apareceu em `http://localhost:3000/api/docs`.
