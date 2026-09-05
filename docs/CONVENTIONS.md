# Convenções

## Estrutura de pastas

```
src/app/                    rotas do Next (páginas)
src/app/api/[[...slug]]/    ÚNICA rota de API — repassa tudo ao Fastify
src/components/             composições do projeto
src/components/ui/          gerado pelo shadcn — NÃO editar
src/lib/                    utilitários de cliente (cn, formatadores)
src/server/                 tudo que só roda no servidor
```

## Adicionando uma rota de API

Rotas novas **não** vão em `src/app/api/`. A rota catch-all já repassa tudo. O caminho é:

1. **Schema** em `src/server/schemas/` — Zod, sempre. É o que vira validação, tipo e OpenAPI.
2. **Repositório** em `src/server/repositories/` — todo acesso ao banco passa por aqui, para que
   páginas e rotas compartilhem a mesma camada.
3. **Rota** em `src/server/routes/`, tipada com `RouteModule`:

```ts
import type { RouteModule } from "../types";

const minhasRotas: RouteModule = async (app) => {
  app.get(
    "/coisas/:id",
    {
      schema: {
        tags: ["coisas"],
        summary: "Descrição curta",
        params: IdParams,
        response: { 200: Coisa, 404: ErrorResponse },
      },
    },
    async (request, reply) => {
      // request.params.id já vem tipado a partir do schema
    },
  );
};

export default minhasRotas;
```

4. **Registrar** em `src/server/app.ts`, dentro do bloco com `prefix: "/api"`.

`RouteModule` é o que faz `request.body`, `request.query` e `request.params` chegarem tipados do
schema, sem generics manuais e sem cast.

## Erros

Não trate erro na rota. O handler único em `src/server/plugins/errors.ts` já converte:

| Situação | Resposta |
|---|---|
| Payload fora do schema Zod | 400 `ValidationError`, com `details[]` |
| Chave duplicada no Mongo | 409 `DuplicateKey` |
| Validação do Mongoose | 400 `ValidationError` |
| Banco inacessível | 503 `DatabaseUnavailable` |
| Qualquer outra | 500, sem vazar a mensagem interna |

Formato sempre `{ error, message, details? }`.

## Componentes

- Server Component é o padrão. `"use client"` só quando houver estado, efeito ou evento.
- Server Components chamam o **repositório direto**, nunca `fetch` para a própria API.
- Estado de filtro e paginação mora na **URL**, não em memória — resultado compartilhável, sobrevive
  ao refresh e o botão voltar funciona.
- `src/components/ui/` é gerado pelo `shadcn add`; para customizar, componha por cima em
  `src/components/`.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/), validados pelo hook `commit-msg`
(commitlint). Mensagem fora do padrão é recusada.

```
<tipo>(<escopo>): <descrição em minúscula, imperativo>
```

**Tipos:** `feat` `fix` `docs` `chore` `refactor` `test` `perf` `build` `ci` `style` `revert`

**Escopos:** `api` `importer` `ui` `db` `docs` `deps` `config`

```
feat(api): adiciona filtro por classificação etária
fix(importer): corrige volume lido da coleção em vez do título
chore(deps): atualiza mongoose para 9.9
docs: documenta a gramática de conteúdo original
```

## Antes de commitar

```bash
pnpm check     # lint + typecheck + format:check
```

## Nomes

- Arquivos de componente em `kebab-case.tsx`; o componente exportado em `PascalCase`
- Arquivos de servidor em `kebab-case.ts`, exceto models, que usam `PascalCase.ts`
- Comentários e mensagens de erro em português; identificadores em inglês
- Comentário explica **por quê**, não o quê — se o código não é óbvio, o comentário diz a razão
