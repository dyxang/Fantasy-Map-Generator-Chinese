# Fantasy Map Generator 汉化上下文

## 项目介绍

Azgaar's Fantasy Map Generator 是一个程序化生成、编辑和可视化奇幻地图的 Web 应用，面向小说作家、跑团玩家和制图师。用户可以生成地形、文化、国家、河流、宗教、军事等要素，并导出为图片或数据文件。

## 读者画像

- **跑团玩家**：DnD / Pathfinder 等桌游 GM，需要快速生成世界地图
- **奇幻小说作者**：需要为虚构世界构建地理参考
- **制图师**：对地图美学和细节有要求
- **世界观构建爱好者**：喜欢精细调整每个参数

## 翻译原则

### 术语风格
- 术语偏向 DnD / 奇幻文学通行译法
- Burg → 城镇（settlement 语境）
- State → 国家（political entity 语境，不译为"州"）
- Province → 省份
- Culture → 文化
- Religion → 宗教
- Biome → 生物群系
- Heightmap → 高度图
- Emblem → 纹章
- Marker → 标记
- Zone → 区域

### 格式规则
- UI 按钮文案 ≤4 字，长描述用完整句
- 数字 / 单位 / 坐标 / 百分比不译
- 人名、地名生成器产物不译（动态生成）
- 品牌名 Azgaar 不译
- 占位符 `{{xxx}}` `<%xxx%>` `${xxx}` `%s` 必须原样保留

### 不译内容
- 变量名、函数名、CSS 类名
- SVG 路径数据（d 属性值）
- data-* 属性的键名（值可译）
- URL、文件路径
- 枚举值（如 state.form 的 "Monarchy"、"Republic"）

### 上下文区分
- 同一英文在不同上下文可有不同译法
- `context_tag` 区分：button / label / tooltip / heading / option / description
- 翻译时注入前后 3 个单元作上下文参考

## 技术约束

- `src/index.html` 是 ~9000 行的巨型 UI 文件，按 section（对话框/选项卡）切片处理
- 项目处于 vanilla JS → TS + Vite 迁移期，文件结构会变动
- TM（翻译记忆）按内容 SHA-256 索引，不按文件路径，以应对文件移动
- Biome lint 强制双引号、无尾逗号、120 行宽

## 与原版的故意差异

（翻译过程中如有产品决策层面的定制差异，记录到 `i18n/divergence.json`）
