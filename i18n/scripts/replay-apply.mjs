// replay-apply.mjs — TM Replay：用 tm.json 的翻译覆盖到 master 文件
// Usage: node replay-apply.mjs --files <file1,file2,...>
//   --files: 要 replay 的文件列表（逗号分隔，相对仓库根）
//   --dry-run: 仅输出报告，不修改文件
//
// 策略:
//   .ts/.js  -> TypeScript AST 精确替换（遍历 StringLiteral 节点）
//   .html    -> parse5 AST 精确替换（遍历 text 节点 + 属性节点）
//   其他     -> String.split/join 字符串替换（保守，仅对 tm 中该文件条目）
//
// 输出: i18n/sync-replay-report.json

import { readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";
import { join, extname, relative } from "path";
import ts from "typescript";
import { parse as parseHtml } from "parse5";

const I18N = join(import.meta.dirname, "..");
const ROOT = join(I18N, "..");
const TM_FILE = join(I18N, "tm.json");
const REPORT_FILE = join(I18N, "sync-replay-report.json");

// 解析命令行参数
const args = process.argv.slice(2);
const filesIdx = args.indexOf("--files");
const dryRun = args.includes("--dry-run");
const allowGlobalFallback = args.includes("--allow-global-fallback");

if (filesIdx === -1 || !args[filesIdx + 1]) {
  console.error("Usage: node replay-apply.mjs --files <file1,file2,...> [--dry-run] [--allow-global-fallback]");
  console.error("  默认仅严格匹配 (file, source)，不开全局降级（避免误伤 type === 'River' 这类逻辑字符串）");
  console.error("  --allow-global-fallback: 开启全局 source 降级匹配（输出 AMBIGUOUS 警告）");
  process.exit(1);
}

const files = args[filesIdx + 1].split(",").map((s) => s.trim()).filter(Boolean);

// 读取 tm.json
const tm = JSON.parse(readFileSync(TM_FILE, "utf8"));

// 索引：byFile (file::source -> target) 和 bySource (source -> [{file, target}])
const byFile = new Map();
const bySource = new Map();
for (const e of tm.entries) {
  if (e.skipped) continue;
  byFile.set(`${e.file}::${e.source}`, e.target);
  if (!bySource.has(e.source)) bySource.set(e.source, []);
  bySource.get(e.source).push({ file: e.file, target: e.target });
}

// ========== TS/JS AST 替换 ==========

function replayTsFile(content, filePath) {
  const ext = extname(filePath);
  const scriptKind = ext === ".tsx" ? ts.ScriptKind.TSX : ext === ".ts" ? ts.ScriptKind.TS : ts.ScriptKind.JS;
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, scriptKind);

  const replacements = []; // { start, end, text }
  const stats = { strict_hit: 0, global_hit: 0, unmatched: [], ambiguous: [] };

  function visit(node) {
    // 双引号/单引号字符串字面量
    if (ts.isStringLiteral(node)) {
      const key = `${filePath}::${node.text}`;
      if (byFile.has(key)) {
        const target = byFile.get(key);
        stats.strict_hit++;
        replacements.push({
          start: node.getStart(sourceFile) + 1, // 跳过开引号
          end: node.getEnd() - 1,                 // 跳过闭引号
          text: escapeForStringLiteral(target, node),
        });
      } else if (allowGlobalFallback && bySource.has(node.text)) {
        const candidates = bySource.get(node.text);
        if (candidates.length === 1) {
          // 全局降级，唯一候选
          stats.global_hit++;
          replacements.push({
            start: node.getStart(sourceFile) + 1,
            end: node.getEnd() - 1,
            text: escapeForStringLiteral(candidates[0].target, node),
          });
        } else {
          // 多候选，加入 AMBIGUOUS
          stats.ambiguous.push({
            file: filePath,
            source: node.text,
            start: node.getStart(sourceFile),
            candidates: candidates.map((c) => ({ file: c.file, target: c.target })),
          });
        }
      } else if (!allowGlobalFallback) {
        // 不开启全局降级时，未严格命中的直接进 unmatched
        stats.unmatched.push({
          file: filePath,
          source: node.text,
          start: node.getStart(sourceFile),
        });
      }
    }

    // 模板字符串（无占位符的纯文本部分）
    if (ts.isNoSubstitutionTemplateLiteral(node)) {
      const key = `${filePath}::${node.text}`;
      if (byFile.has(key)) {
        const target = byFile.get(key);
        stats.strict_hit++;
        replacements.push({
          start: node.getStart(sourceFile) + 1,
          end: node.getEnd() - 1,
          text: target, // 模板字符串不需转义双引号
        });
      } else if (allowGlobalFallback && bySource.has(node.text)) {
        const candidates = bySource.get(node.text);
        if (candidates.length === 1) {
          stats.global_hit++;
          replacements.push({
            start: node.getStart(sourceFile) + 1,
            end: node.getEnd() - 1,
            text: candidates[0].target,
          });
        } else {
          stats.ambiguous.push({
            file: filePath,
            source: node.text,
            start: node.getStart(sourceFile),
            candidates: candidates.map((c) => ({ file: c.file, target: c.target })),
          });
        }
      } else if (!allowGlobalFallback) {
        stats.unmatched.push({
          file: filePath,
          source: node.text,
          start: node.getStart(sourceFile),
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  // 按位置倒序替换（避免位置漂移）
  replacements.sort((a, b) => b.start - a.start);
  let result = content;
  for (const r of replacements) {
    result = result.slice(0, r.start) + r.text + result.slice(r.end);
  }

  return { content: result, stats };
}

function escapeForStringLiteral(text, node) {
  // 根据原字面量是双引号还是单引号决定转义
  const fullText = node.getFullText ? node.getFullText() : "";
  const quoteChar = fullText[0];
  if (quoteChar === '"') {
    return text.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
  } else if (quoteChar === "'") {
    return text.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n");
  }
  return text;
}

// ========== HTML 文件：parse5 AST 精确替换 ==========

// 可翻译的 HTML 属性
const TRANSLATABLE_ATTRS = new Set([
  "title", "placeholder", "aria-label", "alt", "data-tip", "data-info",
]);

function replayHtmlFile(content, filePath) {
  const document = parseHtml(content, { sourceCodeLocationInfo: true });
  const replacements = []; // { startOffset, endOffset, text }
  const stats = { strict_hit: 0, global_hit: 0, unmatched: [], ambiguous: [] };
  const seenSources = new Set();

  // 计算属性值在原文中的精确范围
  // parse5 的 attrLoc: startOffset 指向属性名开头, endOffset 指向闭引号之后
  // 属性值范围: [startOffset + attrName.length + 2 (= 和 "), endOffset - 1)
  function attrValueRange(attrLoc, attrName) {
    return {
      start: attrLoc.startOffset + attrName.length + 2, // 跳过 name="
      end: attrLoc.endOffset - 1,                        // 跳过闭引号 "
    };
  }

  function walk(node) {
    // 文本节点
    if (node.nodeName === "#text") {
      const value = node.value || "";
      const trimmed = value.trim();
      if (trimmed.length < 2) {
        // 跳过空文本
      } else {
        const key = `${filePath}::${trimmed}`;
        if (byFile.has(key)) {
          // 严格命中
          const target = byFile.get(key);
          stats.strict_hit++;
          const loc = node.sourceCodeLocation;
          if (loc) {
            // 保留前后空白，只替换 trim 后的内容
            const leading = value.slice(0, value.indexOf(trimmed[0]));
            const trailing = value.slice(value.indexOf(trimmed[0]) + trimmed.length);
            replacements.push({
              startOffset: loc.startOffset,
              endOffset: loc.endOffset,
              text: leading + target + trailing,
            });
          }
          seenSources.add(trimmed);
        } else if (allowGlobalFallback && bySource.has(trimmed) && !seenSources.has(trimmed)) {
          const candidates = bySource.get(trimmed);
          if (candidates.length === 1) {
            stats.global_hit++;
            const target = candidates[0].target;
            const loc = node.sourceCodeLocation;
            if (loc) {
              const leading = value.slice(0, value.indexOf(trimmed[0]));
              const trailing = value.slice(value.indexOf(trimmed[0]) + trimmed.length);
              replacements.push({
                startOffset: loc.startOffset,
                endOffset: loc.endOffset,
                text: leading + target + trailing,
              });
            }
            seenSources.add(trimmed);
          } else {
            stats.ambiguous.push({
              file: filePath,
              source: trimmed,
              candidates: candidates.map((c) => ({ file: c.file, target: c.target })),
            });
            seenSources.add(trimmed);
          }
        }
      }
    }

    // 元素节点的属性
    if (node.attrs && node.nodeName !== "#text" && node.nodeName !== "#document" && node.nodeName !== "#documentType" && node.nodeName !== "#comment") {
      for (const attr of node.attrs) {
        if (TRANSLATABLE_ATTRS.has(attr.name)) {
          const val = (attr.value || "").trim();
          if (val.length < 2) continue;
          const key = `${filePath}::${val}`;
          if (byFile.has(key)) {
            const target = byFile.get(key);
            stats.strict_hit++;
            const loc = node.sourceCodeLocation;
            if (loc && loc.attrs && loc.attrs[attr.name]) {
              const attrLoc = loc.attrs[attr.name];
              const range = attrValueRange(attrLoc, attr.name);
              replacements.push({
                startOffset: range.start,
                endOffset: range.end,
                text: target,
              });
            }
            seenSources.add(val);
          } else if (allowGlobalFallback && bySource.has(val) && !seenSources.has(val)) {
            const candidates = bySource.get(val);
            if (candidates.length === 1) {
              stats.global_hit++;
              const target = candidates[0].target;
              const loc = node.sourceCodeLocation;
              if (loc && loc.attrs && loc.attrs[attr.name]) {
                const attrLoc = loc.attrs[attr.name];
                const range = attrValueRange(attrLoc, attr.name);
                replacements.push({
                  startOffset: range.start,
                  endOffset: range.end,
                  text: target,
                });
              }
              seenSources.add(val);
            } else {
              stats.ambiguous.push({
                file: filePath,
                source: val,
                candidates: candidates.map((c) => ({ file: c.file, target: c.target })),
              });
              seenSources.add(val);
            }
          }
        }
      }
    }

    // 递归子节点（跳过 script/style）
    const skipContents = node.nodeName === "script" || node.nodeName === "style" || node.nodeName === "path";
    if (node.childNodes && !skipContents) {
      for (const child of node.childNodes) walk(child);
    }
  }

  walk(document);

  // 按位置倒序替换
  replacements.sort((a, b) => b.startOffset - a.startOffset);
  let result = content;
  for (const r of replacements) {
    result = result.slice(0, r.startOffset) + r.text + result.slice(r.endOffset);
  }

  return { content: result, stats };
}

// ========== 其他文件（非 TS/JS/HTML）：保守的字符串替换 ==========

function replayGenericFile(content, filePath) {
  const stats = { strict_hit: 0, global_hit: 0, unmatched: [], ambiguous: [] };
  let result = content;

  // 收集该文件相关的所有 tm 条目
  const fileEntries = tm.entries.filter((e) => !e.skipped && e.file === filePath);
  const seen = new Set();

  // 严格匹配：先替换所有 (file, source) 命中的
  for (const e of fileEntries) {
    if (result.includes(e.source)) {
      result = result.split(e.source).join(e.target);
      stats.strict_hit++;
      seen.add(e.source);
    }
  }

  // 全局降级（仅当 --allow-global-fallback 开启时）
  if (allowGlobalFallback) {
    for (const e of fileEntries) {
      if (seen.has(e.source)) continue;
      if (bySource.has(e.source)) {
        const candidates = bySource.get(e.source);
        if (candidates.length === 1) {
          stats.global_hit++;
          result = result.split(e.source).join(candidates[0].target);
          seen.add(e.source);
        } else {
          stats.ambiguous.push({
            file: filePath,
            source: e.source,
            candidates: candidates.map((c) => ({ file: c.file, target: c.target })),
          });
          seen.add(e.source);
        }
      } else {
        stats.unmatched.push({ file: filePath, source: e.source });
      }
    }
  } else {
    // 不开启全局降级：未严格命中的直接进 unmatched
    for (const e of fileEntries) {
      if (!seen.has(e.source)) {
        stats.unmatched.push({ file: filePath, source: e.source });
      }
    }
  }

  return { content: result, stats };
}

// ========== 主流程 ==========

function readFileFromMaster(filePath) {
  // 从 master 分支读取文件内容（保证是英文原版）
  try {
    return execSync(`git show master:${filePath}`, { cwd: ROOT, encoding: "utf8" });
  } catch {
    return null; // 文件在 master 不存在（可能被删除）
  }
}

function main() {
  const report = {
    files_processed: [],
    stats: {
      strict_hit: 0,
      global_hit: 0,
      unmatched_count: 0,
      ambiguous_count: 0,
    },
    per_file: [],
    unmatched: [],
    ambiguous: [],
    parse_errors: [],
  };

  for (const file of files) {
    const ext = extname(file).toLowerCase();
    report.files_processed.push(file);

    const content = readFileFromMaster(file);
    if (content === null) {
      report.per_file.push({ file, status: "not_in_master", skip_reason: "file not in master" });
      continue;
    }

    try {
      let result;
      if (ext === ".ts" || ext === ".tsx" || ext === ".js" || ext === ".mjs") {
        result = replayTsFile(content, file);
      } else if (ext === ".html" || ext === ".htm") {
        result = replayHtmlFile(content, file);
      } else {
        result = replayGenericFile(content, file);
      }

      const { content: newContent, stats } = result;
      report.stats.strict_hit += stats.strict_hit;
      report.stats.global_hit += stats.global_hit;
      report.stats.unmatched_count += stats.unmatched.length;
      report.stats.ambiguous_count += stats.ambiguous.length;

      report.per_file.push({
        file,
        status: "ok",
        strict_hit: stats.strict_hit,
        global_hit: stats.global_hit,
        unmatched: stats.unmatched.length,
        ambiguous: stats.ambiguous.length,
      });

      if (stats.unmatched.length > 0) {
        report.unmatched.push(...stats.unmatched);
      }
      if (stats.ambiguous.length > 0) {
        report.ambiguous.push(...stats.ambiguous);
      }

      if (!dryRun) {
        const absPath = join(ROOT, file);
        writeFileSync(absPath, newContent);
      }
    } catch (err) {
      report.parse_errors.push({ file, error: err.message });
      report.per_file.push({ file, status: "parse_error", error: err.message });
    }
  }

  writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));

  // stdout 摘要
  console.log(`处理文件: ${report.files_processed.length}`);
  console.log(`严格命中: ${report.stats.strict_hit}`);
  console.log(`全局降级命中: ${report.stats.global_hit}`);
  console.log(`未命中（需翻译）: ${report.stats.unmatched_count}`);
  console.log(`AMBIGUOUS（需复核）: ${report.stats.ambiguous_count}`);
  if (report.parse_errors.length > 0) {
    console.log(`解析失败: ${report.parse_errors.length}`);
    for (const e of report.parse_errors) {
      console.log(`  ${e.file}: ${e.error}`);
    }
  }
  if (dryRun) {
    console.log("[dry-run] 未修改文件");
  }
  console.log(`详细报告: ${REPORT_FILE}`);
}

main();
