# Banco de dados

MongoDB Atlas (tier gratuito M0 basta) via Mongoose 9.

## Configuração

Pegue a connection string em **Database → Connect → Drivers** e coloque em `.env.local`:

```
MONGODB_URI=mongodb+srv://USUARIO:SENHA@CLUSTER.mongodb.net/society-comics?retryWrites=true&w=majority
```

`.env.local` é ignorado pelo git. **Nunca** commite a string — ela contém a senha do usuário do
banco.

Depois:

```bash
pnpm db:indexes    # cria os índices — rode uma vez por cluster
pnpm db:seed       # popula o catálogo de exemplo
```

## Problemas comuns

**`MongooseServerSelectionError` no boot**

Quase sempre é uma destas três:

1. **IP não liberado.** Atlas → Network Access → Add IP Address. Em desenvolvimento, `0.0.0.0/0`
   resolve; em produção, restrinja.
2. **Nome do banco faltando na URI.** Sem o `/society-comics` no path, o Mongoose grava no banco
   `test` e você fica olhando uma coleção vazia sem entender.
3. **Senha com caractere especial não escapado.** `@`, `:`, `/` e `#` precisam de percent-encoding
   na URI.

A API devolve **503** nesse caso, não 500 — é infraestrutura, e o cliente pode tentar de novo. Ver
[`plugins/errors.ts`](../src/server/plugins/errors.ts).

**Timeout de conexão**

`serverSelectionTimeoutMS` está em 10s em [`db.ts`](../src/server/db.ts). O valor foi escolhido
para o Atlas: 5s seria suficiente para um Mongo local, mas aqui há latência de rede e handshake TLS,
e daria falso negativo.

## Por que os índices têm script próprio

`pnpm db:indexes` chama `syncIndexes()` explicitamente, e o `autoIndex` do Mongoose fica de fora.

O `autoIndex` cria índices em background no boot da aplicação, sem garantia de ter terminado antes
da primeira consulta — e num ambiente com várias instâncias todas tentam criar os mesmos índices ao
mesmo tempo. Um script explícito torna isso um passo consciente do deploy.

**Atenção:** `syncIndexes()` também **remove** índices que existem no banco mas não estão mais no
schema. Rode com consciência, não em todo deploy automaticamente.

## Conexão e HMR

A conexão fica cacheada em `globalThis` de propósito, para sobreviver à reavaliação de módulos do
HMR. Sem isso, cada arquivo salvo em desenvolvimento abriria um pool novo e o cluster acabaria
recusando conexões. Detalhes em [ARCHITECTURE.md](ARCHITECTURE.md#os-dois-caches-e-por-que-são-diferentes).

## Alternativa local

O projeto já usou Docker Compose com Mongo local. Foi removido em favor do Atlas, mas está no
histórico do git se você quiser trabalhar offline — basta apontar `MONGODB_URI` para
`mongodb://localhost:27017/society-comics`. O código não distingue os dois.
