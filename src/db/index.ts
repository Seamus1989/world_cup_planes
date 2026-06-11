import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import * as schema from "./schema";

/**
 * One client, two engines:
 *  - DATABASE_URL set   → Neon Postgres (production / shared dev)
 *  - DATABASE_URL unset → PGlite, an embedded Postgres persisted to ./.pglite
 *
 * The engine is created lazily on first query (never at import/build time) so
 * `next build` and a running dev server don't both spin up PGlite and collide.
 */
const url = process.env.DATABASE_URL;
export const isLocalPglite = !url;

let pglite: PGlite | null = null;
let real: PgliteDatabase<typeof schema> | null = null;

function init(): PgliteDatabase<typeof schema> {
  if (real) return real;
  if (url) {
    real = drizzleNeon(neon(url), { schema }) as unknown as PgliteDatabase<typeof schema>;
  } else {
    pglite = new PGlite(process.env.PGLITE_PATH ?? "./.pglite");
    real = drizzlePglite(pglite, { schema });
  }
  return real;
}

export const db = new Proxy({} as PgliteDatabase<typeof schema>, {
  get(_target, prop) {
    const r = init() as unknown as Record<string | symbol, unknown>;
    const value = r[prop];
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(r) : value;
  },
});

export { schema };

/** The real, initialised db instance (no Proxy) — for libraries like the Auth.js adapter. */
export function rawDb() {
  return init();
}

let migratePromise: Promise<void> | null = null;
export function ensureSchema(): Promise<void> {
  init();
  if (!isLocalPglite || !pglite || !real) return Promise.resolve();
  if (!migratePromise) {
    migratePromise = migratePglite(real, { migrationsFolder: "./drizzle" }).then(() => undefined);
  }
  return migratePromise;
}
