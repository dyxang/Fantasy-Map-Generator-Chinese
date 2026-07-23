// validate.mjs — Validate translation integrity
// Checks: placeholder integrity, HTML structure, TS compile, lint, TM consistency
// Usage: node validate.mjs [--check-consistency] [--apply-glossary] [--skip-tsc] [--skip-lint]

import { readFileSync, existsSync } from "fs";
import { execSync } from "child_process";
import { parse } from "parse5";
import { join } from "path";

const ROOT = join(import.meta.dirname, "..", "..");
const I18N = join(ROOT, "i18n");

// --- Helpers ---

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function getBaseCommit() {
  const path = join(I18N, "base_commit.txt");
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf8").trim();
}

function getBaseFile(commit, filePath) {
  try {
    return execSync(`git show ${commit}:${filePath}`, { cwd: ROOT, encoding: "utf8" });
  } catch {
    return null;
  }
}

function extractPlaceholders(text) {
  const patterns = [
    /\{\{[^}]+\}\}/g, // {{xxx}}
    /<%[^%]+%>/g, // <%xxx%>
    /\$\{[^}]+\}/g, // ${xxx}
    /%[sdf]/g, // %s %d %f
  ];
  const counts = {};
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      for (const m of matches) {
        counts[m] = (counts[m] || 0) + 1;
      }
    }
  }
  return counts;
}

function comparePlaceholderCounts(baseCounts, currentCounts, filePath) {
  const issues = [];
  const allKeys = new Set([...Object.keys(baseCounts), ...Object.keys(currentCounts)]);
  for (const key of allKeys) {
    const base = baseCounts[key] || 0;
    const current = currentCounts[key] || 0;
    if (base !== current) {
      issues.push(`  ${filePath}: placeholder "${key}" count changed: ${base} → ${current}`);
    }
  }
  return issues;
}

function countTags(node) {
  let count = 0;
  if (node.childNodes) {
    for (const child of node.childNodes) {
      if (child.nodeName && child.nodeName !== "#text" && child.nodeName !== "#comment" && child.nodeName !== "#documentType") {
        count++;
      }
      count += countTags(child);
    }
  }
  return count;
}

// --- Checks ---

function checkPlaceholderIntegrity(baseCommit) {
  console.log("\n[1/6] Placeholder integrity check...");
  const tm = readJson(join(I18N, "tm.json"));
  const issues = [];

  // Get unique files from TM
  const files = [...new Set(tm.entries.map((e) => e.file))];
  for (const file of files) {
    const current = readFileSync(join(ROOT, file), "utf8");
    const base = getBaseFile(baseCommit, file);
    if (!base) {
      console.log(`  Skipping ${file} (no base version)`);
      continue;
    }
    const baseCounts = extractPlaceholders(base);
    const currentCounts = extractPlaceholders(current);
    issues.push(...comparePlaceholderCounts(baseCounts, currentCounts, file));
  }

  if (issues.length === 0) {
    console.log("  PASS — All placeholders intact");
  } else {
    console.log("  FAIL — Placeholder mismatches:");
    issues.forEach((i) => console.log(i));
  }
  return issues.length === 0;
}

function checkHtmlStructure(baseCommit) {
  console.log("\n[2/6] HTML structure integrity check...");
  const htmlPath = "src/index.html";
  const current = readFileSync(join(ROOT, htmlPath), "utf8");
  const base = getBaseFile(baseCommit, htmlPath);

  if (!base) {
    console.log("  SKIP — No base version available");
    return true;
  }

  try {
    const baseDoc = parse(base, { sourceCodeLocationInfo: false });
    const currentDoc = parse(current, { sourceCodeLocationInfo: false });
    const baseTagCount = countTags(baseDoc);
    const currentTagCount = countTags(currentDoc);

    if (baseTagCount === currentTagCount) {
      console.log(`  PASS — Tag count matches: ${currentTagCount} tags`);
      return true;
    } else {
      console.log(`  FAIL — Tag count mismatch: base=${baseTagCount}, current=${currentTagCount}`);
      console.log("  (This may indicate a structural change. Review manually.)");
      return false;
    }
  } catch (e) {
    console.log(`  FAIL — HTML parse error: ${e.message}`);
    return false;
  }
}

