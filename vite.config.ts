import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const apiPort = process.env.TASTE_API_PORT ?? process.env.PORT ?? "3002";

function normalizePublicUrl(value: string | undefined): string {
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.href.replace(/\/$/, "");
  } catch {
    throw new Error("VITE_PUBLIC_URL must be a valid absolute URL");
  }
}

function publicHtmlPlugin(publicUrl: string) {
  const ogImage = publicUrl ? `${publicUrl}/og.png` : "/og.png";
  const ogUrlTag = publicUrl
    ? `<meta property="og:url" content="${publicUrl}" />`
    : "";

  return {
    name: "taste-public-html",
    transformIndexHtml(html: string) {
      return html
        .replace("<!--PUBLIC_OG_URL-->", ogUrlTag)
        .replaceAll("__PUBLIC_OG_IMAGE__", ogImage);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const publicUrl = normalizePublicUrl(env.VITE_PUBLIC_URL);

  return {
    plugins: [publicHtmlPlugin(publicUrl), react(), tailwindcss()],
    server: {
      proxy: {
        "/api": `http://localhost:${apiPort}`,
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("framer-motion")) return "framer-motion";
          },
        },
      },
    },
  };
});
