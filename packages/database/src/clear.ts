import { getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { queryClient } from "./client";
import * as schema from "./schema";

async function clear() {
  // Schema exports contain application tables only; migration history stays intact.
  const tableNames = Object.values(schema)
    .filter((value) => is(value, PgTable))
    .map((table) => getTableName(table));

  console.log("Clearing all application data, including users and sessions...");
  // One atomic statement handles foreign keys between all application tables.
  await queryClient`TRUNCATE TABLE ${queryClient(tableNames)} RESTART IDENTITY`;
  console.log("Database cleared. Run bun run db:seed to restore test data.");
}

clear()
  .catch((error) => {
    console.error("Database clear failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await queryClient.end();
  });
