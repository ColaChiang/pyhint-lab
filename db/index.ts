import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

type BindingScope = typeof globalThis & { __PYHINT_DB__?: D1Database };

export function getDb() {
  const binding = (globalThis as BindingScope).__PYHINT_DB__;
  if (!binding) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Check the D1 declaration and worker binding injection."
    );
  }
  return drizzle(binding, { schema });
}
