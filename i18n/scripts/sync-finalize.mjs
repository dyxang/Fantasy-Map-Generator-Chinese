// sync-finalize.mjs — 同步收尾：清理 pending、归档 obsolete marks、更新 base_commit
// Usage: node sync-finalize.mjs
//
// 输入:
//   i18n/sync-report.json (文件变化列表)
//   i18n/manual-marks.json (AI 标注的特殊位置)
//   i18n/tm.json (当前)
//   i18n/pending.json (中转区，可选)
//   master HEAD
//
// 输出:
//   更新 i18n/tm.json (删除确实没回来的条目)
//   更新 i18n/manual-marks.json (归档 obsolete marks)
//   更新 i18n/base_commit.txt = master HEAD
//   生成 i18n/sync-summary.md (总结报告)

import { readFileSync, writeFileSync, existsSync } from "fs";
import { execSync } from "child_process";
import { join } from "path";

const I18N = join(import.meta.dirname, "..");
const ROOT = join(I18N, "..");
const TM_FILE = join(I18N, "tm.json");
const PENDING_FILE = join(I18N, "pending.json");
const MANUAL_MARKS_FILE = join(I18N, "manual-marks.json");
const BASE_COMMIT_FILE = join(I18N, "base_commit.txt");
const SYNC_REPORT = join(I18N, "sync-report.json");
const SUMMARY_FILE = join(I18N, "sync-summary.md");

function git(args) {
  return execSync(`git ${args}`, { cwd: ROOT, encoding: "utf8" }).trim();
}

function readJson(path, fallback = null) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf8"));
}

function getMasterHead() {
  return git("rev-parse master");
}

// 检查 source 是否在 master 文件中还存在
function sourceExistsInMaster(file, source) {
  try {
    const content = git(`show master:${file}`);
    return content.includes(source);
  } catch {
    return false; // 文件在 master 不存在
  }
}

function main() {
  const tm = readJson(TM_FILE);
  const pending = readJson(PENDING_FILE, { entries: [] });
  const manualMarks = readJson(MANUAL_MARKS_FILE, { marks: [], archived: [] });
  const syncReport = readJson(SYNC_REPORT, { files: [] });

  const newHead = getMasterHead();
  const stats = {
    tm_removed: 0,
    tm_kept: 0,
    pending_reused: 0,
    pending_removed: 0,
    marks_obsolete: 0,
    marks_kept: 0,
    marks_archived: 0,
  };

  // 1. 处理 pending 中转区：检查 source 是否在新代码中出现
  // 注意：pending.json 现有字段是 pending_units，不是 entries
  const pendingUnits = pending.pending_units || pending.entries || [];
  const newPending = [];
  for (const entry of pendingUnits) {
    if (sourceExistsInMaster(entry.file, entry.source)) {
      // 复用：source 还在，保留条目
      newPending.push(entry);
      stats.pending_reused++;
    } else {
      // 确实没回来，删除
      stats.pending_removed++;
    }
  }
  pending.pending_units = newPending;
  // 清理可能误加的 entries 字段
  delete pending.entries;
  writeFileSync(PENDING_FILE, JSON.stringify(pending, null, 2));

  // 2. 检查 tm.json 中已删除文件的条目（master 删除了文件）
  const deletedFiles = (syncReport.files || [])
    .filter((f) => f.change_type === "deleted")
    .map((f) => f.file);

  if (deletedFiles.length > 0) {
    console.log(`检测到 ${deletedFiles.length} 个上游删除的文件，对应 tm 条目将清理`);
    const before = tm.entries.length;
    tm.entries = tm.entries.filter((e) => {
      if (deletedFiles.includes(e.file)) {
        stats.tm_removed++;
        return false;
      }
      stats.tm_kept++;
      return true;
    });
    console.log(`  清理 ${stats.tm_removed} 条（来自删除的文件）`);
  } else {
    stats.tm_kept = tm.entries.length;
  }
  writeFileSync(TM_FILE, JSON.stringify(tm, null, 2));

  // 3. 处理 manual-marks.json：归档 obsolete 的 mark
  const activeMarks = [];
  for (const mark of manualMarks.marks || []) {
    if (mark.status !== "active") {
      activeMarks.push(mark);
      stats.marks_kept++;
      continue;
    }
    // 检查 source 是否仍在 master 文件中
    if (sourceExistsInMaster(mark.file, mark.source)) {
      activeMarks.push(mark);
      stats.marks_kept++;
    } else {
      // obsolete，移到 archived
      mark.status = "obsolete";
      mark.archived_at = new Date().toISOString();
      if (!manualMarks.archived) manualMarks.archived = [];
      manualMarks.archived.push(mark);
      stats.marks_obsolete++;
      stats.marks_archived++;
    }
  }
  manualMarks.marks = activeMarks;
  writeFileSync(MANUAL_MARKS_FILE, JSON.stringify(manualMarks, null, 2));

  // 4. 更新 base_commit.txt
  const oldBase = readFileSync(BASE_COMMIT_FILE, "utf8").trim();
  writeFileSync(BASE_COMMIT_FILE, newHead + "\n");

  // 5. 生成 sync-summary.md
  const summary = `# Sync Summary

**同步时间**: ${new Date().toISOString()}
**base_commit**: ${oldBase.slice(0, 12)} → ${newHead.slice(0, 12)}

## 文件变化
- 改动文件: ${syncReport.summary?.total_changed_files || 0}
- Lane-A (AI 解 merge 冲突): ${syncReport.summary?.lane_a_count || 0}
- Lane-B (reset + replay): ${syncReport.summary?.lane_b_count || 0}
- 跳过(不需翻译): ${syncReport.summary?.total_skipped || 0}

## TM 清理
- 删除条目(上游删除文件): ${stats.tm_removed}
- 保留条目: ${stats.tm_kept}
- TM 总条目: ${tm.entries.length}

## Pending 中转区
- 复用: ${stats.pending_reused}
- 清理: ${stats.pending_removed}

## Manual Marks
- 保留: ${stats.marks_kept}
- 归档(obsolete): ${stats.marks_obsolete}
`;

  writeFileSync(SUMMARY_FILE, summary);

  console.log("=== Sync Finalize ===");
  console.log(`TM 删除: ${stats.tm_removed}（上游删除文件）`);
  console.log(`TM 保留: ${stats.tm_kept}`);
  console.log(`Pending 复用: ${stats.pending_reused}, 清理: ${stats.pending_removed}`);
  console.log(`Manual marks 保留: ${stats.marks_kept}, 归档: ${stats.marks_obsolete}`);
  console.log(`base_commit 更新: ${oldBase.slice(0, 12)} → ${newHead.slice(0, 12)}`);
  console.log(`总结报告: ${SUMMARY_FILE}`);
}

main();
