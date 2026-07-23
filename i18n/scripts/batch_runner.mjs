// batch_runner.mjs — Automated batch translation runner
// Usage:
//   node batch_runner.mjs prepare <count>  — Generate batch files from units.json
//   node batch_runner.mjs collect           — Collect translations from modified source files, update tm.json + progress.json
//
// Workflow:
//   1. node batch_runner.mjs prepare 360   — Creates i18n/batch_N.json files, grouped by file
//   2. Dispatch subagents (manually or via Task tool) to translate each batch
//   3. node batch_runner.mjs collect         — Scans modified files, extracts translations, updates tm.json
//
// Improvements (post Phase-C analysis):
//   - Detects duplicate sources across batches and pre-assigns canonical translations
//   - Injects tm_hints (similar source→target pairs from prior TM) into each batch
//   - These eliminate the cross-subagent consistency drift seen in batch 2

import { readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dirname, "..", "..");
const I18N = join(ROOT, "i18n");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

// --- PREPARE: Group units into balanced batches by file ---

function prepare(count) {
  const unitsData = readJson(join(I18N, "units.json"));
  const progress = readJson(join(I18N, "progress.json"));
  const tm = readJson(join(I18N, "tm.json"));

  // Build TM lookup: source -> target (only translated, non-skipped entries)
  const tmBySource = {};
  for (const e of tm.entries) {
    if (e.target && !e.skipped) {
      // Keep first occurrence (or longest target for tie-breaking)
      if (!tmBySource[e.source] || e.target.length > tmBySource[e.source].length) {
        tmBySource[e.source] = e.target;
      }
    }
  }
  console.log(`TM lookup: ${Object.keys(tmBySource).length} unique sources available`);

  // Find where to start (after last processed)
  let startIndex = 0;
  if (progress.last_processed_id) {
    const idx = unitsData.units.findIndex(u => u.id === progress.last_processed_id);
    if (idx >= 0) startIndex = idx + 1;
  }

  const batch = unitsData.units.slice(startIndex, startIndex + count);
  console.log(`Starting at index ${startIndex}, taking ${batch.length} units (of ${unitsData.units.length - startIndex} remaining)`);

  // Pre-translate any unit whose source already exists in TM (exact match).
  // These don't need to go through subagents — they're already decided.
  const preTranslated = [];
  const needTranslation = [];
  let preTranslatedCount = 0;
  for (const u of batch) {
    if (tmBySource[u.source]) {
      preTranslated.push({ ...u, target: tmBySource[u.source] });
      preTranslatedCount++;
    } else {
      needTranslation.push(u);
    }
  }
  if (preTranslatedCount > 0) {
    console.log(`Pre-translated ${preTranslatedCount} units from existing TM (exact source match)`);
  }

  // Detect duplicate sources ACROSS the needTranslation set.
  // For duplicates that appear in multiple files (so will land in different batches),
  // mark the first occurrence as the "canonical" one and inject it as a forced translation
  // into all subsequent occurrences.
  const sourceFirstSeen = {}; // source -> {batch_idx_hint, target}
  // First pass: identify which sources appear more than once across different files
  const sourceFileMap = {};
  for (const u of needTranslation) {
    if (!sourceFileMap[u.source]) sourceFileMap[u.source] = new Set();
    sourceFileMap[u.source].add(u.file);
  }
  const crossFileDuplicates = new Set();
  for (const [src, files] of Object.entries(sourceFileMap)) {
    if (files.size > 1) crossFileDuplicates.add(src);
  }
  if (crossFileDuplicates.size > 0) {
    console.log(`Found ${crossFileDuplicates.size} sources appearing in multiple files (will be flagged for consistency)`);
  }

  // Group by file to avoid edit conflicts between subagents
  const byFile = {};
  for (const u of needTranslation) {
    if (!byFile[u.file]) byFile[u.file] = [];
    byFile[u.file].push(u);
  }

  // Sort files by unit count descending
  const sortedFiles = Object.entries(byFile).sort((a, b) => b[1].length - a[1].length);

  // Balance into 4 batches using greedy approach (assign each file to the batch with least units)
  const numBatches = 4;
  const batches = Array.from({ length: numBatches }, () => []);

  for (const [file, units] of sortedFiles) {
    // Find the batch with the fewest units
    let minBatch = 0;
    for (let i = 1; i < numBatches; i++) {
      if (batches[i].length < batches[minBatch].length) minBatch = i;
    }
    batches[minBatch].push(...units);
  }

  // Build tm_hints for each batch: source→target pairs from TM whose source contains
  // a word that also appears in any of this batch's units' sources.
  // This gives subagents context on how similar phrases were translated before.
  function buildTmHints(batchUnits) {
    const hints = {};
    // Collect words from this batch's sources (length >= 4 to skip stopwords)
    const batchWords = new Set();
    for (const u of batchUnits) {
      for (const w of u.source.toLowerCase().split(/[^a-z]+/)) {
        if (w.length >= 4) batchWords.add(w);
      }
    }
    // Find TM entries whose source shares any of these words
    for (const [src, tgt] of Object.entries(tmBySource)) {
      const srcWords = src.toLowerCase().split(/[^a-z]+/);
      for (const w of srcWords) {
        if (w.length >= 4 && batchWords.has(w)) {
          hints[src] = tgt;
          break;
        }
      }
    }
    return hints;
  }

  // Write batch files
  let totalUnits = 0;
  for (let i = 0; i < numBatches; i++) {
    const batchUnits = batches[i].sort((a, b) => {
      if (a.file !== b.file) return a.file.localeCompare(b.file);
      return a.line - b.line;
    });

    const tmHints = buildTmHints(batchUnits);

    const batchData = {
      batch: i + 1,
      start_index: startIndex,
      units: batchUnits,
      tm_hints: tmHints,
      cross_file_duplicates: [...crossFileDuplicates],
      instructions: [
        "If a unit's source exactly matches a key in tm_hints, REUSE that target verbatim.",
        "If a unit's source is in cross_file_duplicates, it appears in other batches too — choose a concise translation that other batches are likely to also pick.",
        "For similar phrases (e.g. 'Group name should start with a letter' vs 'Name should start with a letter'), prefer consistency with tm_hints over novel phrasing.",
      ],
    };

    const batchPath = join(I18N, `batch_${i + 1}.json`);
    writeFileSync(batchPath, JSON.stringify(batchData, null, 2));

    const fileCount = {};
    for (const u of batchUnits) fileCount[u.file] = (fileCount[u.file] || 0) + 1;

    console.log(`Batch ${i + 1}: ${batchUnits.length} units, ${Object.keys(tmHints).length} TM hints, files: ${Object.entries(fileCount).map(([f, c]) => `${f.split('/').pop()}(${c})`).join(', ')}`);
    totalUnits += batchUnits.length;
  }

  // Write pre-translated units to a separate file for collect() to merge
  if (preTranslated.length > 0) {
    writeFileSync(join(I18N, "batch_pretranslated.json"), JSON.stringify({
      units: preTranslated,
    }, null, 2));
    console.log(`\nPre-translated: ${preTranslated.length} units written to batch_pretranslated.json (will be applied in collect)`);
  }

  console.log(`\nTotal: ${totalUnits + preTranslatedCount} units in ${numBatches} batches (${preTranslatedCount} pre-translated, ${totalUnits} need translation)`);
  console.log(`\nNext step: dispatch 4 subagents to translate i18n/batch_1.json through i18n/batch_4.json`);
  console.log(`Each batch file contains tm_hints (existing translations to reuse) and cross_file_duplicates (sources appearing in multiple batches).`);
}

