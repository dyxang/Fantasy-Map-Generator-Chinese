// batch_runner.mjs — Automated batch translation runner
// Usage:
//   node batch_runner.mjs prepare <count>              — Generate batch files + artifact sidecars from units.json
//   node batch_runner.mjs collect                       — Collect translations (prefer artifact sidecar, fallback to legacy)
//   node batch_runner.mjs collect-from-artifacts        — Collect translations from artifact sidecars
//   node batch_runner.mjs collect-legacy                — (Deprecated) Collect by scanning modified source files
//
// Workflow:
//   1. node batch_runner.mjs prepare 360                — Creates i18n/batch_N.json + i18n/artifacts/batch_N.json sidecars
//   2. Dispatch subagents to translate each batch; each subagent appends TranslationArtifact records to the sidecar
//   3. node batch_runner.mjs collect                     — Merges sidecars into tm.json + progress.json
//
// Layering:
//   - Standardized layer (this script): extract / prepare / collect-merge / validate — idempotent, no LLM
//   - Adaptive layer (subagents): translate / tm_hints selection — produces TranslationArtifact sidecars

import { readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync, mkdirSync } from "fs";
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
  let preTranslatedPlaceholderCount = 0;
  for (const u of batch) {
    if (tmBySource[u.source]) {
      const hasPlaceholder = u.source.includes("${") || u.source.includes("<%");
      if (hasPlaceholder) {
        // 含占位符的 source 不安全应用：记录到 batch_pretranslated.json（applied: false），
        // 同时放入 needTranslation 让 subagent 处理
        preTranslated.push({ ...u, target: tmBySource[u.source], applied: false });
        needTranslation.push(u);
        preTranslatedPlaceholderCount++;
      } else {
        preTranslated.push({ ...u, target: tmBySource[u.source], applied: true });
        preTranslatedCount++;
      }
    } else {
      needTranslation.push(u);
    }
  }
  if (preTranslatedCount > 0) {
    console.log(`Pre-translated ${preTranslatedCount} units from existing TM (exact source match)`);
  }
  if (preTranslatedPlaceholderCount > 0) {
    console.log(`Pre-translated ${preTranslatedPlaceholderCount} units skipped (contain placeholders, routed to subagent)`);
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

  // 确保 artifacts 目录存在（sidecar 文件的存放位置）
  const artifactsDir = join(I18N, "artifacts");
  mkdirSync(artifactsDir, { recursive: true });

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
        `每翻译完一个 unit（用 Edit 修改源文件后），向 i18n/artifacts/batch_${i + 1}.json 的 artifacts 数组追加一条记录`,
        "记录格式：{id, source, target, file, line_before, line_after, type, context_tag, model, confidence, applied}",
        "line_before 用 unit.line；line_after 是翻译后该 unit 在源文件中的实际行号（如果上方有行增减会漂移）",
        "model 填你实际使用的模型标识；confidence 填 0-1 自评；applied 填 true（已 Edit 应用）"
      ]
    };

    const batchPath = join(I18N, `batch_${i + 1}.json`);
    writeFileSync(batchPath, JSON.stringify(batchData, null, 2));

    // 创建空的 sidecar 文件，供 subagent 翻译时追加 artifact 记录
    const sidecarPath = join(artifactsDir, `batch_${i + 1}.json`);
    writeFileSync(sidecarPath, JSON.stringify({ batch: i + 1, artifacts: [] }, null, 2));

    const fileCount = {};
    for (const u of batchUnits) fileCount[u.file] = (fileCount[u.file] || 0) + 1;

    console.log(`Batch ${i + 1}: ${batchUnits.length} units, ${Object.keys(tmHints).length} TM hints, files: ${Object.entries(fileCount).map(([f, c]) => `${f.split("/").pop()}(${c})`).join(", ")}`);
    totalUnits += batchUnits.length;
  }

  // Write pre-translated units to a separate file for collect() to merge
  if (preTranslated.length > 0) {
    writeFileSync(join(I18N, "batch_pretranslated.json"), JSON.stringify({
      units: preTranslated
    }, null, 2));
    console.log(`\nPre-translated: ${preTranslated.length} units written to batch_pretranslated.json (will be applied in collect)`);
  }

  console.log(`\nTotal: ${totalUnits + preTranslatedCount} units in ${numBatches} batches (${preTranslatedCount} pre-translated, ${preTranslatedPlaceholderCount} placeholder-skipped, ${totalUnits} need translation)`);
  console.log(`\nNext step: dispatch ${numBatches} subagents to translate i18n/batch_1.json through i18n/batch_${numBatches}.json`);
  console.log(`Each batch file contains tm_hints (existing translations to reuse) and cross_file_duplicates (sources appearing in multiple batches).`);
  console.log(`Each subagent should append TranslationArtifact records to i18n/artifacts/batch_<N>.json as it translates.`);
}

