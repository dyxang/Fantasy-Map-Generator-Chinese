# Fantasy Map Generator 汉化规则

> 本文件是 Trae IDE 的常驻记忆，每次翻译会话自动加载。

## 会话开始时（必做）

1. 读 `i18n/progress.json` 获取上次进度（last_processed_id 之后继续）
2. 读 `i18n/CONTEXT.md` 了解项目背景与翻译原则
3. 读 `i18n/glossary.json` 拿术语表（翻译前查表）
4. 读 `i18n/tm.json` 的最近 20 条译文作风格锚点
5. 读 `i18n/divergence.json` 确认哪些片段不可覆盖

## 翻译单元处理

### 批量大小
- 每会话处理 30-50 个单元（从 progress.json 的 last_processed_id 之后）
- 单次 Read 不超过 2000 行

### 上下文注入（每个单元）
- source 文本
- 前后各 3 个翻译单元（提供上下文连贯性）
- TM 中相似条目 top-5（source 相似度匹配）
- glossary.json 中相关术语

### 输出格式
- 直接用 Edit 工具修改原文件（文本节点 / 属性值）
- 在 `i18n/tm.json` 追加翻译条目
- 更新 `i18n/progress.json` 的 last_processed_id 和 completed_units

## 翻译单元结构（tm.json entry）

```json
{
  "id": "sha256:abc123...",
  "source": "Generate new map",
  "target": "生成新地图",
  "file": "src/index.html",
  "line": 1234,
  "type": "html_text | html_attr | ts_string",
  "context_tag": "button | label | tooltip | heading | option | description",
  "reviewed": false,
  "reviewed_by": null,
  "model": null,
  "upstream_commit": "51d8e3e...",
  "confidence": 0.95
}
```

## 硬约束（不可违反）

### 占位符保护
- `{{xxx}}` `<%xxx%>` `${xxx}` `%s` `%d` 必须原样保留，数量和位置不得改变

### HTML 结构保护
- 标签名、属性名、id、class 不得改动
- 只能修改：文本节点内容、`title` / `placeholder` / `aria-label` / `alt` / `data-tip` / `data-info` 属性的值
- `<script>` 和 `<style>` 内容不译
- 内联 SVG 的 `d` 属性（路径数据）不译

### TS/JS 字符串保护
- 字符串字面量只改内容，不改引号类型（单/双/反引号）
- 不改转义字符
- 模板字面量中的 `${...}` 占位符必须保留

### 不译内容
- 变量名、函数名、CSS 类名
- SVG 路径数据
- URL、文件路径
- 数字、单位、坐标、百分比
- 枚举值（如 state.form 的 "Monarchy"、"Republic"）
- 人名、地名生成器产物（动态生成）
- 品牌名 Azgaar

### 差异保护
- `divergence.json` 中的 `anchor_text` 命中即跳过，不覆盖

## HTML 切片策略

`src/index.html` 是 ~9000 行巨型文件，按 section 切片处理：
- 每个对话框（dialog）一个 section
- 每个选项卡（tab）一个 section
- 处理时用 `Read` 的 offset/limit 参数读取对应行范围
- 处理完一个 section 再移到下一个

## 会话结束前（必做）

1. 更新 `i18n/progress.json`：
   - `last_processed_id` → 本次最后处理的单元 id
   - `last_file` 和 `last_line` → 本次最后处理的文件和行号
   - `completed_units` → 累计已完成数
   - `session_history` 追加本次记录：`{"date": "YYYY-MM-DD", "units": N, "end_id": "sha256:xxx", "notes": "处理了哪些面板"}`
2. 将本次翻译追加到 `i18n/tm.json` 的 `entries` 数组
3. 若发现新术语，追加到 `i18n/glossary.json` 的 `terms` 数组
4. 输出状态摘要："本次翻译 N 个单元，累计 M / Total，剩余 K 个单元，建议下次开新会话"

## 上下文窗口策略

- 单元平均 ~50 tokens × 30 = 1500 tokens
- 加注入（上下文 + glossary + TM）约 5K tokens
- 若上下文接近上限，主动结束会话前 flush progress
- 不要一次读取整个 index.html，按 section 切片

## 增量同步流程（上游更新时）

1. 用户运行 `node i18n/scripts/sync.mjs`
2. 读 `i18n/pending.json`，处理待译单元
3. 每个单元的 action：`translate`（新文本）/ `retranslate`（语义变更）/ `skip`（非语义变更或 divergence 命中）/ `delete`（已删除）
4. 处理完后运行 `node i18n/scripts/validate.mjs`
5. 验证通过后 `git merge upstream/master` + 更新 `i18n/base_commit.txt`
