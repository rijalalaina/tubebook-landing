// Which model translates, and how to reach it.
//
// DeepSeek by default: it is what the product's own book translator runs on,
// it is OpenAI-compatible, and at roughly a tenth of the cost it suits a job
// measured in tens of thousands of words. `--provider openai` switches.
//
// ── Where the key comes from ──────────────────────────────────────────────
// This repo holds no secrets and should not start now — it is a public static
// site, and a .env here is one `git add .` away from being published. The key
// is read from the shell, or from the APP repo's .env if it happens to sit
// beside this one. Nothing is ever written back.
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

export function loadEnv(explicit) {
  const paths = explicit
    ? [explicit]
    : [join(HERE, "..", "..", "youtube-ebook-creator", ".env")];
  for (const p of paths) {
    if (!existsSync(p)) continue;
    for (const raw of readFileSync(p, "utf8").split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq < 0) continue;
      const key = line.slice(0, eq).trim();
      const value = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      if (value && !process.env[key]) process.env[key] = value;
    }
    return p;
  }
  return null;
}

export const PROVIDERS = {
  deepseek: {
    url: "https://api.deepseek.com/chat/completions",
    model: "deepseek-chat",
    envKey: "DEEPSEEK_API_KEY",
  },
  openai: {
    url: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4o-mini",
    envKey: "OPENAI_API_KEY",
  },
};

export function pickProvider(name) {
  const wanted = name ?? (process.env.DEEPSEEK_API_KEY ? "deepseek" : "openai");
  const p = PROVIDERS[wanted];
  if (!p) throw new Error(`unknown provider "${wanted}" — use deepseek or openai`);
  const key = process.env[p.envKey];
  if (!key) throw new Error(`${p.envKey} is not set — export it, or pass --env <path to .env>`);
  return { ...p, key, name: wanted };
}

export async function completeJson(provider, system, user, { maxTokens = 8192 } = {}) {
  const res = await fetch(provider.url, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${provider.key}` },
    body: JSON.stringify({
      model: provider.model,
      max_tokens: maxTokens,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 300)}`);
  const body = await res.json();
  const text = body.choices?.[0]?.message?.content ?? "";
  return JSON.parse(text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim());
}