// --- COLLECT-FROM-ARTIFACTS: Merge TranslationArtifact sidecars into tm.json ---

function collectFromArtifacts() {
  const tm = readJson(join(I18N, "tm.json"));
  const progress = readJson(join(I18N, "progress.json"));

  // 读取所有 artifact sidecar 文件（由 subagent 翻译时追加产出）
  const artifactsDir = join(I18N, "artifacts");
  if (!existsSync(artifactsDir)) {
    console.error("No artifacts directory found. Run 'prepare' first or use 'collect-legacy'.");
    process.exit(1);
  }
  const sidecarFiles = readdirSync(artifactsDir).filter(f => f.match(/^batch_\d+\.json$/));
  if (sidecarFiles.length === 0) {
    console.error("No artifact sidecar files found. Run 'prepare' first or use 'collect-legacy'.");
    process.exit(1);
  }

  let allArtifacts = [];
  for (const sf of sidecarFiles) {
    const data = readJson(join(artifactsDir, sf));
    allArtifacts.push(...data.artifacts);
  }

  console.log(`Collecting from ${allArtifacts.length} artifacts across ${sidecarFiles.length} sidecar files...`);

  let collected = 0;
  let skipped = 0;
  const newEntries = [];

  // 处理 pre-translated 单元（来自 TM 精确匹配，prepare 阶段写入 batch_pretranslated.json）
  // 镜像 collectLegacy 的处理逻辑：applied:true 写入源文件并加入 TM；applied:false 路由到 subagent
  const pretranslatedPath = join(I18N, "batch_pretranslated.json");
  let preTranslatedUnits = [];
  if (existsSync(pretranslatedPath)) {
    preTranslatedUnits = readJson(pretranslatedPath).units || [];
  }

  let preApplied = 0;
  let preSkipped = 0;
  // 文件内容缓存：多个 pre-translated 单元可能定位同一文件，避免重复读写
  const fileCache = {};
  function readFileCached(relPath) {
    if (!(relPath in fileCache)) {
      const abs = join(ROOT, relPath);
      fileCache[relPath] = existsSync(abs) ? readFileSync(abs, "utf8") : null;
    }
    return fileCache[relPath];
  }
  function writeFileCached(relPath) {
    // 仅写入被读取过（in cache）且文件存在（!== null）的内容；
    // 若某文件的所有单元都在读取前被 existing 检查跳过，缓存值为 undefined，不应写入
    if (relPath in fileCache && fileCache[relPath] !== null) {
      writeFileSync(join(ROOT, relPath), fileCache[relPath]);
    }
  }

  for (const unit of preTranslatedUnits) {
    // 含占位符的 source 跳过应用（prepare 标记 applied: false，路由到 subagent 流程）
    if (unit.applied === false) {
      console.log(`Pre-translate skipped (contains placeholders): ${unit.source} at ${unit.file}:${unit.line}`);
      preSkipped++;
      continue;
    }

    // existing 检查基于 (file, line, source) 三元组（不依赖 id），与 artifact 路径一致
    // 对 pre-translated 单元：line_before == line_after == unit.line（prepare 未修改文件）
    const existing = tm.entries.find(e =>
      e.file === unit.file &&
      e.line === unit.line &&
      e.source === unit.source
    );
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

    // 跳过已含中文的行（防御性 — pre-translated 一般不会发生）
    if (/[\u4e00-\u9fff]/.test(line)) {
      preSkipped++;
      continue;
    }

    // 应用翻译：在字符串字面量内做精确替换（锚定字面量边界）
    const newLine = applyTranslationToLiteral(line, unit.source, unit.target);
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
      skipped: false,
      reuse_from_tm: true
    });
    collected++;
  }

  // Flush pre-translation 文件写入
  const preModifiedFiles = new Set(preTranslatedUnits.map(u => u.file));
  for (const f of preModifiedFiles) writeFileCached(f);
  if (preTranslatedUnits.length > 0) {
    console.log(`Pre-translated: applied ${preApplied} translations to source files (skipped ${preSkipped})`);
  }

  for (const artifact of allArtifacts) {
    // existing 检查基于 (file, line_before, source) 三元组（不依赖 id）
    const existing = tm.entries.find(e =>
      e.file === artifact.file &&
      e.line === artifact.line_before &&
      e.source === artifact.source
    );
    if (existing) {
      skipped++;
      continue;
    }

    // target 来自 artifact.target，model 来自 artifact.model，confidence 来自 artifact.confidence
    // 不调用 extractTranslatedString，不读源文件
    newEntries.push({
      id: artifact.id,
      source: artifact.source,
      target: artifact.target,
      file: artifact.file,
      line: artifact.line_after || artifact.line_before,
      type: artifact.type,
      context_tag: artifact.context_tag,
      skipped: false
    });
    collected++;
  }

  // 合并到 TM
  tm.entries.push(...newEntries);

  // 更新 progress（last_processed_id 用最后一个 artifact 的 id）
  const lastArtifact = allArtifacts[allArtifacts.length - 1];
  if (lastArtifact) {
    progress.last_processed_id = lastArtifact.id;
    progress.last_file = lastArtifact.file;
    progress.last_line = lastArtifact.line_after;
  }
  progress.completed_units = (progress.completed_units || 0) + collected + skipped;
  progress.total_units = readJson(join(I18N, "units.json")).total_units;
  progress.phase = "translation";

  // Add session history entry
  const today = new Date().toISOString().slice(0, 10);
  const sessionEntry = {
    date: today,
    units: collected + skipped,
    end_id: lastArtifact ? lastArtifact.id : progress.last_processed_id,
    notes: `Collected from artifacts: ${collected} translated, ${skipped} skipped, ${preApplied} pre-translated. ${sidecarFiles.length} sidecar files.`
  };
  if (!progress.session_history) progress.session_history = [];
  progress.session_history.push(sessionEntry);

  // 写入状态文件（标准化层独占）
  writeFileSync(join(I18N, "tm.json"), JSON.stringify(tm, null, 2));
  writeFileSync(join(I18N, "progress.json"), JSON.stringify(progress, null, 2));

  console.log(`\n=== Collection from Artifacts Complete ===`);
  console.log(`  Translated:  ${collected}`);
  console.log(`  Skipped:     ${skipped}`);
  console.log(`  TM entries:  ${tm.entries.length} total`);
  console.log(`  Progress:    ${progress.completed_units}/${progress.total_units} (${Math.round(progress.completed_units / progress.total_units * 100)}%)`);

  // 清理 sidecar 文件
  for (const sf of sidecarFiles) {
    unlinkSync(join(artifactsDir, sf));
  }
  console.log(`  Cleaned up ${sidecarFiles.length} sidecar files`);

  // 也清理 batch_N.json 文件
  const batchFiles = readdirSync(I18N).filter(f => f.match(/^batch_\d+\.json$/));
  for (const bf of batchFiles) {
    unlinkSync(join(I18N, bf));
  }
  if (batchFiles.length > 0) {
    console.log(`  Cleaned up ${batchFiles.length} batch files`);
  }

  // 清理 batch_pretranslated.json（pretranslatedPath 在上方 pre-translated 处理块已声明）
  if (existsSync(pretranslatedPath)) {
    unlinkSync(pretranslatedPath);
    console.log(`  Cleaned up batch_pretranslated.json`);
  }
}

