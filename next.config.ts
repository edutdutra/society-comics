import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Mantém o servidor Fastify e o Mongoose fora do bundle do servidor.
   *
   * Sem isso, o Turbopack reescreve `__dirname` nesses pacotes e o
   * @fastify/swagger-ui passa a procurar seus assets estáticos num caminho
   * inexistente (E:\ROOT\node_modules\...), derrubando toda a API com ENOENT.
   * Como pacotes externos, eles são carregados por require() normal em runtime.
   */
  serverExternalPackages: [
    "fastify",
    "fastify-plugin",
    "fastify-type-provider-zod",
    "@fastify/swagger",
    "@fastify/swagger-ui",
    "mongoose",
    "mongodb",
  ],

  images: {
    remotePatterns: [
      // As capas NÃO são servidas por panini.com.br: a og:image aponta para o
      // CloudFront deles (verificado em superman-por-geoff-johns-vol-04).
      // Referenciamos a URL de origem, nunca copiamos o arquivo — ver a seção
      // de direitos em docs/IMPORTER.md.
      { protocol: "https", hostname: "d14d9vp3wdof84.cloudfront.net" },
      { protocol: "https", hostname: "**.cloudfront.net" },
      { protocol: "https", hostname: "panini.com.br" },
    ],
  },
};

export default nextConfig;
