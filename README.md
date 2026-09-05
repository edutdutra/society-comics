# Society Comics

Catálogo dos quadrinhos publicados no Brasil pela Panini, com foco no material da DC Comics.

O que torna este projeto diferente de um CRUD comum é o modelo de dados: no Brasil a Panini publica
sobretudo **encadernados** que compilam várias edições americanas, e a informação de quais edições
estão dentro de cada volume costuma ser difícil de levantar. Aqui o volume brasileiro é a entidade
central, e o conteúdo original é um campo estruturado extraído automaticamente do catálogo da
editora.

## Stack

Next.js 16 · React 19 · Tailwind 4 · shadcn/ui · **Fastify 5 acoplado à API interna do Next** ·
MongoDB Atlas via Mongoose 9 · Zod 4 · pnpm

A API não roda em processo separado: uma rota catch-all do Next repassa as requisições ao Fastify
via `fastify.inject()`, em memória. Um processo, um deploy, e todo o ecossistema de plugins,
schemas e hooks do Fastify disponível. Os detalhes e os limites dessa escolha estão em
[docs/adr/0001-fastify-dentro-do-next.md](docs/adr/0001-fastify-dentro-do-next.md).

## Rodando

Requer Node >= 20.9 (o projeto usa 22.19, veja `.nvmrc`) e uma conta gratuita no
[MongoDB Atlas](https://www.mongodb.com/cloud/atlas).

```bash
pnpm install
cp .env.example .env.local     # preencha MONGODB_URI com sua string do Atlas
pnpm db:indexes                # cria os índices
pnpm db:seed                   # popula o catálogo de exemplo
pnpm dev
```

Abra <http://localhost:3000>. A documentação da API fica em
<http://localhost:3000/api/docs>, gerada automaticamente a partir dos schemas Zod.

Se a conexão falhar, veja [docs/DATABASE.md](docs/DATABASE.md) — quase sempre é o IP não liberado
em Network Access ou o nome do banco faltando no path da URI.

## Comandos

| Comando | O que faz |
|---|---|
| `pnpm dev` | Aplicação em desenvolvimento |
| `pnpm build` | Build de produção |
| `pnpm check` | Lint, typecheck e formatação |
| `pnpm db:seed` | Popula o catálogo de exemplo (idempotente) |
| `pnpm db:indexes` | Cria e sincroniza os índices |
| `pnpm import:panini --dry-run --limit=5` | Importador do catálogo da Panini |

## Documentação

- [Arquitetura](docs/ARCHITECTURE.md) — como Next, Fastify e Mongoose se encaixam
- [Modelo de dados](docs/DATA-MODEL.md) — a coleção `publications` e por que ela é assim
- [Banco de dados](docs/DATABASE.md) — Atlas, índices, problemas comuns
- [Importador](docs/IMPORTER.md) — como os dados são coletados, e sob quais regras
- [Convenções](docs/CONVENTIONS.md) — estrutura, padrões, commits
- [Roadmap](docs/ROADMAP.md) — o que ainda falta

## Sobre os dados

Os metadados são coletados do catálogo público da Panini, respeitando o `robots.txt`, com limite de
uma requisição por segundo e `User-Agent` identificando o projeto. Capas são **referenciadas** pela
URL de origem, nunca copiadas ou redistribuídas. Este é um projeto pessoal de catalogação, sem fim
comercial. Ver [docs/IMPORTER.md](docs/IMPORTER.md).