function checkTsCompile(skipTsc) {
  console.log("\n[3/6] TypeScript compilation check...");
  if (skipTsc) {
    console.log("  SKIP — --skip-tsc flag set");
    return true;
  }
  try {
    execSync("npx tsc --noEmit", { cwd: ROOT, encoding: "utf8", stdio: "pipe" });
    console.log("  PASS — tsc --noEmit succeeded");
    return true;
  } catch (e) {
    const output = e.stdout || e.stderr || e.message;
    console.log("  FAIL — tsc --noEmit failed:");
    console.log("  " + output.split("\n").slice(0, 10).join("\n  "));
    return false;
  }
}

function checkLint(skipLint) {
  console.log("\n[4/6] Biome lint check...");
  if (skipLint) {
    console.log("  SKIP — --skip-lint flag set");
    return true;
  }
  try {
    execSync("npm run lint", { cwd: ROOT, encoding: "utf8", stdio: "pipe" });
    console.log("  PASS — npm run lint succeeded");
    return true;
  } catch (e) {
    const output = e.stdout || e.stderr || e.message;
    console.log("  FAIL — npm run lint failed:");
    console.log("  " + output.split("\n").slice(0, 10).join("\n  "));
    return false;
  }
}

function checkTmConsistency() {
  console.log("\n[5/6] Translation memory consistency check...");
  const tm = readJson(join(I18N, "tm.json"));
  if (tm.entries.length === 0) {
    console.log("  SKIP — No TM entries yet");
    return true;
  }

  // Group by source, check for different targets with same context_tag
  const bySource = {};
  for (const entry of tm.entries) {
    const key = entry.source;
    if (!bySource[key]) bySource[key] = [];
    bySource[key].push(entry);
  }

  const issues = [];
  for (const [source, entries] of Object.entries(bySource)) {
    if (entries.length < 2) continue;
    // Check if same context_tag has different targets
    const byTag = {};
    for (const e of entries) {
      const tag = e.context_tag || "default";
      if (!byTag[tag]) byTag[tag] = new Set();
      byTag[tag].add(e.target);
    }
    for (const [tag, targets] of Object.entries(byTag)) {
      if (targets.size > 1) {
        issues.push(`  "${source}" [${tag}] has ${targets.size} different translations: ${[...targets].map((t) => `"${t}"`).join(", ")}`);
      }
    }
  }

  if (issues.length === 0) {
    console.log("  PASS — No inconsistent translations");
  } else {
    console.log(`  WARN — ${issues.length} consistency issues found:`);
    issues.forEach((i) => console.log(i));
  }
  // Consistency issues are warnings, not hard failures
  return true;
}

function checkUntranslatedEntries() {
  console.log("\n[6/6] Untranslated entry check...");
  const tm = readJson(join(I18N, "tm.json"));
  if (tm.entries.length === 0) {
    console.log("  SKIP — No TM entries yet");
    return true;
  }

  const untranslated = tm.entries.filter((e) => !e.target || e.target === e.source);
  const total = tm.entries.length;
  const translated = total - untranslated.length;

  console.log(`  TM entries: ${total} total, ${translated} translated, ${untranslated.length} untranslated`);
  if (untranslated.length > 0 && translated > 0) {
    console.log(`  (${Math.round((translated / total) * 100)}% translated)`);
  }
  return true;
}

// --- Glossary consistency (optional, --check-consistency) ---

function checkGlossaryConsistency() {
  console.log("\n[Glossary] Checking TM against glossary...");
  const tm = readJson(join(I18N, "tm.json"));
  const glossary = readJson(join(I18N, "glossary.json"));

  if (tm.entries.length === 0) {
    console.log("  SKIP — No TM entries yet");
    return;
  }

  // Build glossary lookup
  const glossaryMap = {};
  for (const term of glossary.terms) {
    glossaryMap[term.en.toLowerCase()] = term;
  }

  // Check if TM targets use the glossary translations
  const mismatches = [];
  for (const entry of tm.entries) {
    if (!entry.target) continue;
    for (const [en, term] of Object.entries(glossaryMap)) {
      if (term.do_not_translate) continue;
      // If source contains the English term, target should contain the Chinese translation
      if (entry.source.toLowerCase().includes(en)) {
        if (!entry.target.includes(term.zh)) {
          mismatches.push(`  "${entry.source}" — glossary says "${en}" → "${term.zh}", but target is "${entry.target}"`);
        }
      }
    }
  }

  if (mismatches.length === 0) {
    console.log("  PASS — All TM entries consistent with glossary");
  } else {
    console.log(`  Found ${mismatches.length} glossary mismatches:`);
    mismatches.slice(0, 20).forEach((m) => console.log(m));
    if (mismatches.length > 20) console.log(`  ... and ${mismatches.length - 20} more`);
  }
}