// --- COLLECT-LEGACY: Fallback path, scans modified source files ---
// @deprecated 使用 collect-from-artifacts 替代。保留作为无 sidecar 时的降级路径。

function collectLegacy() {
  const tm = readJson(join(I18N, "tm.json"));
  const progress = readJson(join(I18N, "progress.json"));

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
    // 含占位符的 source 跳过应用（已在 prepare 中标记 applied: false，路由到 subagent 流程）
    if (unit.applied === false) {
      console.log(`Pre-translate skipped (contains placeholders): ${unit.source} at ${unit.file}:${unit.line}`);
      preSkipped++;
      continue;
    }

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

    // Apply translation: 在字符串字面量内做精确替换（锚定字面量边界）
    const newLine = applyTranslationToLiteral(line, unit.source, unit.target);
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
      skipped: false,
      reuse_from_tm: true
    });
    collected++;
  }

  // Flush any file edits from pre-translation application
  const modifiedFiles = new Set(preTranslatedUnits.map(u => u.file));
  for (const f of modifiedFiles) writeFileCached(f);
  if (preApplied > 0) {
    console.log(`Pre-translated: applied ${preApplied} translations to ${modifiedFiles.size} source files (skipped ${preSkipped})`);
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
        skipped: false
      });
      collected++;
    } else {
      // Check if this is a CSS variable or code identifier that should be skipped
      if (/^--[a-z]/i.test(unit.source) || /^[a-z][a-zA-Z0-9]*$/.test(unit.source) && !unit.source.includes(" ")) {
        newEntries.push({
          id: unit.id,
          source: unit.source,
          target: null,
          file: unit.file,
          line: unit.line,
          type: unit.type,
          context_tag: unit.context_tag,
          skipped: true,
          skip_reason: "Code identifier or CSS variable"
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
    notes: `Collected: ${collected} translated, ${skipped} skipped, ${notFound} not found. ${batchFiles.length} batches.`
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

// --- COLLECT: Dispatcher, prefer artifact path, fallback to legacy ---

function collect() {
  const artifactsDir = join(I18N, "artifacts");
  const hasSidecars = existsSync(artifactsDir) &&
    readdirSync(artifactsDir).some(f => f.match(/^batch_\d+\.json$/));
  if (hasSidecars) {
    console.log("Found artifact sidecars, using collect-from-artifacts path.");
    collectFromArtifacts();
  } else {
    console.warn("No artifact sidecars found, falling back to collect-legacy.");
    collectLegacy();
  }
}

// 在字符串字面量内做精确替换（source → target）
// 匹配三种字面量："..."、'...'、`...`
// 仅当 source 是字面量的完整内容时才替换，避免子串误匹配（如 "Add" 误匹配 "Added"）
// 如果一行有多个字面量含该 source，只替换第一个
function applyTranslationToLiteral(line, source, target) {
  if (!source || !target) return null;
  // 转义 source 的正则元字符
  const sourceEscaped = source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // 转义 target 中的 $（replace 替换字符串中 $ 有特殊含义）
  const targetEscaped = target.replace(/\$/g, "$$$$");
  // 匹配：引号 + source + 相同引号（backreference 确保引号配对）
  const regex = new RegExp(`(["'\`])${sourceEscaped}\\1`);
  // replace 默认只替换第一个匹配
  return line.replace(regex, `$1${targetEscaped}$1`);
}

/** @deprecated 使用 collect-from-artifacts 替代。保留用于 collect-legacy 降级路径。 */
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
  const count = parseInt(args[1], 10) || 120;
  prepare(count);
} else if (command === "collect") {
  collect();
} else if (command === "collect-from-artifacts") {
  collectFromArtifacts();
} else if (command === "collect-legacy") {
  collectLegacy();
} else {
  console.log("Usage:");
  console.log("  node batch_runner.mjs prepare <count>              — Generate batch files + artifact sidecars");
  console.log("  node batch_runner.mjs collect                       — Collect (prefer artifacts, fallback to legacy)");
  console.log("  node batch_runner.mjs collect-from-artifacts        — Collect from artifact sidecars");
  console.log("  node batch_runner.mjs collect-legacy                — (Deprecated) Collect by scanning source files");
}
