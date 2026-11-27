import { createHash } from "node:crypto";
import { defineConfig, type Plugin } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

function contentPolicy(): Plugin {
  const hashes = (html: string, tag: "script" | "style") => [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "g"))]
    .map(([, body]) => `'sha256-${createHash("sha256").update(body ?? "").digest("base64")}'`).join(" ");
  return {
    name: "ttk-content-security-policy",
    apply: "build",
    enforce: "post",
    generateBundle: {
      order: "post",
      handler(_options, bundle) {
        const html = bundle["index.html"];
        if (!html || html.type !== "asset" || typeof html.source !== "string") this.error("index.html was not emitted.");
        const source = html.source;
        const policy = [
          "default-src 'none'", `script-src ${hashes(source, "script")}`, `style-src ${hashes(source, "style")} https://fonts.googleapis.com`,
          "img-src data:", "font-src https://fonts.gstatic.com", "connect-src 'self'", "object-src 'none'", "base-uri 'none'", "form-action 'none'",
        ].join("; ");
        html.source = source.replace("<head>", `<head>\n    <meta http-equiv="Content-Security-Policy" content="${policy}">`);
      },
    },
  };
}

export default defineConfig({
  plugins: [viteSingleFile(), contentPolicy()],
  base: "./",
  build: { assetsInlineLimit: 1000000 },
});
