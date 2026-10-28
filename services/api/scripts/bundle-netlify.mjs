/**
 * Bundles the API (src/netlify.ts and everything it uses, including the workspace packages and
 * node_modules) into one self-contained file: netlify/dist/server.mjs. The Netlify Functions in
 * netlify/functions only import that file, so Netlify's own bundler has nothing left to resolve.
 * Runs as part of the Netlify build command (netlify.toml).
 */
import { build } from "esbuild";

await build({
  entryPoints: [new URL("../src/netlify.ts", import.meta.url).pathname],
  outfile: new URL("../netlify/dist/server.mjs", import.meta.url).pathname,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  // Some dependencies (pg, ws) are CommonJS and require() Node built-ins.
  banner: { js: "import { createRequire as __twCreateRequire } from 'node:module'; const require = __twCreateRequire(import.meta.url);" },
  // Optional native add-ons these packages try to load inside try/catch; not available on Netlify.
  external: ["pg-native", "bufferutil", "utf-8-validate"],
  logLevel: "info",
});
