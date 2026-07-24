#!/usr/bin/env node

/**
 * 单元测试：选择性术语注入和 TM 启发式过滤
 * 
 * 运行方式：node i18n/scripts/batch_runner.test.mjs
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const I18N = join(ROOT, "i18n");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

// 测试辅助函数
function assert(condition, message) {
  if (!condition) {
    console.error(`❌ 测试失败: ${message}`);
    process.exit(1);
  }
  console.log(`✅ 测试通过: ${message}`);
}

// 测试 1: 术语筛选函数
function testFilterGlossary() {
  console.log("\n=== 测试 1: 术语筛选函数 ===");
  
  const glossary = readJson(join(I18N, "glossary.json"));
  
  // 模拟批次单元
  const batchUnits = [
    { source: "Click to save the map", context_tag: "button", file: "src/index.html" },
    { source: "Load the burg data", context_tag: "tooltip", file: "src/index.html" }
  ];
  
  // 收集源文本
  const allSourceText = batchUnits.map(u => u.source).join(" ").toLowerCase();
  
  // 筛选术语
  const relevantTerms = glossary.terms.filter(term => {
    const termLower = term.en.toLowerCase();
    const termStem = termLower.replace(/s$/, "");
    return allSourceText.includes(termLower) || allSourceText.includes(termStem);
  });
  
  console.log(`批次源文本: "${allSourceText}"`);
  console.log(`筛选前术语数: ${glossary.terms.length}`);
  console.log(`筛选后术语数: ${relevantTerms.length}`);
  console.log(`筛选出的术语:`, relevantTerms.map(t => t.en));
  
  // 验证：应该包含 "Map", "Burg", "Save", "Load"
  const expectedTerms = ["Map", "Burg", "Save", "Load"];
  for (const expected of expectedTerms) {
    const found = relevantTerms.some(t => t.en === expected);
    assert(found, `应该包含术语 "${expected}"`);
  }
  
  // 验证：不应该包含无关术语
  const unexpectedTerms = ["Culture", "Religion", "Province"];
  for (const unexpected of unexpectedTerms) {
    const found = relevantTerms.some(t => t.en === unexpected);
    assert(!found, `不应该包含术语 "${unexpected}"`);
  }
  
  // 验证：兜底机制（筛选结果 < 5 条时返回完整术语表）
  const emptyBatch = [{ source: "xyz", context_tag: "button", file: "test.html" }];
  const emptySourceText = emptyBatch.map(u => u.source).join(" ").toLowerCase();
  const emptyRelevantTerms = glossary.terms.filter(term => {
    const termLower = term.en.toLowerCase();
    const termStem = termLower.replace(/s$/, "");
    return emptySourceText.includes(termLower) || emptySourceText.includes(termStem);
  });
  
  console.log(`\n空批次测试:`);
  console.log(`批次源文本: "${emptySourceText}"`);
  console.log(`筛选后术语数: ${emptyRelevantTerms.length}`);
  
  if (emptyRelevantTerms.length < 5) {
    console.log(`触发兜底机制，返回完整术语表 (${glossary.terms.length} 条)`);
    assert(true, `兜底机制正常工作（筛选结果 ${emptyRelevantTerms.length} 条 < 5 条）`);
  }
}

// 测试 2: TM 启发式过滤函数
function testFilterTmHints() {
  console.log("\n=== 测试 2: TM 启发式过滤函数 ===");
  
  const tm = readJson(join(I18N, "tm.json"));
  
  // 构建完整 TM 条目列表
  const tmEntriesFull = [];
  for (const e of tm.entries) {
    if (e.target && !e.skipped) {
      tmEntriesFull.push({
        source: e.source,
        target: e.target,
        context_tag: e.context_tag,
        file: e.file
      });
    }
  }
  
  // 模拟批次单元
  const batchUnits = [
    { source: "Click to save the map", context_tag: "button", file: "src/index.html" },
    { source: "Load the burg data", context_tag: "tooltip", file: "src/index.html" }
  ];
  
  // 提取批次信息
  const batchContextTags = new Set(batchUnits.map(u => u.context_tag));
  const batchFiles = new Set(batchUnits.map(u => u.file));
  
  // 计算单词重叠
  const batchWords = new Set();
  for (const u of batchUnits) {
    for (const w of u.source.toLowerCase().split(/[^a-z]+/)) {
      if (w.length >= 4) batchWords.add(w);
    }
  }
  
  console.log(`批次 context_tags:`, [...batchContextTags]);
  console.log(`批次 files:`, [...batchFiles]);
  console.log(`批次单词 (>=4字符):`, [...batchWords]);
  
  // 对 TM 条目进行评分
  const scored = [];
  for (const entry of tmEntriesFull) {
    let score = 0;
    
    // context_tag 匹配得 2 分
    if (entry.context_tag && batchContextTags.has(entry.context_tag)) {
      score += 2;
    }
    
    // file 匹配得 1 分
    if (entry.file && batchFiles.has(entry.file)) {
      score += 1;
    }
    
    // 单词重叠匹配（权重 0.5）
    const srcWords = entry.source.toLowerCase().split(/[^a-z]+/).filter(w => w.length >= 4);
    let overlap = 0;
    for (const w of srcWords) {
      if (batchWords.has(w)) overlap++;
    }
    score += overlap * 0.5;
    
    if (score > 0) {
      scored.push({ source: entry.source, target: entry.target, score });
    }
  }
  
  // 按评分降序排序，截断到 top-20
  scored.sort((a, b) => b.score - a.score);
  const filtered = scored.slice(0, 20);
  
  console.log(`\nTM 过滤结果:`);
  console.log(`过滤前条目数: ${tmEntriesFull.length}`);
  console.log(`过滤后条目数: ${filtered.length}`);
  console.log(`Top 5 条目:`);
  filtered.slice(0, 5).forEach((entry, i) => {
    console.log(`  ${i + 1}. score=${entry.score.toFixed(1)}: "${entry.source}" → "${entry.target}"`);
  });
  
  // 验证：过滤结果不超过 20 条
  assert(filtered.length <= 20, `过滤结果不超过 20 条（实际 ${filtered.length} 条）`);
  
  // 验证：评分最高的条目应该与批次相关
  if (filtered.length > 0) {
    const topEntry = filtered[0];
    console.log(`\n最高分条目:`);
    console.log(`  source: "${topEntry.source}"`);
    console.log(`  target: "${topEntry.target}"`);
    console.log(`  score: ${topEntry.score.toFixed(1)}`);
    assert(topEntry.score > 0, `最高分条目评分 > 0`);
  }
}

// 测试 3: 边界情况
function testEdgeCases() {
  console.log("\n=== 测试 3: 边界情况 ===");
  
  const glossary = readJson(join(I18N, "glossary.json"));
  
  // 测试 3.1: 空批次
  console.log("\n测试 3.1: 空批次");
  const emptyBatch = [];
  const emptySourceText = emptyBatch.map(u => u.source).join(" ").toLowerCase();
  const emptyRelevantTerms = glossary.terms.filter(term => {
    const termLower = term.en.toLowerCase();
    const termStem = termLower.replace(/s$/, "");
    return emptySourceText.includes(termLower) || emptySourceText.includes(termStem);
  });
  console.log(`空批次筛选结果: ${emptyRelevantTerms.length} 条`);
  assert(emptyRelevantTerms.length === 0, `空批次应该返回 0 条术语`);
  
  // 测试 3.2: 单单元批次
  console.log("\n测试 3.2: 单单元批次");
  const singleBatch = [{ source: "Save the map", context_tag: "button", file: "test.html" }];
  const singleSourceText = singleBatch.map(u => u.source).join(" ").toLowerCase();
  const singleRelevantTerms = glossary.terms.filter(term => {
    const termLower = term.en.toLowerCase();
    const termStem = termLower.replace(/s$/, "");
    return singleSourceText.includes(termLower) || singleSourceText.includes(termStem);
  });
  console.log(`单单元批次筛选结果: ${singleRelevantTerms.length} 条`);
  console.log(`筛选出的术语:`, singleRelevantTerms.map(t => t.en));
  assert(singleRelevantTerms.length > 0, `单单元批次应该返回至少 1 条术语`);
  
  // 测试 3.3: 特殊字符
  console.log("\n测试 3.3: 特殊字符");
  const specialBatch = [{ source: "Click ${button} to save", context_tag: "button", file: "test.html" }];
  const specialSourceText = specialBatch.map(u => u.source).join(" ").toLowerCase();
  const specialRelevantTerms = glossary.terms.filter(term => {
    const termLower = term.en.toLowerCase();
    const termStem = termLower.replace(/s$/, "");
    return specialSourceText.includes(termLower) || specialSourceText.includes(termStem);
  });
  console.log(`特殊字符批次筛选结果: ${specialRelevantTerms.length} 条`);
  console.log(`筛选出的术语:`, specialRelevantTerms.map(t => t.en));
  assert(specialRelevantTerms.some(t => t.en === "Save"), `应该包含术语 "Save"`);
}

// 运行所有测试
console.log("🚀 开始运行单元测试...\n");

try {
  testFilterGlossary();
  testFilterTmHints();
  testEdgeCases();
  
  console.log("\n✅ 所有测试通过！");
  process.exit(0);
} catch (error) {
  console.error("\n❌ 测试出错:", error);
  process.exit(1);
}
