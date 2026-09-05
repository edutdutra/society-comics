# Roadmap

## Feito

- Scaffold Next 16, Tailwind 4, shadcn/ui (base radix)
- ESLint flat com regras type-aware, Prettier com ordenação de imports e classes
- Ponte Next ↔ Fastify via `inject`, testada de ponta a ponta
- Modelo `publications` com Zod como fonte de verdade e Mongoose tipado a partir dele
- CRUD completo em `/api/publications`, com OpenAPI automático em `/api/docs`
- Importador do catálogo da Panini, incluindo o parser de "Conteúdo original"
- Seed idempotente e script de índices
- Listagem do catálogo com busca, filtro por linha e paginação
- Documentação e harness de agentes

## Próximo

### Importador em operação

O código está pronto e um dry-run passou, mas as correções feitas depois dele — volume vindo do
título em vez da coleção, preservação de siglas (`DC`, `LJA`), entradas sem ano — **nunca foram
executadas**. Antes de qualquer importação em escala:

1. `pnpm import:panini --dry-run --limit=6` e conferir a saída a olho
2. Verificar as entradas marcadas `[cru]`, que sinalizam formato não reconhecido
3. Só então rodar sem `--dry-run`, com `--limit` crescente

O catálogo DC tem ~1726 produtos em ~144 páginas. A 1 req/s, uma importação completa leva perto de
meia hora — planeje retomada e não rode duas vezes sem necessidade.

### Testes

Vitest, começando pelo parser de "Conteúdo original": é lógica com muitos casos de borda, tem
entrada e saída puras, e é onde um bug silencioso corrompe mais dado. Depois, as rotas — que testam
bem via `fastify.inject()` sem subir servidor.

### Interface

- Página de detalhe `/publication/[slug]` — mostrar o conteúdo original parseado, créditos e ficha
- Painel de revisão para aprovar ou rejeitar o que o importador traz como `pending`
- Filtros por formato, universo e faixa de anos
- Modo escuro (o `next-themes` já veio com o shadcn)

### Infraestrutura

- **Autenticação nas rotas de escrita** — hoje `POST`, `PATCH` e `DELETE` estão abertos. É o item
  mais urgente desta lista se o projeto for para um servidor público
- lint-staged no `pre-commit` (o Husky já está instalado para o commitlint)
- CI no GitHub Actions: lint, typecheck, build e validação das mensagens de commit nos PRs — fecha a
  brecha do `--no-verify`
- Deploy

### Dados

- Importar Marvel e mangá, além de DC — `discover.ts` já tem a categoria Marvel mapeada
- **GCD (comics.org)** como segunda fonte: dumps completos a cada quinze dias, licença CC BY-SA 4.0
  (exige atribuição), com cobertura de edições brasileiras. Útil para preencher o conteúdo original
  onde a Panini não informa
- Normalizar `creators[].role`, hoje sempre vazio porque a Panini não separa função
- Vincular `characters[]` a uma taxonomia, em vez de string livre