// --- COLLECT: Extract translations from modified source files ---

function collect() {
  const tm = readJson(join(I18N, "tm.json"));
  const progress = readJson(join(I18N, "progress.json"));
  const baseCommit = readFileSync(join(I18N, "base_commit.txt"), "utf8").trim();

  // Read all batch files
  const batchFiles = readdirSync(I18N).filter(f => f.match(/^batch_\d+\.json$/));
  if (batchFiles.length === 0) {
    console.error("No batch files found. Run 'prepare' first.");
    process.exit(1);
  }

  let allUnits = [];
  for (const bf of batchFiles) {
    const data = readJson(join(I18N, bf));
    allUnits.push(...data.units);
  }

  // Also include pre-translated units (from TM exact match)
  const pretranslatedPath = join(I18N, "batch_pretranslated.json");
  let preTranslatedUnits = [];
  if (existsSync(pretranslatedPath)) {
    preTranslatedUnits = readJson(pretranslatedPath).units || [];
    console.log(`Loaded ${preTranslatedUnits.length} pre-translated units`);
  }

  console.log(`Collecting translations for ${allUnits.length} units from ${batchFiles.length} batches (+ ${preTranslatedUnits.length} pre-translated)...`);

  let collected = 0;
  let skipped = 0;
  let notFound = 0;
  const newEntries = [];

  // First, apply pre-translated units (these already have a target from TM)
  // For each, write the translation into the source file at unit.line.
  let preApplied = 0;
  let preSkipped = 0;
  // Cache file contents to avoid re-reading for each unit
  const fileCache = {};
  function readFileCached(relPath) {
    if (!fileCache[relPath]) {
      const abs = join(ROOT, relPath);
      fileCache[relPath] = existsSync(abs) ? readFileSync(abs, "utf8") : null;
    }
    return fileCache[relPath];
  }
  function writeFileCached(relPath) {
    if (fileCache[relPath] !== null) {
      writeFileSync(join(ROOT, relPath), fileCache[relPath]);
    }
  }

  for (const unit of preTranslatedUnits) {
    const existing = tm.entries.find(e => e.id === unit.id && e.file === unit.file && e.line === unit.line);
    if (existing) {
      preSkipped++;
      continue;
    }

    const content = readFileCached(unit.file);
    if (content === null) {
      preSkipped++;
      continue;
    }
    const lines = content.split("\n");
    const line = lines[unit.line - 1] || "";

    // Skip if already translated (defensive — shouldn't happen for pre-translated)
    if (/[\u4e00-\u9fff]/.test(line)) {
      preSkipped++;
      continue;
    }

    // Apply translation: replace the English source in the line with the target.
    // Use a careful replacement that preserves surrounding syntax.
    const newLine = applyTranslationToLine(line, unit.source, unit.target, unit.type, unit.context_tag);
    if (newLine && newLine !== line) {
      lines[unit.line - 1] = newLine;
      fileCache[unit.file] = lines.join("\n");
      preApplied++;
    }

    newEntries.push({
      id: unit.id,
      source: unit.source,
      target: unit.target,
      file: unit.file,
      line: unit.line,
      type: unit.type,
      context_tag: unit.context_tag,
      reviewed: false,
      reviewed_by: null,
      model: "tm-reuse",
      upstream_commit: baseCommit,
      confidence: 1.0,
      skipped: false,
      reuse_from_tm: true,
    });
    collected++;
  }

  // Flush any file edits from pre-translation application
  const modifiedFiles = new Set(preTranslatedUnits.map(u => u.file));
  for (const f of modifiedFiles) writeFileCached(f);
  if (preApplied > 0) {
    console.log(`Pre-translated: applied ${preApplied} translations to ${modifiedFiles.size} source files (skipped ${preSkipped} already-done)`);
  }

  for (const unit of allUnits) {
    // Check if this unit is already in TM
    const existing = tm.entries.find(e => e.id === unit.id && e.file === unit.file && e.line === unit.line);
    if (existing) {
      // Already processed, skip
      continue;
    }

    // Read the source file line
    const filePath = join(ROOT, unit.file);
    if (!existsSync(filePath)) {
      console.warn(`  File not found: ${unit.file}`);
      notFound++;
      continue;
    }

    const content = readFileSync(filePath, "utf8");
    const lines = content.split("\n");
    const line = lines[unit.line - 1] || "";

    // Check if the line has been translated (contains Chinese characters)
    const hasChinese = /[\u4e00-\u9fff]/.test(line);

    if (hasChinese) {
      // Extract the translated string from the line
      let target = extractTranslatedString(line, unit);

      newEntries.push({
        id: unit.id,
        source: unit.source,
        target: target || "(translated in source)",
        file: unit.file,
        line: unit.line,
        type: unit.type,
        context_tag: unit.context_tag,
        reviewed: false,
        reviewed_by: null,
        model: "minimax-m3",
        upstream_commit: baseCommit,
        confidence: 0.9,
        skipped: false,
      });
      collected++;
    } else {
      // Check if this is a CSS variable or code identifier that should be skipped
      if (/^--[a-z]/i.test(unit.source) || /^[a-z][a-zA-Z0-9]*$/.test(unit.source) && !unit.source.includes(' ')) {
        newEntries.push({
          id: unit.id,
          source: unit.source,
          target: null,
          file: unit.file,
          line: unit.line,
          type: unit.type,
          context_tag: unit.context_tag,
          reviewed: false,
          reviewed_by: null,
          model: "minimax-m3",
          upstream_commit: baseCommit,
          confidence: 1.0,
          skipped: true,
          skip_reason: "Code identifier or CSS variable",
        });
        skipped++;
      } else {
        // Not translated yet — mark as pending
        notFound++;
      }
    }
  }

  // Merge new entries into TM
  tm.entries.push(...newEntries);

  // Update progress
  const lastUnit = allUnits[allUnits.length - 1];
  if (lastUnit) {
    progress.last_processed_id = lastUnit.id;
    progress.last_file = lastUnit.file;
    progress.last_line = lastUnit.line;
  }
  progress.completed_units = (progress.completed_units || 0) + collected + skipped;
  progress.total_units = readJson(join(I18N, "units.json")).total_units;
  progress.phase = "translation";

  // Add session history entry
  const today = new Date().toISOString().slice(0, 10);
  const sessionEntry = {
    date: today,
    units: collected + skipped,
    end_id: lastUnit ? lastUnit.id : progress.last_processed_id,
    notes: `Collected: ${collected} translated, ${skipped} skipped, ${notFound} not found. ${batchFiles.length} batches.`,
  };
  if (!progress.session_history) progress.session_history = [];
  progress.session_history.push(sessionEntry);

  // Write updated files
  writeFileSync(join(I18N, "tm.json"), JSON.stringify(tm, null, 2));
  writeFileSync(join(I18N, "progress.json"), JSON.stringify(progress, null, 2));

  console.log(`\n=== Collection Complete ===`);
  console.log(`  Translated:  ${collected}`);
  console.log(`  Skipped:     ${skipped}`);
  console.log(`  Not found:   ${notFound}`);
  console.log(`  TM entries:  ${tm.entries.length} total`);
  console.log(`  Progress:    ${progress.completed_units}/${progress.total_units} (${Math.round(progress.completed_units / progress.total_units * 100)}%)`);

  // Clean up batch files
  for (const bf of batchFiles) {
    unlinkSync(join(I18N, bf));
  }
  console.log(`  Cleaned up ${batchFiles.length} batch files`);

  // Clean up pre-translated file
  if (existsSync(join(I18N, "batch_pretranslated.json"))) {
    unlinkSync(join(I18N, "batch_pretranslated.json"));
    console.log(`  Cleaned up batch_pretranslated.json`);
  }
}