// --- Residual English check ---

function checkResidualEnglish() {
  console.log("\n[7/7] Residual English in translated files...");
  const tm = readJson(join(I18N, "tm.json"));
  if (tm.entries.length === 0) {
    console.log("  SKIP — No TM entries yet");
    return true;
  }

  // Whitelist: brand names, technical terms that should stay English
  const whitelist = new Set([
    "Azgaar", "URL", "JSON", "CSS", "HTML", "SVG", "API", "AI",
    "Patreon", "localStorage", "Shift", "Ctrl", "DnD", "PDF",
  ]);

  const issues = [];
  const checkedFiles = new Set();

  for (const entry of tm.entries) {
    if (!entry.target || entry.skipped) continue;
    if (checkedFiles.has(entry.file + ":" + entry.line)) continue;
    checkedFiles.add(entry.file + ":" + entry.line);

    // Read the actual file line to verify translation was applied
    const filePath = join(ROOT, entry.file);
    if (!existsSync(filePath)) continue;
    const content = readFileSync(filePath, "utf8");
    const lines = content.split("\n");
    const line = lines[entry.line - 1] || "";

    // Check if the line still contains the original English source text
    // (only for non-template strings to avoid false positives with ${...})
    if (!entry.source.includes("${") && !entry.source.includes("<%")) {
      // For simple strings, check if the original source still appears on this line.
      // Use case-sensitive matching: source "Sinkhole" (label) should not match
      // "sinkhole" (lowercase enum value on the same line).
      const sourceEscaped = entry.source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const sourceRegex = new RegExp(sourceEscaped.replace(/\s+/g, "\\s+"));

      // If the line has Chinese characters but still contains the full English source
      if (/[\u4e00-\u9fff]/.test(line) && sourceRegex.test(line)) {
        // Double-check: is the English text inside a ${...} placeholder?
        // If not, it's likely a residual untranslated string
        const withoutPlaceholders = line.replace(/\$\{[^}]+\}/g, "");
        if (sourceRegex.test(withoutPlaceholders)) {
          issues.push(`  ${entry.file}:${entry.line} — possible residual English: "${entry.source.slice(0, 40)}"`);
        }
      }
    }
  }

  if (issues.length === 0) {
    console.log("  PASS — No residual English detected in translated lines");
  } else {
    console.log(`  WARN — ${issues.length} possible residuals:`);
    issues.slice(0, 15).forEach((i) => console.log(i));
  }
  return true;
}

// --- Main ---

function main() {
  const args = process.argv.slice(2);
  const skipTsc = args.includes("--skip-tsc");
  const skipLint = args.includes("--skip-lint");
  const checkConsistency = args.includes("--check-consistency");

  console.log("=== FMG i18n Validation ===");
  console.log(`Date: ${new Date().toISOString()}`);

  const baseCommit = getBaseCommit();
  console.log(`Base commit: ${baseCommit || "(not set)"}`);

  const results = [];

  // Core checks
  results.push(checkPlaceholderIntegrity(baseCommit));
  results.push(checkHtmlStructure(baseCommit));
  results.push(checkTsCompile(skipTsc));
  results.push(checkLint(skipLint));
  results.push(checkTmConsistency());
  results.push(checkUntranslatedEntries());
  results.push(checkResidualEnglish());

  // Optional glossary check
  if (checkConsistency) {
    checkGlossaryConsistency();
  }

  // Summary
  const passed = results.filter(Boolean).length;
  const total = results.length;
  console.log(`\n=== Summary: ${passed}/${total} checks passed ===`);

  if (passed < total) {
    console.log("VALIDATION FAILED — Fix issues before committing.");
    process.exit(1);
  } else {
    console.log("VALIDATION PASSED — All checks green.");
  }
}

main();
