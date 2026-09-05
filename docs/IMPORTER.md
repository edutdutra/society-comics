# Importador da Panini

Coleta metadados do catálogo público da Panini Brasil e os converte para o modelo do projeto.

```bash
pnpm import:panini --dry-run --limit=5      # sempre comece assim
pnpm import:panini --category=dc --limit=100
pnpm import:panini --refresh                # ignora o cache em disco
```

> **Estado atual:** o importador rodou um dry-run bem-sucedido contra o site (6 produtos, 0 falhas).
> Depois disso foram feitas correções — volume vindo do título em vez da coleção, preservação de
> siglas como `DC`/`LJA`, e entradas sem ano — que **ainda não foram executadas**. Rodar o dry-run e
> conferir a saída é o primeiro passo antes de qualquer importação em escala.

## Regras de convivência

Estas regras estão no código, não só neste documento.

- **Rate limit de 1 req/s** (`IMPORTER_DELAY_MS`). Não baixe desse valor.
- **User-Agent honesto** (`IMPORTER_USER_AGENT`), identificando o projeto e um contato — em vez de
  fingir ser um navegador.
- **Cache em disco** em `.cache/panini/`. Durante o desenvolvimento do parser você roda a
  importação dezenas de vezes; sem cache cada rodada seria um novo crawl completo. O `.cache/` é
  ignorado pelo git: é conteúdo de terceiros e não deve ser redistribuído.
- **Sem navegação facetada.** O `robots.txt` da Panini bloqueia os parâmetros `collection=`,
  `author=`, `month=` e `year=`. Paginamos a categoria com `?p=`, que é permitido.
- **Capas são referenciadas, não copiadas.** Guardamos a URL de origem; o arquivo permanece no
  servidor deles.
- **Nada vai direto ao ar.** Todo item importado nasce com `reviewStatus: "pending"`.

## Como os dados são extraídos

A página de produto é Magento 2, renderizada no servidor — sem necessidade de navegador headless.
**Não há JSON-LD**, então os dados saem da tabela de atributos.

O detalhe que importa: o rótulo de cada linha fica num atributo `data-th` do próprio `<td>`, não num
`<th>`:

```html
<td class="col data" data-th="Referência">ASMGJ004</td>
<td class="col data" data-th="Conteúdo original"><p><i>Action Comics (1938) 855-857</i></p></td>
```

Por isso mapeamos **por rótulo, nunca por posição**: a Panini adiciona e remove linhas conforme o
produto, e indexar por posição quebraria em silêncio.

### Rótulos observados (2026-09)

| Rótulo na página | Campo do domínio |
|---|---|
| `Referência` | `sku` |
| `Autores` | `creators[]` |
| `Ano de publicação` + `Mês` | `releasedAt` |
| `Quantidade de páginas` | `pages` |
| `Encadernação` | `format` |
| `Coleção` | `line` (⚠ **não** o volume — ver [DATA-MODEL.md](DATA-MODEL.md#armadilha-o-atributo-coleção-não-diz-o-volume)) |
| `Classificação etária` | `ageRating` |
| `Tipo de publicação` | complementa `format` |
| **`Conteúdo original`** | `originalContents[]` |

Fora da tabela: `h1` → título, `meta[itemprop="price"]` → preço,
`meta[property="og:image"]` → capa (CloudFront, com sufixo de tamanho `-S265-F` trocado por
`-S800-F`), `[itemprop="sku"]` → SKU.

## A gramática de "Conteúdo original"

Este é o campo mais valioso do importador: é ele que diz quais edições americanas foram compiladas
no volume brasileiro.

```
entrada   := parte (";" parte)*
parte     := série [qualificador] "(" ano ")" faixa?
faixa     := número ("-" número)? ("," faixa)*
```

Exemplo real:

```
Action Comics (1938) 855-857; Action Comics Annual (1987) 10
```

vira:

```js
[
  { raw: "Action Comics (1938) 855-857", series: "Action Comics",
    volumeYear: 1938, issues: [855, 856, 857] },
  { raw: "Action Comics Annual (1987) 10", series: "Action Comics",
    qualifier: "Annual", volumeYear: 1987, issues: [10] },
]
```

**Princípio de projeto: nunca perder dado.** Toda parte vira uma entrada com `raw` preenchido; os
campos estruturados só aparecem quando o parser tem certeza. Quando ele encontra um formato novo,
sobra a string crua — e o CLI marca essas com `[cru]` no dry-run, para você notar.

Casos já tratados: faixas invertidas ou absurdas são descartadas (mantendo o `raw`); en dash e em
dash além do hífen comum; entradas **sem ano** (`Batman: Dark Patterns 7-12`, `JLA/Avengers 3`) via
um segundo padrão.

Implementação em
[`importers/panini/conteudo-original.ts`](../src/server/importers/panini/conteudo-original.ts).

## Idempotência

O upsert usa `sku` como chave, com fallback em `slug`. Rodar o importador duas vezes **atualiza** os
mesmos documentos em vez de duplicar o catálogo.

`reviewStatus` fica fora do `$set` (vai em `$setOnInsert`) para que uma reimportação não rebaixe
para `pending` algo que você já aprovou.

## Estrutura

```
importers/
  http.ts                 fetch com cache em disco e rate limit
  load-env.ts             carrega .env.local (side effect, importar primeiro)
  run.ts                  CLI
  panini/
    discover.ts           paginação da categoria
    parse.ts              extração do HTML (por rótulo)
    conteudo-original.ts  o parser da gramática acima
    map.ts                cru → domínio, validado pelo Zod
```

`map.ts` termina em `PublicationInput.parse(candidate)` — o portão único de escrita. Se o parse
mudar e produzir algo inválido, falha ali e não no banco.
