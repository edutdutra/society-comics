import { config } from "dotenv";

/**
 * Carrega o ambiente para os scripts de CLI.
 *
 * Dentro do `next dev` o Next lê `.env.local` sozinho, mas os scripts rodam
 * via tsx, fora dele. O `dotenv/config` padrão lê só `.env`, então o arquivo
 * que o projeto realmente usa passaria despercebido e o env.ts abortaria
 * reclamando de MONGODB_URI ausente.
 *
 * Precisa ser um módulo separado, importado ANTES de qualquer coisa que
 * alcance `env.ts`: as importações são avaliadas em ordem, e chamar `config()`
 * no topo do run.ts rodaria tarde demais.
 */
config({ path: [".env.local", ".env"], quiet: true });
