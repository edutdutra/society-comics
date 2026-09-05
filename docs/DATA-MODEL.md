# Modelo de dados

Fonte de verdade: [`src/server/schemas/publication.ts`](../src/server/schemas/publication.ts).
Este documento explica as decisões; o schema explica os detalhes.

## Uma coleção: `publications`

O catálogo tem **uma** coleção. A entidade central é o **volume publicado no Brasil** — o objeto que
você compra e coloca na estante.

Essa escolha não é óbvia e vale explicar. O instinto seria modelar como o mercado americano faz:
`series` → `issues`, com o encadernado como agrupador. Mas a Panini publica majoritariamente
encadernados que compilam edições americanas, e **o dado que você sempre consegue catalogar por
completo é o volume**, não a edição original. Título, ISBN, formato, páginas, preço e data estão
todos na página do produto; quais edições americanas estão dentro nem sempre.

Se `issues` fosse uma coleção com chave estrangeira obrigatória, todo cadastro travaria por falta de
informação. Em vez disso, o conteúdo original é um **array embutido e tolerante**.

## Campos

| Campo | Notas |
|---|---|
| `slug` | Identidade pública, derivada da URL do produto. Único |
| `sku` | Referência da Panini (`ASMGJ004`). Chave de dedupe do importador. Único e **sparse** — cadastro manual pode não ter |
| `title`, `subtitle`, `synopsis` | |
| `publisher` | `"Panini"` por padrão |
| `universe` | Selo original: `"DC Comics"`, `"Marvel Comics"` |
| `line` | Linha editorial brasileira: `"DC Deluxe"`, `"Lendas do Universo DC"`. Eixo real de navegação do colecionador |
| `volumeNumber` | Extraído do **título**, não do atributo "Coleção" — ver armadilha abaixo |
| `format` | `hardcover` \| `paperback` \| `periodical` \| `omnibus` \| `unknown` |
| `isbn`, `pages`, `priceBRL`, `ageRating` | Todos opcionais |
| `releasedAt` | Derivado de Ano + Mês, fixado no dia 1 — a Panini não publica o dia exato |
| `coverImage` | URL do CloudFront da Panini. **Referenciada**, nunca copiada |
| `originalContents[]` | O array tolerante; ver abaixo |
| `creators[]` | `{ name, role? }`. `role` costuma vir vazio: a Panini lista "Autores" sem separar função, e chutar quem é roteirista seria inventar dado |
| `characters[]` | |
| `source` | `{ name, url, scrapedAt }` — procedência do registro |
| `reviewStatus` | `pending` \| `approved` \| `rejected`. Tudo que o importador traz nasce `pending` |

## `originalContents`: o array tolerante

```ts
{
  raw: "Action Comics (1938) 855-857",   // obrigatório
  series?: "Action Comics",
  volumeYear?: 1938,
  issues?: [855, 856, 857],
  qualifier?: "Annual"
}
```

**Só `raw` é obrigatório.** O parser acerta a maioria dos casos, mas quando encontra um formato novo
ele grava a string crua em vez de perder o dado. Reprocessar depois é rodar o parser de novo sobre
`raw`, sem tocar na rede.

É exatamente onde o modelo de documento ganha do relacional: dado parcialmente conhecido que se
enriquece com o tempo, sem migração.

## Índices

| Índice | Para quê |
|---|---|
| `slug` único | Identidade |
| `sku` único **sparse** | Dedupe do importador; sparse porque nem todo registro tem SKU |
| Texto em `title`, `subtitle`, `synopsis` | Busca. `default_language: "portuguese"` liga stemming e stop words de pt; pesos 10/5/1 |
| `line + volumeNumber` | Navegar uma linha editorial em ordem |
| `releasedAt` desc | Ordenação padrão da listagem |

Criados por `pnpm db:indexes`, nunca por `autoIndex`. O porquê está em [DATABASE.md](DATABASE.md).

## Duplicação Mongoose/Zod

O domínio é definido no Zod e o model Mongoose é tipado com `z.infer<typeof PublicationCore>`.
São dois arquivos descrevendo a mesma coisa — custo assumido conscientemente, com a mitigação de que
o TypeScript acusa a divergência em compilação. Ver
[adr/0002-mongoose-mais-zod.md](adr/0002-mongoose-mais-zod.md).

**Ao mudar um campo, mude o Zod primeiro** e deixe o compilador apontar o resto.

## Armadilha: o atributo "Coleção" não diz o volume

Na página de `superman-por-geoff-johns-vol-04`, o atributo "Coleção" vale
`"SUPERMAN POR GEOFF JOHNS VOL. 01"`. O `VOL. 01` faz parte do **nome da coleção**, não do volume
deste produto — que é o 04.

Ler o volume dali gravava `1` em todos os volumes da série. O número correto vem do título do
produto. Ver `volumeFromTitle` em
[`importers/panini/map.ts`](../src/server/importers/panini/map.ts).
