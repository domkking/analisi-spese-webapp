import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

/**
 * Content-Security-Policy: niente script/stili inline, niente risorse esterne, niente rete.
 * (GitHub Pages non permette intestazioni HTTP: si usa il tag <meta>.)
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

/** Solo in build: inserisce la CSP e genera il service worker con l'elenco dei file da mettere in cache. */
function securityAndOffline(): Plugin {
  const template = readFileSync(new URL("./scripts/sw.template.js", import.meta.url), "utf8");
  const publicFiles = ["./manifest.webmanifest", "./favicon.svg", "./icon-192.png", "./icon-512.png"];
  return {
    name: "security-and-offline",
    apply: "build",
    enforce: "post",
    transformIndexHtml(html) {
      return html.replace("<!--CSP-->", `<meta http-equiv="Content-Security-Policy" content="${CSP}" />`);
    },
    generateBundle(_options, bundle) {
      const hash = createHash("sha256");
      const files: string[] = ["./"];
      for (const [name, item] of Object.entries(bundle)) {
        files.push(`./${name}`);
        hash.update(name);
        if (item.type === "asset" && name === "index.html") hash.update(String(item.source));
      }
      const source = template
        .replace("__VERSION__", hash.digest("hex").slice(0, 10))
        .replace("__PRECACHE__", JSON.stringify([...files, ...publicFiles]));
      this.emitFile({ type: "asset", fileName: "sw.js", source });
    },
  };
}

export default defineConfig({
  // Percorsi relativi: l'app funziona in qualsiasi sottocartella (GitHub Pages) o dominio.
  base: "./",
  plugins: [react(), securityAndOffline()],
  build: { target: "es2022", sourcemap: false, assetsInlineLimit: 0 },
});
