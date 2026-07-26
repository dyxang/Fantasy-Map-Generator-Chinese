#!/usr/bin/env node
// scripts/record-enhancement.mjs
// fmg-enhancer 自动记录脚本：采集 git diff 摘要，生成可还原级别的增强条目，
// 追加写入 .trae/skills/fmg-enhancer/enhancements.md。
//
// 用法：
//   node scripts/record-enhancement.mjs --id <id> --title "<标题>" \
//       [--category plugin|script|tool] [--risk low|medium|high] \
//       [--summary "<一句话描述>"] [--restore "<回滚命令>"] \
//       [--restore-on-upstream "<上游更新时要做的事>"]
//
// 行为：
//   - 自动 git diff --stat 收集新增/修改文件清单与行数
//   - 自动从 diff 中识别 src/controllers/index.ts / src/services/index.ts 注册表追加行
//   - 追加到 .trae/skills/fmg-enhancer/enhancements.md，文件不存在则创建并写入表头
//   - 调用方负责提供 id / title / summary / restore 字段；脚本负责把所有字段填齐

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..");
const ENHANCEMENTS_FILE = resolve(REPO_ROOT, ".trae/skills/fmg-enhancer/enhancements.md");

// ---- 参数解析 ---------------------------------------------------------------
const args = process.argv.slice(2);
function getArg(name) {
  const flag = `--${name}`;
  const idx = args.indexOf(flag);
  if (idx === -1) return undefined;
  return args[idx + 1];
}
function requireArg(name) {
  const value = getArg(name);
  if (!value) {
    console.error(`[fmg-enhancer] 缺少必填参数 --${name}`);
    process.exit(1);
  }
  return value;
}

const id = requireArg("id");
const title = requireArg("title");
const category = getArg("category") ?? "plugin";
const risk = getArg("risk") ?? "low";
const summary = getArg("summary") ?? "";
const restore = getArg("restore") ?? "";
const restoreOnUpstream = getArg("restore-on-upstream") ?? "";

// ---- git diff 采集 ----------------------------------------------------------
function git(...gitArgs) {
  try {
    return execFileSync("git", gitArgs, { cwd: REPO_ROOT, encoding: "utf-8" }).trim();
  } catch (error) {
    console.error(`[fmg-enhancer] git ${gitArgs.join(" ")} 失败: ${error.message}`);
    return "";
  }
}

const diffStat = git("diff", "--stat", "HEAD");
const statusOutput = git("status", "--short");
const branch = git("rev-parse", "--abbrev-ref", "HEAD") || "unknown";
const rev = git("rev-parse", "--short", "HEAD") || "unknown";
const diffDate = new Date().toISOString().slice(0, 19).replace("T", " ");

// 解析 diff 列表，分类新增/修改/删除
const fileChanges = { added: [], modified: [], deleted: [] };
for (const line of statusOutput.split("\n")) {
  if (!line.trim()) continue;
  const code = line.slice(0, 2);
  const path = line.slice(3).trim();
  if (code === "A " || code === "??") fileChanges.added.push(path);
  else if (code === "M ") fileChanges.modified.push(path);
  else if (code.startsWith("D")) fileChanges.deleted.push(path);
}

// 从 diff 中识别注册表追加行（src/controllers/index.ts / src/services/index.ts）
function extractRegistryLoaders() {
  const result = [];
  for (const regFile of ["src/controllers/index.ts", "src/services/index.ts"]) {
    const fullDiff = git("diff", "HEAD", "--", regFile);
    if (!fullDiff) continue;
    const addedLines = fullDiff
      .split("\n")
      .filter(l => l.startsWith("+") && !l.startsWith("+++"))
      .map(l => l.slice(1))
      .filter(l => /^\s*\w+:\s*\(\)\s*=>\s*import\(/.test(l));
    if (addedLines.length) result.push({ file: regFile, loaders: addedLines });
  }
  return result;
}
const registryLoaders = extractRegistryLoaders();

const totalStat = diffStat.split("\n").filter(l => l).pop() || "";

// ---- 组装 Markdown 条目 ------------------------------------------------------
const today = new Date().toISOString().slice(0, 10);

let md = "";
md += `\n## ${id} — ${title}\n\n`;
md += `- **日期**：${today} (${diffDate})\n`;
md += `- **类别**：${category}  |  **风险等级**：${risk}\n`;
md += `- **摘要**：${summary || "_(未填写)_"}\n`;
md += `- **基线提交**：\`${branch}@${rev}\`\n\n`;

md += `### 改动清单\n`;
if (fileChanges.added.length) {
  md += `**新增** (${fileChanges.added.length})：\n`;
  for (const f of fileChanges.added) md += `- \`${f}\`\n`;
}
if (fileChanges.modified.length) {
  md += `**修改** (${fileChanges.modified.length})：\n`;
  for (const f of fileChanges.modified) md += `- \`${f}\`\n`;
}
if (fileChanges.deleted.length) {
  md += `**删除** (${fileChanges.deleted.length})：\n`;
  for (const f of fileChanges.deleted) md += `- \`${f}\`\n`;
}
md += "\n";

if (registryLoaders.length) {
  md += `### 注册表追加行（关键还原锚点）\n`;
  for (const r of registryLoaders) {
    md += `**${r.file}**\n\`\`\`ts\n${r.loaders.join("\n")}\n\`\`\`\n`;
  }
  md += "\n";
}

if (totalStat) {
  md += `### 改动量\n\`\`\`\n${totalStat}\n\`\`\`\n\n`;
}

if (restore) {
  md += `### 回滚指令\n\`\`\`bash\n${restore}\n\`\`\`\n\n`;
}
if (restoreOnUpstream) {
  md += `### 上游升级时重挂载\n${restoreOnUpstream}\n\n`;
}

md += `---\n`;

// ---- 写入文件（首次创建含表头） ----------------------------------------------
let existing = "";
if (existsSync(ENHANCEMENTS_FILE)) {
  existing = readFileSync(ENHANCEMENTS_FILE, "utf-8");
} else {
  mkdirSync(dirname(ENHANCEMENTS_FILE), { recursive: true });
  existing = `# fmg-enhancer 增强清单

本文件由 \`scripts/record-enhancement.mjs\` 自动维护，记录每次增强的改动要点与还原指令。
- 位置：\`.trae/skills/fmg-enhancer/enhancements.md\`（与 SKILL.md 同目录，跟踪策略与 \`.trae/\` 一致）
- 用途：上游升级后据本清单快速判断哪些增强需要重挂载、逐条还原
- 写入时机：fmg-enhancer skill 交付阶段的最后一步

`;
}

writeFileSync(ENHANCEMENTS_FILE, existing + md, "utf-8");
console.log(`[fmg-enhancer] 已记录增强 ${id} → ${ENHANCEMENTS_FILE.replace(REPO_ROOT + "/", "")}`);
