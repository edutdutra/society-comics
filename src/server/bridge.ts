import type { InjectOptions, LightMyRequestResponse } from "fastify";

import { getFastify } from "./app";

/**
 * Conversão entre o mundo Web (Request/Response, que é o que o Route Handler
 * do Next entrega) e o `fastify.inject()`, que fala o formato do
 * light-my-request. Nada trafega por socket: o Fastify processa a requisição
 * em memória, no mesmo processo do Next.
 *
 * O que se perde nesse desenho está registrado em
 * docs/adr/0001-fastify-dentro-do-next.md — resumindo: a resposta é bufferizada
 * (sem streaming real) e não há upgrade para WebSocket.
 */

/** Cabeçalhos que descrevem o corpo do inject e não valem para a Response. */
const HOP_BY_HOP = new Set([
  "content-length",
  "content-encoding",
  "transfer-encoding",
  "connection",
]);

async function toInjectOptions(request: Request): Promise<InjectOptions> {
  const url = new URL(request.url);

  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  // GET/HEAD não têm corpo; ler arrayBuffer neles é desperdício.
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const payload = hasBody ? Buffer.from(await request.arrayBuffer()) : undefined;

  return {
    method: request.method as InjectOptions["method"],
    url: url.pathname + url.search,
    headers,
    payload,
  };
}

function toWebResponse(injected: LightMyRequestResponse): Response {
  const headers = new Headers();

  for (const [key, value] of Object.entries(injected.headers)) {
    if (value === undefined || HOP_BY_HOP.has(key.toLowerCase())) continue;

    // set-cookie chega como array quando há mais de um cookie. Passar o array
    // direto para o Headers viraria uma string única com vírgulas e quebraria
    // os cookies — por isso o append um a um.
    if (Array.isArray(value)) {
      for (const entry of value) headers.append(key, String(entry));
    } else {
      headers.set(key, String(value));
    }
  }

  // 204/304 não podem ter corpo. O rawPayload é um Buffer do Node, cujo
  // `buffer` é ArrayBufferLike; o BodyInit da Web exige ArrayBuffer, daí a
  // cópia para Uint8Array.
  const body =
    injected.statusCode === 204 || injected.statusCode === 304
      ? null
      : new Uint8Array(injected.rawPayload);

  return new Response(body, {
    status: injected.statusCode,
    statusText: injected.statusMessage,
    headers,
  });
}

export async function handleWithFastify(request: Request): Promise<Response> {
  const app = await getFastify();
  const injected = await app.inject(await toInjectOptions(request));
  return toWebResponse(injected);
}