// Apply a translation to a source code line, preserving surrounding syntax.
// Returns the new line, or null if no safe replacement could be made.
function applyTranslationToLine(line, source, target, type, contextTag) {
  if (!source || !target) return null;
  // Don't apply if source contains placeholders that complicate replacement
  // (we handle only simple string sources here; complex ones go to subagents)
  if (source.includes("${") || source.includes("<%")) return null;

  const sourceEscaped = source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Replace exact source text with target, preserving case sensitivity.
  // Only replace the FIRST occurrence on this line to avoid surprises.
  const regex = new RegExp(sourceEscaped.replace(/\s+/g, "\\s+"));
  if (!regex.test(line)) return null;
  return line.replace(regex, target);
}

function extractTranslatedString(line, unit) {
  // Try to extract the translated string from the line based on the unit type
  if (unit.type === "html_text") {
    // For HTML text nodes, the translated text is between tags
    const match = line.match(/>\s*([\u4e00-\u9fff][^<]*)\s*</);
    if (match) return match[1].trim();
  }

  if (unit.type === "html_attr") {
    // For attributes like title="...", data-tip="..."
    const attrName = unit.context_tag;
    const match = line.match(new RegExp(`${attrName}\\s*=\\s*["']([^"']*[\u4e00-\u9fff][^"']*)["']`));
    if (match) return match[1];
  }

  if (unit.type === "ts_string") {
    // For JS/TS strings: tip("..."), alert("..."), name: "...", etc.
    // Try double-quoted string
    let match = line.match(/["']([^"']*[\u4e00-\u9fff][^"']*)["']/);
    if (match) return match[1];

    // Try template literal
    match = line.match(/`([^`]*[\u4e00-\u9fff][^`]*)`/);
    if (match) return match[1];
  }

  return null;
}

// --- Main ---

const args = process.argv.slice(2);
const command = args[0];

if (command === "prepare") {
  const count = parseInt(args[1]) || 120;
  prepare(count);
} else if (command === "collect") {
  collect();
} else {
  console.log("Usage:");
  console.log("  node batch_runner.mjs prepare <count>  — Generate batch files");
  console.log("  node batch_runner.mjs collect           — Collect translations, update tm.json");
}
