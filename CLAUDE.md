@AGENTS.md

# Society Comics

Catálogo dos quadrinhos publicados no Brasil pela Panini, com foco no material da DC Comics.

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · Tailwind 4 · shadcn/ui (base radix) ·
**Fastify 5 rodando dentro da API interna do Next** · MongoDB Atlas via Mongoose 9 ·
Zod 4 nas bordas HTTP · pnpm.

## Comandos

```bash
pnpm dev              # aplicação em localhost:3000
pnpm check            # lint + typecheck + format:check — rode antes de commitar
pnpm db:seed          # popula o catálogo de exemplo (idempotente)
pnpm db:indexes       # cria/sincroniza os índices no banco
pnpm import:panini --dry-run --limit=5    # importador; SEMPRE dry-run primeiro
```

## Estrutura

```
src/app/api/[[...slug]]/route.ts   única rota do Next; repassa tudo ao Fastify
src/server/
  app.ts          buildFastify() + cache
  bridge.ts       Request web ↔ fastify.inject()
  db.ts           conexão Mongoose
  env.ts          validação do ambiente com Zod
  schemas/        Zod — fonte de verdade do domínio
  models/         Mongoose, tipado a partir do Zod
  repositories/   acesso a dados; usado pelas rotas E pelas páginas
  routes/         rotas Fastify
  plugins/        erros, swagger
  importers/      importador da Panini
  scripts/        seed, índices
src/components/ui/    gerado pelo shadcn — NÃO editar à mão
```

## Regras do projeto

- **Rotas novas** vão em `src/server/routes/`, nunca em `src/app/api/`. A rota catch-all já
  repassa tudo. Ver `docs/CONVENTIONS.md`.
- **Server Components chamam o repositório direto**, sem `fetch` para a própria API.
- **Nunca editar `src/components/ui/`** — é gerado. Composições do projeto ficam em
  `src/components/`.
- **Schema Zod é a fonte de verdade.** Ao mudar um campo, mude `schemas/publication.ts` primeiro;
  o TypeScript vai acusar o model Mongoose fora de sincronia.
- **Importador**: sempre `--dry-run` antes. Respeitar rate limit e não redistribuir conteúdo
  de terceiros. Ver `docs/IMPORTER.md`.
- **Commits seguem Conventional Commits** e são validados pelo hook `commit-msg`.

## Armadilhas já descobertas (não repita)

Todas custaram tempo de depuração. Estão aqui porque nenhuma é óbvia lendo o código.

- **`serverExternalPackages` em `next.config.ts` é obrigatório.** Sem ele o Turbopack reescreve o
  `__dirname` do `@fastify/swagger-ui` e a API inteira cai com `ENOENT` procurando assets em
  `E:\ROOT\node_modules\...`. Ao adicionar qualquer pacote de servidor que leia arquivos do próprio
  diretório, inclua-o nessa lista.
- **O cache do Fastify fica em variável de módulo; o do Mongoose em `globalThis`.** É de propósito:
  a variável de módulo é zerada pelo HMR, então mudanças em rotas e plugins aparecem sem reiniciar.
  Se você mover o Fastify para `globalThis`, o servidor passa a servir rotas antigas até um restart
  manual — e o sintoma engana, porque o código-fonte no stack trace já mostra a versão nova.
- **Não importe `MongoServerError` de `"mongodb"`.** O Mongoose traz a própria cópia do driver e o
  pnpm as mantém separadas; o `instanceof` falha em silêncio e erro de chave duplicada vira 500 em
  vez de 409. Use `mongoose.mongo`.
- **O prefixo do Swagger precisa começar com `/api`** — o catch-all do Next só repassa esse caminho.
- **Mongoose 9 renomeou `FilterQuery` para `QueryFilter`**, e `new: true` virou
  `returnDocument: "after"`.
- **Scripts de CLI precisam importar `load-env` antes de tudo** que alcance `env.ts`: o
  `dotenv/config` padrão lê `.env`, e o projeto usa `.env.local`.
- **Plugins e rotas do Fastify são `async` sem `await`** por contrato da biblioteca. A regra
  `require-await` está desligada para essas pastas no `eslint.config.mjs` — não é await esquecido.
- **`fastify-type-provider-zod` v7 achatou o erro de validação**: use `entry.instancePath` e
  `entry.message`, não `params.issue`.

## Documentação

`docs/ARCHITECTURE.md` · `docs/DATA-MODEL.md` · `docs/DATABASE.md` · `docs/IMPORTER.md` ·
`docs/CONVENTIONS.md` · `docs/ROADMAP.md` · `docs/adr/`
