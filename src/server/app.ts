import Fastify, { type FastifyInstance } from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";

import { env } from "./env";
import errorHandler from "./plugins/errors";
import swagger from "./plugins/swagger";
import healthRoutes from "./routes/health";
import publicationRoutes from "./routes/publications";

export async function buildFastify(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      // O Next já imprime uma linha por requisição, e o log de request do
      // Fastify sai em `info` — subir para `warn` em dev evita a duplicata
      // sem perder erro nenhum. `disableRequestLogging` faria o mesmo, mas
      // está deprecado e sai no Fastify 6.
      level: env.NODE_ENV === "development" ? "warn" : env.LOG_LEVEL,
    },
  }).withTypeProvider<ZodTypeProvider>();

  // Faz o Fastify validar e serializar usando os schemas Zod das rotas.
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(errorHandler);
  await app.register(swagger);

  // Prefixo /api registrado aqui: a bridge repassa o pathname inteiro do Next
  // ("/api/publications"), então não há strip de prefixo em lugar nenhum.
  await app.register(
    async (api) => {
      await api.register(healthRoutes);
      await api.register(publicationRoutes);
    },
    { prefix: "/api" },
  );

  await app.ready();
  return app;
}

/**
 * Cache em variável de módulo, deliberadamente NÃO em globalThis.
 *
 * A diferença importa em desenvolvimento: o HMR do Next reavalia este módulo
 * (e reavalia junto tudo que ele importa, ou seja, plugins e rotas) sempre que
 * um desses arquivos muda, e a reavaliação zera esta variável — então a
 * próxima requisição reconstrói o Fastify já com o código novo. Num cache em
 * globalThis a instância sobreviveria à reavaliação e continuaria servindo as
 * rotas antigas até você reiniciar o servidor na mão.
 *
 * A conexão do Mongoose faz o oposto e fica em globalThis de propósito (ver
 * db.ts): lá o que se quer evitar é justamente abrir um pool novo a cada
 * reload. Instância de Fastify não segura socket nem pool, então recriá-la é
 * barato; conexão de banco, não.
 */
let cached: Promise<FastifyInstance> | undefined;

export function getFastify(): Promise<FastifyInstance> {
  // Promise rejeitada não pode ficar no cache: toda requisição seguinte
  // repetiria o erro original mesmo depois de o código ser corrigido.
  return (cached ??= buildFastify().catch((error: unknown) => {
    cached = undefined;
    throw error;
  }));
}
