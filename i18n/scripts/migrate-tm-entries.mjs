// migrate-tm-entries.mjs — 一次性迁移：删除 tm.json 中的 5 个死字段
// 死字段：reviewed / reviewed_by / model / upstream_commit / confidence
// 保留：skipped / skip_reason / reuse_from_tm（有读取）
// Usage: node migrate-tm-entries.mjs

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const I18N = join(import.meta.dirname, "..");
const tmPath = join(I18N, "tm.json");

const tm = JSON.parse(readFileSync(tmPath, "utf8"));
const before = JSON.stringify(tm).length;

const DEAD_FIELDS = ["reviewed", "reviewed_by", "model", "upstream_commit", "confidence"];
let removedCount = 0;

for (const entry of tm.entries) {
  for (const field of DEAD_FIELDS) {
    if (field in entry) {
      delete entry[field];
      removedCount++;
    }
  }
}

const after = JSON.stringify(tm).length;
writeFileSync(tmPath, JSON.stringify(tm, null, 2));

console.log(`Removed ${removedCount} dead field instances across ${tm.entries.length} entries`);
console.log(`Size: ${before} → ${after} bytes (${Math.round((1 - after / before) * 100)}% reduction)`);
