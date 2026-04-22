# 本地 AI 兵工厂操作手册

目标：在没有 VPS 和 Strapi 的阶段，先用本地 AI 生成结构化情报文章，并安全写入当前 Vercel 前端项目。

## 1. 当前阶段架构

```text
资料/选题
  -> AI 生成结构化 JSON
  -> 本地 schema 校验
  -> 写入 content/insights.ts
  -> npm run build
  -> git push
  -> Vercel 自动部署
```

后续有 VPS/Strapi 后，最后一步会从“写入 `content/insights.ts`”替换为“POST 到 Strapi Read/Write API”。

## 2. 文件结构

```text
local-brain/
  drafts/                  AI 输出的文章 JSON 草稿
  prompts/                 Agent prompt
  schema/                  文章 JSON schema

scripts/local-brain/
  validate-insight.mjs     校验文章 JSON
  add-insight.mjs          校验并写入 content/insights.ts
  add-insights-batch.mjs   批量校验并写入多篇文章
```

## 3. 标准工作流

### 可视化控制台

如果你不想敲命令，直接双击：

```text
start-local-brain-ui.bat
```

浏览器会打开本地控制台：

```text
http://127.0.0.1:8501
```

控制台支持：

```text
输入种子词 -> 批量生成草稿 -> 审阅文章 -> Fail-Safe 校验 -> 发布到 GitHub/Vercel
```

打开后先看 `0. 工作流可视化`，可以看到 LangGraph 状态机图，并点击“启动工作流”观察 Reviewer 如何把高危初稿打回 Writer 重写。

当前多智能体流程由 LangGraph StateGraph 编排：

```text
Researcher Agent -> Writer Agent -> Reviewer Agent
                         ^             |
                         |             v
                    高危词命中 <- 条件边打回重写
```

说明：LangGraph 官方 Python 包要求 Python 3.10+。本项目的启动脚本会自动创建 `.venv-local-brain`，优先使用 Codex 自带 Python 3.12，并安装 Streamlit 与 LangGraph。

如果提示没有 Streamlit，先执行：

```bash
powershell -ExecutionPolicy Bypass -File scripts/ensure-local-brain-env.ps1
```

### 本地生产线用法

如果你只是输入一个种子词，直接生成合规情报草稿：

```bash
powershell -ExecutionPolicy Bypass -File scripts/run-local-brain.ps1 -Seed "智能宠物喂食器"
```

指定草稿输出目录：

```bash
powershell -ExecutionPolicy Bypass -File scripts/run-local-brain.ps1 -Seed "智能宠物喂食器" -DraftDir "local-brain/drafts"
```

如果你要批量生产，先复制：

```text
local-brain/seeds.example.txt
```

为：

```text
local-brain/seeds.txt
```

然后把每个种子词一行写进去，再双击：

```text
run-local-brain.bat
```

本地生产线会执行：

```text
种子词 -> 本地情报画像 -> 红线审计 -> 内容铸造 -> Fail-Safe 校验 -> 生成 JSON 草稿
```

默认只生成草稿，不自动上线。确认草稿无误后，再双击：

```text
publish-insights.bat
```

如果你确认要生成后立刻发布，可以执行：

```bash
powershell -ExecutionPolicy Bypass -File scripts/run-local-brain.ps1 -Seed "智能宠物喂食器" -Publish
```

### 最简单用法

把 AI 生成的文章 JSON 放进：

```text
local-brain/drafts/
```

然后双击项目根目录的：

```text
publish-insights.bat
```

脚本会自动完成：

```text
检查草稿 -> 导入网站 -> npm run build -> git commit -> git push -> Vercel 自动部署
```

如果你想在命令行执行：

```bash
powershell -ExecutionPolicy Bypass -File scripts/publish-insights.ps1
```

只提交不推送：

```bash
powershell -ExecutionPolicy Bypass -File scripts/publish-insights.ps1 -NoPush
```

只检查草稿，不写入网站：

```bash
powershell -ExecutionPolicy Bypass -File scripts/publish-insights.ps1 -CheckOnly
```

如果工作区有其它未提交改动，脚本会停止，避免把无关内容一起发布。

### 手动分步用法

1. 准备原始资料。
2. 使用 `local-brain/prompts/insight-agent-prompt.md` 让 AI 输出 JSON。
3. 保存到：

```text
local-brain/drafts/your-article-slug.json
```

4. 校验：

```bash
npm run brain:validate -- local-brain/drafts/your-article-slug.json
```

5. 写入网站：

```bash
npm run brain:add -- local-brain/drafts/your-article-slug.json
```

6. 如果一次生成多篇文章，可以批量导入：

```bash
npm run brain:add-batch -- local-brain/drafts
```

批量导入会先校验全部 JSON；只要有一篇不合格，就不会写入任何文章。已经存在的 slug 会被跳过，方便重复执行。

正式写入前可以先干跑检查：

```bash
npm run brain:add-batch -- --dry-run local-brain/drafts
```

7. 构建验证：

```bash
npm run build
```

8. 提交上线：

```bash
git add .
git commit -m "Add insight article: your article title"
git push
```

## 4. 内容规则

- 不在前台文案中提 AI、自动化、爬虫或内部流程。
- 文章定位是合规情报，不是法律意见。
- 每篇文章必须有唯一 slug。
- 每篇文章必须有中英文标题、摘要和正文段落。
- 高风险内容先人工审阅，再上线。
- 低置信度内容不能直接进入网站。

## 5. 分类

当前允许的分类：

```text
Payment Risk
Marketplace Appeal
Market Entry
Supply Chain
IP Defense
Crisis PR
Capital Documents
B2B Contracts
Tax & Audit
Data Privacy
```

## 6. 上线后结果

新增文章会自动出现在：

```text
/insights
/insights/{slug}
/sitemap.xml
```

Vercel 会在 `git push` 后自动重新部署。
