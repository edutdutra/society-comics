---
name: db
description: Operações no MongoDB Atlas do projeto — popular dados, sincronizar índices, diagnosticar falha de conexão, inspecionar a coleção. Use quando pedirem para semear o banco, criar índices, ou quando a aplicação não conectar.
---

# Banco de dados

MongoDB Atlas via Mongoose. Conexão em `MONGODB_URI` no `.env.local` (nunca commitado).

```bash
pnpm db:seed       # popula o catálogo de exemplo — idempotente, pode rodar quantas vezes quiser
pnpm db:indexes    # cria/sincroniza os índices
```

## Diagnosticando falha de conexão

Sintoma: `MongooseServerSelectionError`, ou `/api/health` devolvendo
`{"status":"degraded","db":"disconnected"}` com HTTP 503.

Verifique nesta ordem — quase sempre é uma das três:

1. **IP não liberado** no Atlas → Network Access. Em desenvolvimento, `0.0.0.0/0` resolve.
2. **Nome do banco faltando** no path da URI. Sem `/society-comics`, o Mongoose grava no banco
   `test` e você vê uma coleção vazia sem entender por quê.
3. **Senha com caractere especial** não escapado — `@`, `:`, `/` e `#` precisam de percent-encoding.

Teste rápido:

```bash
curl http://localhost:3000/api/health
```

**Nunca imprima a `MONGODB_URI`** ao diagnosticar: ela contém a senha. Verifique host e nome do
banco, não a string inteira.

## Sobre os índices

`pnpm db:indexes` chama `syncIndexes()` explicitamente porque o `autoIndex` do Mongoose não é
confiável: cria em background no boot, sem garantia de ter terminado, e com várias instâncias todas
disputam a criação.

**`syncIndexes()` também remove** índices que não estão mais no schema. Rode com consciência.

Os índices declarados estão em `models/Publication.ts`; o porquê de cada um, em `docs/DATA-MODEL.md`.

## Sobre o seed

`scripts/seed-data.ts` tem ~12 volumes reais da Panini DC. Usa o mesmo `upsertPublication` do
importador, então é idempotente pelo SKU: rodar duas vezes atualiza em vez de duplicar. **Não apaga
nada** — convive com dados importados.

Para conferir a idempotência: rode duas vezes e veja que o total não muda.

## Mudando um campo do modelo

O Zod é a fonte de verdade. Mude `schemas/publication.ts` primeiro; o TypeScript vai acusar
`models/Publication.ts` fora de sincronia, porque o Schema é tipado com `z.infer` do Zod. Depois
atualize `docs/DATA-MODEL.md`.

Se o campo for indexado, rode `pnpm db:indexes` no fim.

## Armadilha

Não importe `MongoServerError` de `"mongodb"` — o Mongoose traz a própria cópia do driver e o
`instanceof` falha em silêncio. Use `mongoose.mongo`. Ver `docs/adr/0002-mongoose-mais-zod.md`.
