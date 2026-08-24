import fs from "node:fs";

const databaseId = process.argv[2];

if (!databaseId || !/^[0-9a-f-]{36}$/i.test(databaseId)) {
  throw new Error("A valid D1 database UUID is required.");
}

const path = "wrangler.jsonc";
const source = fs.readFileSync(path, "utf8");

// Phase 0 uses line comments only. Strip them to obtain valid JSON while
// preserving all active configuration fields before adding the D1 binding.
const json = source
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("//"))
  .join("\n");

const config = JSON.parse(json);

config.d1_databases = [
  {
    binding: "DB",
    database_name: "series-hub-db",
    database_id: databaseId,
    migrations_dir: "migrations"
  }
];

fs.writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`);
console.log(`Configured D1 binding DB -> series-hub-db (${databaseId})`);
