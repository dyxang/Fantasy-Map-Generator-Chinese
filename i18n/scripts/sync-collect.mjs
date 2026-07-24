// sync-collect.mjs — 合并同步期间的翻译产出到 tm.json
// Usage: node sync-collect.mjs
//
// 输入:
//   i18n/sync-replay-report.json (replay 的 unmatched/ambiguous)
//   i18n/sync-translations.json (AI/subagent 翻译的新增字符串，sidecar 格式)
//   i18n/sync-ambiguous-decisions.json (AMBIGUOUS 复核决策)
//   i18n/tm.json (当前)
//
// 输出:
//   更新 i18n/tm.json
//   更新 i18n/progress.json
//   i18n/sync-collect-report.json

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";

const I18N = join(import.meta.dirname, "..");
const TM_FILE = join(I18N, "tm.json");
const PROGRESS_FILE = join(I18N, "progress.json");
const REPLAY_REPORT = join(I18N, "sync-replay-report.json");
const TRANSLATIONS_FILE = join(I18N, "sync-translations.json");
const AMBIGUOUS_DECISIONS = join(I18N, "sync-ambiguous-decisions.json");
const COLLECT_REPORT = join(I18N, "sync-collect-report.json");

function sha256(text) {
  return "sha256:" + createHash("sha256").update(text, "utf8").digest("hex").slice(0, 16);
}

function readJson(path, fallback = null) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf8"));
}

function main() {
  const tm = readJson(TM_FILE);
  if (!tm) {
    console.error("tm.json 不存在");
    process.exit(1);
  }

  const replayReport = readJson(REPLAY_REPORT, { unmatched: [], ambiguous: [] });
  const translations = readJson(TRANSLATIONS_FILE, { artifacts: [] });
  const ambiguousDecisions = readJson(AMBIGUOUS_DECISIONS, { decisions: [] });

  // 用 (file, source) 索引现有 tm 条目，便于去重和更新
  const tmIndex = new Map();
  for (const e of tm.entries) {
    tmIndex.set(`${e.file}::${e.source}`, e);
  }

  const stats = {
    new_entries: 0,
    updated_targets: 0,
    ambiguous_resolved: 0,
    skipped: 0,
  };

  // 1. 处理 AI/subagent 翻译的新增字符串（sidecar 格式）
  const artifacts = translations.artifacts || translations || [];
  for (const a of artifacts) {
    if (!a.source || !a.target || !a.file) {
      stats.skipped++;
      continue;
    }
    const key = `${a.file}::${a.source}`;
    if (tmIndex.has(key)) {
      // 已存在，更新 target（如果不同）
      const existing = tmIndex.get(key);
      if (existing.target !== a.target) {
        existing.target = a.target;
        stats.updated_targets++;
      }
    } else {
      // 新增条目
      const entry = {
        id: a.id || sha256(a.source + a.file),
        source: a.source,
        target: a.target,
        file: a.file,
        line: a.line_before || a.line || 0,
        type: a.type || "ts_string",
        context_tag: a.context_tag || null,
        skipped: false,
        skip_reason: null,
      };
      tm.entries.push(entry);
      tmIndex.set(key, entry);
      stats.new_entries++;
    }
  }

  // 2. 处理 AMBIGUOUS 决策
  for (const decision of ambiguousDecisions.decisions || []) {
    // decision: { file, source, target }
    if (!decision.file || !decision.source || !decision.target) continue;
    const key = `${decision.file}::${decision.source}`;
    if (tmIndex.has(key)) {
      const existing = tmIndex.get(key);
      if (existing.target !== decision.target) {
        existing.target = decision.target;
        stats.updated_targets++;
      }
    } else {
      // 新增（从全局降级产生的）
      const entry = {
        id: sha256(decision.source + decision.file),
        source: decision.source,
        target: decision.target,
        file: decision.file,
        line: 0,
        type: "ts_string",
        context_tag: null,
        skipped: false,
        skip_reason: null,
      };
      tm.entries.push(entry);
      tmIndex.set(key, entry);
      stats.new_entries++;
    }
    stats.ambiguous_resolved++;
  }

  // 3. 更新 tm.json
  writeFileSync(TM_FILE, JSON.stringify(tm, null, 2));

  // 4. 更新 progress.json（同步会话）
  const progress = readJson(PROGRESS_FILE, { session_history: [] });
  if (!progress.session_history) progress.session_history = [];
  progress.session_history.push({
    date: new Date().toISOString().slice(0, 10),
    type: "sync",
    new_entries: stats.new_entries,
    updated_targets: stats.updated_targets,
    ambiguous_resolved: stats.ambiguous_resolved,
    notes: `Sync collect: +${stats.new_entries} new, ${stats.updated_targets} updated, ${stats.ambiguous_resolved} ambiguous resolved.`,
  });
  writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));

  // 5. 输出 collect 报告
  const report = {
    collected_at: new Date().toISOString(),
    stats,
    total_entries: tm.entries.length,
  };
  writeFileSync(COLLECT_REPORT, JSON.stringify(report, null, 2));

  console.log(`新增条目: ${stats.new_entries}`);
  console.log(`更新 target: ${stats.updated_targets}`);
  console.log(`AMBIGUOUS 决策应用: ${stats.ambiguous_resolved}`);
  console.log(`跳过(无效): ${stats.skipped}`);
  console.log(`tm.json 总条目: ${tm.entries.length}`);
  console.log(`详细报告: ${COLLECT_REPORT}`);
}

main();
