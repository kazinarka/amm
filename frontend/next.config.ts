import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16 uses Turbopack by default. Its vendored buffer polyfill
  // (next/dist/compiled/buffer) lacks BigInt methods like writeBigUInt64LE.
  // Solana instruction builders rely on these, so alias `buffer` to the
  // full-featured buffer@6 package installed in node_modules.
  turbopack: {
    resolveAlias: {
      buffer: { browser: "buffer/" },
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "raw.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "static.jup.ag",
      },
      {
        protocol: "https",
        hostname: "pyth.network",
      },
      {
        protocol: "https",
        hostname: "metadata.jito.network",
      },
      {
        protocol: "https",
        hostname: "cdn.kamino.finance",
      },
      {
        protocol: "https",
        hostname: "wormhole.com",
      },
      {
        protocol: "https",
        hostname: "shdw-drive.genesysgo.net",
      },
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "arweave.net",
      },
      {
        protocol: "https",
        hostname: "ipfs.filebase.io",
      },
      {
        protocol: "https",
        hostname: "**.ipfs.nftstorage.link",
      },
      {
        protocol: "https",
        hostname: "metadata.drift.foundation",
      },
      {
        protocol: "https",
        hostname: "ap-staging.fra1.digitaloceanspaces.com",
      },
      {
        protocol: "https",
        hostname: "424565.fs1.hubspotusercontent-na1.net",
      },
      {
        protocol: "https",
        hostname: "www.circle.com",
      },
    ],
  },
};

export default nextConfig;
