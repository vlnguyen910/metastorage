import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "../../src/schema";

export async function createTestDatabase(adminUrl: string) {
  const url = new URL(adminUrl);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
  const name = `storex_unit_types_test_${randomUUID().replaceAll("-", "")}`;
  const admin = postgres(adminUrl, { max: 1, connect_timeout: 3 });
  let client: ReturnType<typeof postgres> | undefined;
  let created = false;
  const close = async () => {
    if (client) await client.end();
    if (created) await admin.unsafe(`DROP DATABASE "${name}"`);
    await admin.end();
  };
  try {
    await admin.unsafe(`CREATE DATABASE "${name}"`);
    created = true;
    url.pathname = `/${name}`;
    client = postgres(url.toString(), { max: 5, connect_timeout: 3 });
    const db = drizzle(client, { schema, casing: "snake_case" });
    await migrate(db, { migrationsFolder: new URL("../../drizzle", import.meta.url).pathname });
    return { db, close };
  } catch (error) {
    await close();
    throw error;
  }
}
