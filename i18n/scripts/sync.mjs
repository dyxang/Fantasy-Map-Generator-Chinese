// sync.mjs — Detect upstream changes and generate pending translation list
// Usage: node sync.mjs
// Output: i18n/pending.json

import { readFileSync, writeFileSync, existsSync } from "fs";
import { execSync } from "child_process";
import { join } from "path";

const ROOT = join(import.meta.dirname, "..", "..");
const I18N = join(ROOT, "i18n");

// --- Helpers ---

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function getBaseCommit() {
  return readFileSync(join(I18N, "base_commit.txt"), "utf8").trim();
}

function getUpstreamCommit() {
  try {
    return execSync("git rev-parse upstream/master", { cwd: ROOT, encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

function git(args) {
  return execSync(`git ${args}`, { cwd: ROOT, encoding: "utf8" }).trim();
}

// Simple Levenshtein distance for similarity comparison
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const prev = new Array(n + 1);
  const curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

function similarity(a, b) {
  if (!a || !b) return 0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

// Parse git diff --unified=0 output
function parseDiff(diffOutput) {
  const files = [];
  let currentFile = null;
  let currentHunk = null;

  for (const line of diffOutput.split("\n")) {
    if (line.startsWith("diff --git")) {
      if (currentFile) files.push(currentFile);
      const match = line.match(/diff --git a\/(.+?) b\/(.+)/);
      currentFile = { file: match ? match[2] : "", hunks: [] };
      currentHunk = null;
    } else if (line.startsWith("@@")) {
      // @@ -start,count +start,count @@
      const match = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
      currentHunk = {
        oldStart: match ? parseInt(match[1]) : 0,
        oldCount: match && match[2] ? parseInt(match[2]) : 1,
        newStart: match ? parseInt(match[3]) : 0,
        newCount: match && match[4] ? parseInt(match[4]) : 1,
        added: [],
        deleted: [],
        modified: [],
      };
      if (currentFile) currentFile.hunks.push(currentHunk);
    } else if (line.startsWith("+") && !line.startsWith("+++")) {
      if (currentHunk) currentHunk.added.push({ content: line.slice(1), lineNum: currentHunk.newStart + currentHunk.added.length });
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      if (currentHunk) currentHunk.deleted.push({ content: line.slice(1), lineNum: currentHunk.oldStart + currentHunk.deleted.length });
    }
  }
  if (currentFile) files.push(currentFile);

  // Pair up adjacent delete+add as modifications
  for (const file of files) {
    for (const hunk of file.hunks) {
      const maxLen = Math.max(hunk.deleted.length, hunk.added.length);
      for (let i = 0; i < maxLen; i++) {
        if (i < hunk.deleted.length && i < hunk.added.length) {
          hunk.modified.push({
            old: hunk.deleted[i],
            new: hunk.added[i],
          });
        }
      }
    }
  }

  return files;
}

// Check if text matches any divergence anchor
function checkDivergence(text, divergence) {
  for (const entry of divergence.entries) {
    if (entry.do_not_follow_upstream && text.includes(entry.anchor_text)) {
      return entry;
    }
  }
  return null;
}

// --- Main ---

function main() {
  console.log("=== FMG i18n Sync ===\n");

  const baseCommit = getBaseCommit();
  console.log(`Base commit: ${baseCommit}`);

  // Fetch upstream
  console.log("Fetching upstream...");
  try {
    execSync("git fetch upstream", { cwd: ROOT, encoding: "utf8", stdio: "pipe" });
  } catch (e) {
    console.log("Warning: git fetch upstream failed (may be offline). Using existing refs.");
  }

  const upstreamCommit = getUpstreamCommit();
  if (!upstreamCommit) {
    console.error("Error: upstream/master not found. Run: git fetch upstream");
    process.exit(1);
  }
  console.log(`Upstream commit: ${upstreamCommit}`);

  if (baseCommit === upstreamCommit) {
    console.log("\nAlready up to date — no changes to sync.");
    const output = {
      synced_at: new Date().toISOString().slice(0, 10),
      base_commit: baseCommit,
      upstream_commit: upstreamCommit,
      pending_units: [],
    };
    writeFileSync(join(I18N, "pending.json"), JSON.stringify(output, null, 2));
    console.log("Wrote i18n/pending.json (0 pending units)");
    return;
  }

  // Load TM, units, divergence
  const tm = readJson(join(I18N, "tm.json"));
  const units = existsSync(join(I18N, "units.json")) ? readJson(join(I18N, "units.json")) : { units: [] };
  const divergence = readJson(join(I18N, "divergence.json"));

  // Build lookup: source text → TM entry
  const tmBySource = {};
  for (const entry of tm.entries) {
    if (!tmBySource[entry.source]) tmBySource[entry.source] = [];
    tmBySource[entry.source].push(entry);
  }

  // Build lookup: source text → unit
  const unitsBySource = {};
  for (const unit of units.units) {
    if (!unitsBySource[unit.source]) unitsBySource[unit.source] = [];
    unitsBySource[unit.source].push(unit);
  }

  // Get changed files
  console.log("\nGetting changed files...");
  let diffStat;
  try {
    diffStat = git(`diff ${baseCommit}..upstream/master --stat`);
  } catch (e) {
    console.error("Error: git diff failed. Make sure both commits exist.");
    process.exit(1);
  }

  const changedFiles = diffStat
    .split("\n")
    .filter((l) => l.includes("|"))
    .map((l) => l.split("|")[0].trim())
    .filter((f) => !f.includes("test"));

  console.log(`Changed files: ${changedFiles.length}`);
  changedFiles.forEach((f) => console.log(`  ${f}`));

  // For each changed file, get detailed diff
  const pendingUnits = [];
  let addedCount = 0;
  let changedCount = 0;
  let skipCount = 0;
  let deleteCount = 0;

  for (const file of changedFiles) {
    // Only process files that might contain translatable text
    if (!file.endsWith(".html") && !file.endsWith(".ts") && !file.endsWith(".js")) continue;

    console.log(`\nAnalyzing ${file}...`);
    let diffOutput;
    try {
      diffOutput = git(`diff ${baseCommit}..upstream/master --unified=0 -- "${file}"`);
    } catch {
      continue;
    }

    const parsed = parseDiff(diffOutput);

    for (const fileDiff of parsed) {
      for (const hunk of fileDiff.hunks) {
        // Process modifications (paired delete+add)
        for (const mod of hunk.modified) {
          const oldText = mod.old.content.trim();
          const newText = mod.new.content.trim();

          // Skip non-text lines (code, whitespace)
          if (!/[a-zA-Z]/.test(oldText) && !/[a-zA-Z]/.test(newText)) continue;

          // Check divergence
          const divMatch = checkDivergence(oldText, divergence);
          if (divMatch) {
            pendingUnits.push({
              id: `sync:${file}:${mod.old.lineNum}`,
              action: "skip",
              reason: `Divergence: ${divMatch.reason}`,
              file,
              old_line: mod.old.lineNum,
              new_line: mod.new.lineNum,
              source: oldText,
            });
            skipCount++;
            continue;
          }

          // Check if this line is in TM
          const tmEntries = tmBySource[oldText] || [];
          const unitEntries = unitsBySource[oldText] || [];

          if (tmEntries.length > 0 || unitEntries.length > 0) {
            // This is a translatable line that changed
            const sim = similarity(oldText, newText);
            if (sim > 0.85) {
              // Non-semantic change (whitespace, formatting) — skip
              pendingUnits.push({
                id: `sync:${file}:${mod.old.lineNum}`,
                action: "skip",
                reason: `Similarity ${sim.toFixed(2)} > 0.85 (non-semantic change)`,
                file,
                old_line: mod.old.lineNum,
                new_line: mod.new.lineNum,
                source: newText,
              });
              skipCount++;
            } else {
              // Semantic change — needs retranslation
              pendingUnits.push({
                id: `sync:${file}:${mod.old.lineNum}`,
                action: "retranslate",
                reason: `Similarity ${sim.toFixed(2)} < 0.85 (semantic change)`,
                file,
                old_line: mod.old.lineNum,
                new_line: mod.new.lineNum,
                source: newText,
                old_source: oldText,
              });
              changedCount++;
            }
          }
        }

        // Process pure additions (no matching delete)
        for (let i = hunk.modified.length; i < hunk.added.length; i++) {
          const add = hunk.added[i];
          const text = add.content.trim();
          if (!/[a-zA-Z]/.test(text)) continue;

          // Check if this looks like translatable text
          if (text.length < 3) continue;

          // Check if it matches any unit pattern
          const unitEntries = unitsBySource[text] || [];
          if (unitEntries.length > 0 || isLikelyTranslatable(text)) {
            pendingUnits.push({
              id: `sync:${file}:${add.lineNum}`,
              action: "translate",
              reason: "New translatable text",
              file,
              new_line: add.lineNum,
              source: text,
            });
            addedCount++;
          }
        }

        // Process pure deletions (no matching add)
        for (let i = hunk.modified.length; i < hunk.deleted.length; i++) {
          const del = hunk.deleted[i];
          const text = del.content.trim();
          if (!/[a-zA-Z]/.test(text)) continue;

          const tmEntries = tmBySource[text] || [];
          if (tmEntries.length > 0) {
            pendingUnits.push({
              id: `sync:${file}:${del.lineNum}`,
              action: "delete",
              reason: "Text removed upstream",
              file,
              old_line: del.lineNum,
              source: text,
            });
            deleteCount++;
          }
        }
      }
    }
  }

  // Write pending.json
  const output = {
    synced_at: new Date().toISOString().slice(0, 10),
    base_commit: baseCommit,
    upstream_commit: upstreamCommit,
    pending_units: pendingUnits,
  };

  writeFileSync(join(I18N, "pending.json"), JSON.stringify(output, null, 2));

  console.log(`\n=== Sync Complete ===`);
  console.log(`Pending units: ${pendingUnits.length}`);
  console.log(`  translate (new):     ${addedCount}`);
  console.log(`  retranslate (changed): ${changedCount}`);
  console.log(`  skip (non-semantic):    ${skipCount}`);
  console.log(`  delete (removed):       ${deleteCount}`);
  console.log(`\nWrote i18n/pending.json`);

  if (pendingUnits.length === 0) {
    console.log("\nNo pending work — safe to merge upstream/master.");
    console.log("Run: git merge upstream/master && echo $(git rev-parse HEAD) > i18n/base_commit.txt");
  } else {
    console.log(`\n${pendingUnits.length} units need attention. Process i18n/pending.json before merging.`);
  }
}

function isLikelyTranslatable(text) {
  // Heuristic: contains spaces and multiple words, or is a known UI pattern
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length >= 2 && /[a-zA-Z]/.test(text)) return true;
  // Single word that looks like UI text (e.g., "Settings", "Export")
  if (words.length === 1 && text.length > 3 && /^[A-Z][a-z]/.test(text)) return true;
  return false;
}

main();
