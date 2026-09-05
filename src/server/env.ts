import { z } from "zod";

/**
 * Validação do ambiente. Roda uma vez, no primeiro import, e falha alto: é
 * melhor o processo morrer no boot do que uma rota devolver 500 na terceira
 * requisição porque MONGODB_URI estava vazia.
 */
const EnvSchema = z.object({
  MONGODB_URI: z.url({ protocol: /^mongodb(\+srv)?$/ }),
  IMPORTER_USER_AGENT: z
    .string()
    .min(1)
    .default("society-comics-importer/0.1 (+https://github.com/)"),
  IMPORTER_DELAY_MS: z.coerce.number().int().min(500).default(1000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type Env = z.infer<typeof EnvSchema>;

function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(raiz)"}: ${issue.message}`)
      .join("\n");

    throw new Error(
      `Variáveis de ambiente inválidas:\n${issues}\n\n` +
        `Copie .env.example para .env.local e preencha os valores.`,
    );
  }

  return parsed.data;
}

export const env = loadEnv();
