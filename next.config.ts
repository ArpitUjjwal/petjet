import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* pdf.js reads uploaded PDFs on the server; it loads its own worker, so it isn't bundled */
  serverExternalPackages: ["pdfjs-dist"],
  experimental: {
    /* Document uploads are up to 10 MB; leave room for multipart overhead */
    serverActions: { bodySizeLimit: "11mb" },
    proxyClientMaxBodySize: "11mb",
  },
  /* PetJet pages are per-user and database-driven, so Cache Components and
     partial prefetching (on by default in the scaffold) are left off. */
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
