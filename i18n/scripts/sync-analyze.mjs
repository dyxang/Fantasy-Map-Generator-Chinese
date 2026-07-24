// sync-analyze.mjs — 分析 base_commit..master 的文件改动，按 80 行阈值分 lane
// Usage: node sync-analyze.mjs [--threshold N]
// 输出: i18n/sync-report.json + stdout 摘要

import { readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";
import { join, extname } from "path";

const I18N = join(import.meta.dirname, "..");
const ROOT = join(I18N, "..");
const BASE_COMMIT_FILE = join(I18N, "base_commit.txt");
const REPORT_FILE = join(I18N, "sync-report.json");

// 不需要翻译的文件扩展名（图片/字体/媒体/压缩包等）
const IGNORED_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico",
  ".woff", ".woff2", ".ttf", ".eot", ".otf",
  ".mp3", ".mp4", ".webm", ".wav", ".ogg",
  ".pdf", ".zip", ".gz", ".tar",
]);

// 仅分析这些路径下的源码文件（目录前缀 + 根级 main.js）
// 注意：列表混合目录前缀和文件名，startsWith 检查两者都适用
const TRACKED_PREFIXES = ["src/", "ui/", "main.js"];

const LANE_THRESHOLD = parseInt(process.argv.find((_, i, a) => a[i - 1] === "--threshold") || "80", 10);

function git(args) {
  return execSync(`git ${args}`, { cwd: ROOT, encoding: "utf8" }).trim();
}

function getMasterHead() {
  return git("rev-parse master");
}

function getBaseCommit() {
  return readFileSync(BASE_COMMIT_FILE, "utf8").trim();
}

function isTracked(file) {
  return TRACKED_PREFIXES.some((p) => file.startsWith(p));
}

function isIgnored(file) {
  // 通过扩展名过滤（不翻译的文件类型）
  // 用 extname 而非 lastIndexOf('.')，避免无扩展名文件 slice(-1) 取末字符的怪异行为
  const ext = extname(file).toLowerCase();
  if (ext && IGNORED_EXTENSIONS.has(ext)) {
    return true;
  }
  // i18n 目录本身不算
  if (file.startsWith("i18n/")) return true;
  // .trae / .claude / docs 等不算
  if (file.startsWith(".trae/") || file.startsWith(".claude/") || file.startsWith("docs/")) return true;
  return false;
}

function getFileLineCount(commit, file) {
  try {
    const content = git(`show ${commit}:${file}`);
    return content.split("\n").length;
  } catch {
    return 0; // 文件在该 commit 不存在
  }
}

function getChangedLines(base, head, file) {
  // git diff --numstat 输出: added\tdeleted\tfile
  try {
    const out = git(`diff --numstat ${base}..${head} -- "${file}"`);
    if (!out) return { added: 0, deleted: 0 };
    const m = out.match(/^(\d+)\s+(\d+)\s+/);
    if (!m) return { added: 0, deleted: 0 };
    return { added: parseInt(m[1], 10), deleted: parseInt(m[2], 10) };
  } catch {
    return { added: 0, deleted: 0 };
  }
}

function getChangeType(base, head, file) {
  const existsInBase = git(`cat-file -e ${base}:"${file}" 2>/dev/null`) === "";
  const existsInHead = git(`cat-file -e ${head}:"${file}" 2>/dev/null`) === "";
  if (!existsInBase && existsInHead) return "added";
  if (existsInBase && !existsInHead) return "deleted";
  return "modified";
}

function classifyLane(changedLines) {
  return changedLines <= LANE_THRESHOLD ? "lane_a" : "lane_b";
}

function main() {
  const base = getBaseCommit();
  const head = getMasterHead();

  if (base === head) {
    console.log("master 未变化（base_commit == master HEAD），无需同步。");
    writeFileSync(REPORT_FILE, JSON.stringify({
      base_commit: base,
      master_head: head,
      analyzed_at: new Date().toISOString(),
      files: [],
      summary: { lane_a_count: 0, lane_b_count: 0, total_changed_files: 0 },
    }, null, 2));
    return;
  }

  console.log(`base_commit: ${base.slice(0, 12)}`);
  console.log(`master HEAD: ${head.slice(0, 12)}`);
  console.log(`lane 阈值: ${LANE_THRESHOLD} 行`);
  console.log("");

  // 列出 base..head 之间变化的文件
  const changedFilesRaw = git(`diff --name-status ${base}..${head}`);
  if (!changedFilesRaw) {
    console.log("无文件变化。");
    return;
  }

  const files = [];
  const skipped = [];

  for (const line of changedFilesRaw.split("\n")) {
    if (!line.trim()) continue;
    // 格式: A\tpath  或  M\tpath  或  D\tpath  或  R100\told\tnew
    const parts = line.split("\t");
    const status = parts[0][0]; // A/M/D/R
    const file = parts[parts.length - 1];

    if (!isTracked(file)) {
      skipped.push({ file, reason: "not_tracked" });
      continue;
    }
    if (isIgnored(file)) {
      skipped.push({ file, reason: "ignored_extension" });
      continue;
    }

    const totalLines = getFileLineCount(head, file);
    const { added, deleted } = getChangedLines(base, head, file);
    const changedLines = added + deleted;
    const changeType = status === "A" ? "added" : status === "D" ? "deleted" : "modified";
    const lane = classifyLane(changedLines);

    files.push({
      file,
      total_lines: totalLines,
      added_lines: added,
      deleted_lines: deleted,
      changed_lines: changedLines,
      change_type: changeType,
      lane,
    });
  }

  files.sort((a, b) => b.changed_lines - a.changed_lines);

  const laneA = files.filter((f) => f.lane === "lane_a");
  const laneB = files.filter((f) => f.lane === "lane_b");

  const report = {
    base_commit: base,
    master_head: head,
    analyzed_at: new Date().toISOString(),
    lane_threshold: LANE_THRESHOLD,
    files,
    skipped,
    summary: {
      lane_a_count: laneA.length,
      lane_b_count: laneB.length,
      total_changed_files: files.length,
      total_skipped: skipped.length,
    },
  };

  writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));

  // stdout 摘要
  console.log(`改动文件: ${files.length}（跳过 ${skipped.length} 不需翻译）`);
  console.log(`Lane-A (≤${LANE_THRESHOLD} 行，AI 解 merge 冲突): ${laneA.length} 个文件`);
  console.log(`Lane-B (>${LANE_THRESHOLD} 行，reset + replay): ${laneB.length} 个文件`);
  console.log("");
  console.log("Lane-B 文件（reset + replay）:");
  for (const f of laneB.slice(0, 15)) {
    console.log(`  ${f.changed_lines} 行改动 (${f.change_type})  ${f.file}`);
  }
  if (laneB.length > 15) console.log(`  ... 还有 ${laneB.length - 15} 个`);
  console.log("");
  console.log(`详细报告: ${REPORT_FILE}`);
}

main();
