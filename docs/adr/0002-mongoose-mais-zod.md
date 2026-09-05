# 0002 — Mongoose para persistência, Zod nas bordas

**Status:** aceito · **Data:** 2026-09

## Contexto

Duas perguntas separadas costumam ser confundidas em uma só:

1. Como validar o que entra e sai pela API?
2. Como falar com o MongoDB?

Zod responde a primeira; Mongoose e o driver nativo respondem a segunda. Elas **não competem no
mesmo eixo** — dá para ter os dois. A pergunta real era se valeria definir o schema de `Publication`
duas vezes.

## Decisão

**Mongoose** na persistência, **Zod** nas bordas HTTP, com o model Mongoose tipado a partir do Zod:

```ts
export type PublicationDoc = z.infer<typeof PublicationCore>;
const PublicationSchema = new Schema<PublicationDoc>({ ... });
```

O Zod é a fonte de verdade. O `Schema<PublicationDoc>` faz o TypeScript comparar as duas definições
em tempo de compilação: se um campo mudar no Zod e não no Mongoose, o build quebra.

## Alternativas consideradas

**Driver nativo + Zod, sem ODM.** Era a recomendação inicial: com `fastify-type-provider-zod`, o
schema Zod já é validação de entrada, serialização de saída, tipo TS e OpenAPI — Mongoose viraria a
terceira definição do mesmo objeto. Ganharia performance e uma peça a menos.

Foi descartada por escolha explícita: Mongoose traz hooks, `timestamps`, validação na persistência e
`populate` prontos, é o padrão do ecossistema Node/Mongo, e a familiaridade da equipe pesa mais aqui
que o overhead.

**Só Mongoose, sem type provider Zod.** Perderia OpenAPI automático e validação de resposta.

## Consequências

**A favor**

- Validação em duas camadas: o payload malformado morre na borda HTTP com 400 e mensagem útil; o
  documento inválido morre na persistência
- `timestamps` automáticos, hooks disponíveis quando precisarmos
- OpenAPI e tipos derivados dos schemas Zod, sem documentação escrita à mão

**Contra**

- **Duas definições do mesmo objeto** para manter em sincronia. É o custo real desta decisão. A
  mitigação (`Schema<z.infer<...>>`) transforma o erro de runtime em erro de compilação, mas não
  elimina o trabalho de editar dois arquivos
- Uma camada a mais entre a aplicação e o driver

## Regra prática

**Ao mudar um campo, mude o Zod primeiro** em
[`schemas/publication.ts`](../../src/server/schemas/publication.ts) e deixe o compilador apontar o
que falta em [`models/Publication.ts`](../../src/server/models/Publication.ts).

[DATA-MODEL.md](../DATA-MODEL.md) é a fonte de verdade humana; o schema Zod é a da máquina.

## Armadilha do pnpm

O Mongoose traz a própria cópia do driver `mongodb` e o pnpm a mantém separada de qualquer `mongodb`
instalado no topo do projeto. Importar `MongoServerError` de `"mongodb"` dá **outra classe**, o
`instanceof` falha em silêncio e um erro de chave duplicada vira 500 em vez de 409.

Use `mongoose.mongo`. O `mongodb` foi removido das dependências diretas justamente para que ninguém
caia nisso de novo.
