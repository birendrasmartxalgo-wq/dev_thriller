// Apply Atlas Search indexes from JSON configs.
//
// Two paths, picked automatically:
//
//   1. Atlas Admin API (preferred): requires ATLAS_PUBLIC_KEY, ATLAS_PRIVATE_KEY,
//      ATLAS_GROUP_ID (project id), ATLAS_CLUSTER_NAME env vars. Uses HTTP Digest
//      auth to POST/PATCH /groups/{groupId}/clusters/{clusterName}/fts/indexes.
//
//   2. Driver-based fallback: if running against MongoDB ≥ 7.0 Atlas, falls back
//      to `db.command({ createSearchIndexes: ... })`. On a local mongod (no Atlas
//      Search), logs a warning and exits 0 — the $search code path already has
//      a $text fallback in search/routes.ts.
//
// Usage:   bun run apps/backend/src/scripts/apply-search-indexes.ts

import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { connectMongo, db } from "@/db/mongo";
import { logger } from "@/lib/logger";
import { env } from "@/config/env";

const here = dirname(fileURLToPath(import.meta.url));
const CONFIGS_DIR = resolve(here, "..", "search", "atlas");

interface AtlasIndexConfig {
  name: string;
  database: string;
  collectionName: string;
  mappings: Record<string, unknown>;
}

function loadConfigs(): AtlasIndexConfig[] {
  return readdirSync(CONFIGS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(CONFIGS_DIR, f), "utf8")) as AtlasIndexConfig);
}

async function viaAdminApi(configs: AtlasIndexConfig[]) {
  const pub = process.env.ATLAS_PUBLIC_KEY!;
  const priv = process.env.ATLAS_PRIVATE_KEY!;
  const groupId = process.env.ATLAS_GROUP_ID!;
  const cluster = process.env.ATLAS_CLUSTER_NAME!;
  // Atlas Admin API uses HTTP Digest auth. Bun's fetch doesn't handle it natively;
  // we implement it manually by first getting a 401 with the nonce, then replaying.
  const base = `https://cloud.mongodb.com/api/atlas/v1.0/groups/${groupId}/clusters/${cluster}/fts/indexes`;
  for (const cfg of configs) {
    const body = JSON.stringify(cfg);
    const first = await fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body });
    if (first.status !== 401) {
      if (first.ok) {
        logger.info({ name: cfg.name }, "atlas-search index created (no-auth)");
        continue;
      }
      throw new Error(`unexpected ${first.status}: ${await first.text()}`);
    }
    const wa = first.headers.get("www-authenticate") ?? "";
    const challenge = Object.fromEntries(
      wa
        .replace(/^Digest\s+/, "")
        .split(",")
        .map((p) => p.trim().match(/^(\w+)=("?)([^"]+)\2$/))
        .filter(Boolean)
        .map((m) => [m![1]!, m![3]!])
    ) as Record<string, string>;
    const realm = challenge.realm!;
    const nonce = challenge.nonce!;
    const qop = challenge.qop ?? "auth";
    const opaque = challenge.opaque;
    const uri = new URL(base).pathname;
    const hasher = new Bun.CryptoHasher("md5");
    const md5 = (s: string) => new Bun.CryptoHasher("md5").update(s).digest("hex");
    const ha1 = md5(`${pub}:${realm}:${priv}`);
    const ha2 = md5(`POST:${uri}`);
    const nc = "00000001";
    const cnonce = Math.random().toString(16).slice(2, 10);
    const resp = md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`);
    const auth = [
      `Digest username="${pub}"`,
      `realm="${realm}"`,
      `nonce="${nonce}"`,
      `uri="${uri}"`,
      `qop=${qop}`,
      `nc=${nc}`,
      `cnonce="${cnonce}"`,
      `response="${resp}"`,
      opaque ? `opaque="${opaque}"` : "",
    ]
      .filter(Boolean)
      .join(", ");
    const r = await fetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: auth },
      body,
    });
    void hasher;
    if (!r.ok) {
      const txt = await r.text();
      if (/already\s+exists/i.test(txt) || r.status === 409) {
        logger.info({ name: cfg.name }, "atlas-search index already exists; leaving as-is");
      } else {
        throw new Error(`atlas-search ${cfg.name}: ${r.status} ${txt}`);
      }
    } else {
      logger.info({ name: cfg.name }, "atlas-search index created");
    }
  }
}

async function viaDriverFallback(configs: AtlasIndexConfig[]) {
  const database = db();
  for (const cfg of configs) {
    try {
      await database.command({
        createSearchIndexes: cfg.collectionName,
        indexes: [{ name: cfg.name, definition: cfg.mappings }],
      });
      logger.info({ name: cfg.name }, "search index created via driver");
    } catch (err) {
      const msg = String((err as Error).message ?? err);
      if (/already\s*exists/i.test(msg)) {
        logger.info({ name: cfg.name }, "search index already exists");
      } else if (/CommandNotFound|createSearchIndexes|not supported/i.test(msg)) {
        logger.warn(
          { name: cfg.name },
          "local mongod doesn't support Atlas Search — routes fall back to $text. Apply on Atlas instead."
        );
      } else {
        throw err;
      }
    }
  }
}

async function main() {
  const configs = loadConfigs();
  if (configs.length === 0) {
    logger.warn("no Atlas Search configs found");
    return;
  }
  await connectMongo();
  const hasAtlasCreds =
    process.env.ATLAS_PUBLIC_KEY &&
    process.env.ATLAS_PRIVATE_KEY &&
    process.env.ATLAS_GROUP_ID &&
    process.env.ATLAS_CLUSTER_NAME;
  if (hasAtlasCreds) {
    logger.info("applying via Atlas Admin API");
    await viaAdminApi(configs);
  } else {
    logger.info({ env: env.NODE_ENV }, "no Atlas Admin creds; trying driver fallback");
    await viaDriverFallback(configs);
  }
  process.exit(0);
}

main().catch((err) => {
  logger.error(err, "apply-search-indexes failed");
  process.exit(1);
});
