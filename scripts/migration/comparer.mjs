#!/usr/bin/env node
// Compare source and restored BPEI inventories without exposing any user rows.
// Usage: node scripts/migration/comparer.mjs source.json destination.json
import { readFileSync } from "node:fs";

function load(filename) {
  const raw = JSON.parse(readFileSync(filename, "utf8"));
  if (!Array.isArray(raw)) throw new Error("Expected an inventory JSON array");
  const tables = new Map();
  for (const value of raw) {
    if (!value || !["public", "auth", "storage"].includes(value.schema) ||
        typeof value.table !== "string" || !/^[a-zA-Z_][a-zA-Z_0-9]*$/.test(value.table) ||
        !Number.isSafeInteger(value.rows) || value.rows < -1) {
      throw new Error("Invalid inventory entry (no personal data is printed)");
    }
    const key = value.schema + "." + value.table;
    if (tables.has(key)) throw new Error("Duplicate table in inventory: " + key);
    tables.set(key, value.rows);
  }
  return tables;
}

function compare(source, target) {
  const differences = [];
  for (const [table, sourceRows] of source) {
    if (!target.has(table)) {
      differences.push(table + " missing on destination");
      continue;
    }
    const targetRows = target.get(table);
    if (sourceRows === -1 || targetRows === -1) {
      differences.push(table + " not readable; cannot verify");
    } else if (sourceRows !== targetRows) {
      differences.push(table + " row count mismatch (source " + sourceRows + ", target " + targetRows + ")");
    }
  }
  for (const [table] of target) {
    if (!source.has(table)) differences.push(table + " is additional in destination; manual review required");
  }
  return differences;
}

try {
  if (process.argv.length !== 4) {
    console.error("Usage: node scripts/migration/comparer.mjs SOURCE.json DESTINATION.json");
    process.exit(2);
  }
  const source = load(process.argv[2]);
  const target = load(process.argv[3]);
  const differences = compare(source, target);
  console.log("Source tables:", source.size, "Destination tables:", target.size);
  if (differences.length) {
    console.error("Migration inventory does not match:");
    for (const difference of differences) console.error(" -", difference);
    console.error("DO NOT SWITCH THE PRODUCTION DOMAIN.");
    process.exit(1);
  }
  if (source.size === 0) {
    console.error("No tables found. Cannot validate migration.");
    process.exit(1);
  }
  console.log("All checked table row counts match. Still verify UUIDs, FK relations, Auth, Storage files, RLS and real login.");
} catch (error) {
  console.error("Inventory comparison failed:", error instanceof Error ? error.message : "unknown error");
  process.exit(2);
}
