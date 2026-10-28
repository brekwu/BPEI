import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function run(source, target) {
  const root = mkdtempSync(join(tmpdir(), "bpei-migration-"));
  try {
    writeFileSync(join(root, "source.json"), JSON.stringify(source));
    writeFileSync(join(root, "target.json"), JSON.stringify(target));
    return spawnSync(process.execPath, [
      "scripts/migration/comparer.mjs",
      join(root, "source.json"),
      join(root, "target.json"),
    ], { encoding: "utf8" });
  } finally { rmSync(root, { recursive: true, force: true }); }
}

const example = [
  { schema: "public", table: "shops", rows: 5 },
  { schema: "auth", table: "users", rows: 6 },
  { schema: "storage", table: "objects", rows: 4 },
];

test("accepts identical row counts for all three schemas", () => {
  const result = run(example, example);
  assert.equal(result.status, 0);
});

test("rejects missing user table", () => {
  const result = run(example, example.filter((row) => row.table !== "users"));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /auth\.users missing/);
});

test("rejects dropped rows even with all tables present", () => {
  const destination = example.map((item) => item.table === "shops" ? { ...item, rows: 4 } : item);
  const result = run(example, destination);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /mismatch/);
});

test("rejects destination extra tables for manual review", () => {
  const result = run(example, [...example, { schema: "public", table: "extra", rows: 0 }]);
  assert.equal(result.status, 1);
});

test("rejects unreadable tables", () => {
  const result = run(example, example.map((v) => v.table === "users" ? { ...v, rows: -1 } : v));
  assert.equal(result.status, 1);
});

test("rejects empty inventory", () => {
  const result = run([], []);
  assert.equal(result.status, 1);
});

test("rejects malformed row count", () => {
  const result = run(example, example.map((v) => ({ ...v, rows: "six" })));
  assert.equal(result.status, 2);
});
