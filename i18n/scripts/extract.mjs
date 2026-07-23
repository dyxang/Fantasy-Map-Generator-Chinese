// extract.mjs — Extract translatable strings from HTML and TS/JS files
// Output: i18n/units.json

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "fs";
import { createHash } from "crypto";
import { parse } from "parse5";
import { join, extname, relative } from "path";

const ROOT = join(import.meta.dirname, "..", "..");
const SRC_HTML = join(ROOT, "src", "index.html");
const OUTPUT = join(import.meta.dirname, "..", "units.json");

// --- Helpers ---

function sha256(text) {
  return "sha256:" + createHash("sha256").update(text, "utf8").digest("hex").slice(0, 16);
}

function getLines(filePath) {
  return readFileSync(filePath, "utf8").split("\n");
}

function getContext(lines, lineNum, radius = 3) {
  const start = Math.max(0, lineNum - 1 - radius);
  const end = Math.min(lines.length, lineNum + radius);
  return lines.slice(start, end).join("\n");
}

function isTranslatableText(text) {
  const trimmed = text.trim();
  if (trimmed.length < 2) return false;
  if (!/[a-zA-Z]/.test(trimmed)) return false; // must contain letters
  if (/[\u4e00-\u9fff]/.test(trimmed)) return false; // already translated (contains Chinese)
  // Skip pure numbers/symbols
  if (/^[\d\s.,;:!?@#$%^&*()+\-=<>/[\]{}|~`"']+$/.test(trimmed)) return false;
  return true;
}

function looksLikeFilePath(text) {
  return /^\/|^\.\.?\/|^[a-z]:\\/i.test(text) || /\.\w{1,5}$/.test(text) && !/\s/.test(text) && text.length < 60;
}

function looksLikeUrl(text) {
  return /^https?:\/\//i.test(text) || /^www\./i.test(text);
}

function looksLikeCssSelector(text) {
  return /^[.#][\w-]+$/.test(text) || /^@media/.test(text);
}

function looksLikeCssVariable(text) {
  // CSS custom properties: --bg-opacity, --bg-main, --header-active
  return /^--[a-z][\w-]*$/i.test(text.trim());
}

function looksLikeSvgPath(text) {
  return /^[MLCQAZHVmlcqazhv][\d\s.,-]+$/.test(text.trim()) && text.length > 20;
}

function looksLikeCode(text) {
  const t = text.trim();
  // Skip JS keywords
  if (/^(function|const|let|var|import|export|class|return|if|else|for|while|switch|case|break|continue)\s/.test(t)) return true;
  // Skip pure code (no spaces between words, contains special chars)
  if (/[;{}]/.test(t) && !/\s[a-z]{3,}\s/i.test(t)) return true;
  // Skip camelCase identifiers without spaces (likely variable names)
  if (!/\s/.test(t) && /^[a-z][a-zA-Z0-9]*$/.test(t) && t.length < 30) return true;
  // Skip kebab-case identifiers without spaces (likely CSS class names or data attributes)
  if (!/\s/.test(t) && /^[a-z][a-z0-9-]*$/.test(t) && t.length < 40) return true;
  return false;
}

// --- HTML Extraction ---

function extractHtmlUnits(filePath) {
  const html = readFileSync(filePath, "utf8");
  const lines = html.split("\n");
  const document = parse(html, { sourceCodeLocationInfo: true });
  const units = [];
  const seenIds = new Set();

  const TRANSLATABLE_ATTRS = new Set([
    "title", "placeholder", "aria-label", "alt", "data-tip", "data-info",
  ]);

  function walk(node, inSkipTag = false) {
    if (node.nodeName === "#text") {
      if (inSkipTag) return;
      const text = node.value;
      const trimmed = text.trim();
      if (!isTranslatableText(trimmed)) return;
      const loc = node.sourceCodeLocation;
      if (!loc) return;
      const ctxBefore = lines.slice(Math.max(0, loc.startLine - 4), loc.startLine - 1).join("\n");
      const ctxAfter = lines.slice(loc.startLine, Math.min(lines.length, loc.startLine + 3)).join("\n");
      const id = sha256(trimmed + ctxBefore);
      if (seenIds.has(id + ":" + loc.startLine)) return;
      seenIds.add(id + ":" + loc.startLine);
      units.push({
        id,
        source: trimmed,
        file: relative(ROOT, filePath),
        line: loc.startLine,
        type: "html_text",
        context_tag: inferContextTag(node),
        context_before: ctxBefore,
        context_after: ctxAfter,
      });
      return;
    }

    if (node.nodeName === "#comment" || node.nodeName === "#documentType") return;

    // Element node
    const tagName = node.nodeName;
    const skipContents = tagName === "script" || tagName === "style" || tagName === "path";

    // Extract translatable attributes
    if (node.attrs && !skipContents && tagName !== "path") {
      for (const attr of node.attrs) {
        if (TRANSLATABLE_ATTRS.has(attr.name)) {
          const val = attr.value?.trim();
          if (!val || !isTranslatableText(val)) continue;
          const loc = node.sourceCodeLocation;
          const line = loc?.startLine || 0;
          const ctxBefore = lines.slice(Math.max(0, line - 4), Math.max(0, line - 1)).join("\n");
          const ctxAfter = lines.slice(line, Math.min(lines.length, line + 3)).join("\n");
          const id = sha256(val + ctxBefore);
          if (seenIds.has(id + ":attr:" + line)) continue;
          seenIds.add(id + ":attr:" + line);
          units.push({
            id,
            source: val,
            file: relative(ROOT, filePath),
            line,
            type: "html_attr",
            context_tag: attr.name,
            context_before: ctxBefore,
            context_after: ctxAfter,
          });
        }
      }
    }

    // Walk children
    if (node.childNodes) {
      for (const child of node.childNodes) {
        walk(child, skipContents || inSkipTag);
      }
    }
  }

  walk(document);
  return units;
}

function inferContextTag(node) {
  let parent = node.parentNode;
  while (parent) {
    const tag = parent.nodeName;
    if (tag === "button" || tag === "a") return "button";
    if (tag === "h1" || tag === "h2" || tag === "h3" || tag === "h4" || tag === "h5" || tag === "h6") return "heading";
    if (tag === "label") return "label";
    if (tag === "option") return "option";
    if (tag === "td" || tag === "th") return "table_cell";
    if (tag === "li") return "list_item";
    if (tag === "dialog" || tag === "div") return "section";
    parent = parent.parentNode;
  }
  return "text";
}

// --- TS/JS Extraction ---

function findFiles(dir, exts, results = []) {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      // Skip node_modules, dist, .git, tests
      if (["node_modules", "dist", ".git", "tests", "i18n"].includes(entry)) continue;
      findFiles(fullPath, exts, results);
    } else if (exts.includes(extname(entry))) {
      results.push(fullPath);
    }
  }
  return results;
}

function extractTsUnits(filePath) {
  const content = readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  const units = [];
  const seenIds = new Set();

  // Patterns for translatable string assignments
  // Matches: name: "...", title: "...", label: "...", description: "...", tip: "...", placeholder: "..."
  const propPattern = /\b(name|title|label|description|tip|placeholder|text|message|heading|caption|summary)\s*:\s*("([^"\\]|\\.)*"|'([^'\\]|\\.)*')/g;

  // Patterns for function call strings: alert("..."), confirm("..."), tip("..."), toast("...")
  const callPattern = /\b(alert|confirm|tip|toast|notice|warning|error|info)\s*\(\s*("([^"\\]|\\.)*"|'([^'\\]|\\.)*')/g;

  // Also match standalone UI strings in template literals: `Average ${x} temperature`
  const templatePattern = /\b(name|title|label|description|tip|placeholder|text|message|heading|caption|summary)\s*:\s*`([^`]*)`/g;

  function processMatch(match, defaultContextTag) {
    const fullMatch = match[0];
    const strValue = match[2] || match[3] || match[4] || match[5] || "";

    // Extract the actual string content (strip quotes/backticks)
    let value = strValue;
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
      // Unescape basic sequences
      value = value.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\"/g, '"').replace(/\\'/g, "'");
    } else if (value.startsWith("`") && value.endsWith("`")) {
      value = value.slice(1, -1);
    }

    const trimmed = value.trim();
    if (!isTranslatableText(trimmed)) return;
    if (looksLikeFilePath(trimmed) || looksLikeUrl(trimmed) || looksLikeCssSelector(trimmed)) return;
    if (looksLikeCssVariable(trimmed)) return;
    if (looksLikeSvgPath(trimmed)) return;
    if (looksLikeCode(trimmed)) return;

    // Find line number
    const matchIndex = match.index;
    const beforeMatch = content.slice(0, matchIndex);
    const lineNum = beforeMatch.split("\n").length;

    const ctxBefore = lines.slice(Math.max(0, lineNum - 4), Math.max(0, lineNum - 1)).join("\n");
    const ctxAfter = lines.slice(lineNum, Math.min(lines.length, lineNum + 3)).join("\n");
    const id = sha256(trimmed + ctxBefore);
    if (seenIds.has(id + ":" + lineNum)) return;
    seenIds.add(id + ":" + lineNum);

    units.push({
      id,
      source: trimmed,
      file: relative(ROOT, filePath),
      line: lineNum,
      type: "ts_string",
      context_tag: defaultContextTag,
      context_before: ctxBefore,
      context_after: ctxAfter,
    });
  }

  let match;
  while ((match = propPattern.exec(content)) !== null) {
    const propName = match[1];
    const tag = propName === "tip" ? "tooltip" : propName === "description" ? "description" : "label";
    processMatch(match, tag);
  }
  while ((match = callPattern.exec(content)) !== null) {
    processMatch(match, "message");
  }
  while ((match = templatePattern.exec(content)) !== null) {
    processMatch(match, "label");
  }

  // Also scan for tip() with template literals: tip(`...${...}...`)
  const tipTemplatePattern = /\b(alert|confirm|tip|toast|notice|warning|error|info)\s*\(\s*`([^`]*)`/g;
  while ((match = tipTemplatePattern.exec(content)) !== null) {
    const value = match[2];
    const trimmed = value.trim();
    if (!isTranslatableText(trimmed)) continue;
    if (looksLikeFilePath(trimmed) || looksLikeUrl(trimmed)) continue;
    const lineNum = content.slice(0, match.index).split("\n").length;
    const ctxBefore = lines.slice(Math.max(0, lineNum - 4), Math.max(0, lineNum - 1)).join("\n");
    const ctxAfter = lines.slice(lineNum, Math.min(lines.length, lineNum + 3)).join("\n");
    const id = sha256(trimmed + ctxBefore);
    if (seenIds.has(id + ":" + lineNum)) continue;
    seenIds.add(id + ":" + lineNum);
    units.push({
      id,
      source: trimmed,
      file: relative(ROOT, filePath),
      line: lineNum,
      type: "ts_string",
      context_tag: "message",
      context_before: ctxBefore,
      context_after: ctxAfter,
    });
  }

  return units;
}

// --- Main ---

function main() {
  const allUnits = [];
  let htmlCount = 0;
  let tsCount = 0;

  // 1. Extract from HTML
  if (existsSync(SRC_HTML)) {
    console.log("Extracting from src/index.html...");
    const htmlUnits = extractHtmlUnits(SRC_HTML);
    htmlCount = htmlUnits.length;
    allUnits.push(...htmlUnits);
    console.log(`  Found ${htmlCount} HTML text/attr units`);
  } else {
    console.warn("Warning: src/index.html not found");
  }

  // 2. Extract from TS files
  const tsFiles = findFiles(join(ROOT, "src"), [".ts", ".js"]);
  console.log(`Scanning ${tsFiles.length} TS/JS files in src/...`);
  for (const file of tsFiles) {
    const units = extractTsUnits(file);
    tsCount += units.length;
    allUnits.push(...units);
  }
  console.log(`  Found ${tsCount} TS/JS string units`);

  // 3. Extract from public/modules JS files (legacy vanilla JS)
  const modulesDir = join(ROOT, "public", "modules");
  if (existsSync(modulesDir)) {
    const jsFiles = findFiles(modulesDir, [".js"]);
    console.log(`Scanning ${jsFiles.length} legacy JS files in public/modules/...`);
    for (const file of jsFiles) {
      const units = extractTsUnits(file);
      tsCount += units.length;
      allUnits.push(...units);
    }
    console.log(`  (total TS/JS: ${tsCount})`);
  }

  // 4. Sort by file then line
  allUnits.sort((a, b) => {
    if (a.file !== b.file) return a.file.localeCompare(b.file);
    return a.line - b.line;
  });

  // 5. Write output
  const output = {
    version: 1,
    locale: "zh-CN",
    generated_at: new Date().toISOString().slice(0, 10),
    total_units: allUnits.length,
    units: allUnits,
  };

  writeFileSync(OUTPUT, JSON.stringify(output, null, 2));
  console.log(`\nDone! Wrote ${allUnits.length} units to i18n/units.json`);
  console.log(`  HTML: ${htmlCount}`);
  console.log(`  TS/JS: ${tsCount}`);
}

main();
