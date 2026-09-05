import mongoose from "mongoose";

import { env } from "./env";

/**
 * O HMR do Next reavalia os módulos a cada edição. Sem cache global, cada
 * reload abriria um novo pool de conexões e o Mongo acabaria recusando
 * conexões depois de alguns minutos editando arquivos. O cache vive no
 * globalThis justamente porque ele sobrevive à reavaliação de módulo.
 */
type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalForMongoose = globalThis as typeof globalThis & {
  __societyComicsMongoose?: MongooseCache;
};

const cache: MongooseCache = (globalForMongoose.__societyComicsMongoose ??= {
  conn: null,
  promise: null,
});

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;

  cache.promise ??= mongoose.connect(env.MONGODB_URI, {
    // Falha rápido quando o banco não responde, em vez de deixar a requisição
    // pendurada pelos 30s do padrão. 10s e não 5s porque o alvo é o Atlas, que
    // tem latência de rede real e handshake TLS — 5s foi calibrado para
    // localhost e daria falso negativo aqui.
    serverSelectionTimeoutMS: 10_000,
    maxPoolSize: 10,
  });

  try {
    cache.conn = await cache.promise;
  } catch (error) {
    // Zera a promise para que a próxima requisição tente de novo em vez de
    // reaproveitar eternamente uma promise já rejeitada.
    cache.promise = null;
    throw error;
  }

  return cache.conn;
}

export type ConnectionState = "disconnected" | "connected" | "connecting" | "disconnecting";

export function connectionState(): ConnectionState {
  // readyState também pode ser 99 ("uninitialized"), fora do intervalo 0..3,
  // por isso o lookup por Record em vez de índice de tupla.
  const states: Record<number, ConnectionState> = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };
  return states[mongoose.connection.readyState] ?? "disconnected";
}
