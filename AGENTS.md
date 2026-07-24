Azgaar's Fantasy Map Generator is a web application for procedurally generating, editing, and visualizing fantasy maps. Before making architectural decisions, read the `CONTEXT.md` file in the root.

For deeper knowledge, consult the `docs/` directory, especially `docs/domain/glossary.md`, `docs/architecture/architecture.md` and `docs/architecture/data_model.md`.

## 翻译工作流（zh-CN 汉化）

zh-CN 是独立翻译分支，不 PR 不 merge 出去。开始任何翻译或上游同步任务前，**必须先读**以下文档：

- `i18n/CONTEXT.md` — 项目背景、翻译原则、翻译管线分层架构、上游同步工具链总览
- `i18n/README.md` — 工具脚本快速开始、目录结构、验证检查项
- `.trae/rules/localization.rules.md` — 翻译会话常驻规则（两层架构、写入所有权、subagent 契约、同步流程）
- `.claude/artifacts/designs/sync-tools-design.md` — 上游同步工具链的完整设计与决策记录（reset+replay、AST 替换、manual-marks、pending 中转区）

工具脚本位于 `i18n/scripts/`，依赖见 `i18n/scripts/package.json`（首次使用前 `cd i18n/scripts && npm install`）。
