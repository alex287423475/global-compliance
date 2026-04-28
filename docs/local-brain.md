# Local Brain 合规文章自动化生产线

目标：在没有 VPS / Strapi 的阶段，先用本地多智能体生产合规长文草稿，写入当前 Next.js 网站内容源，再通过 GitHub + Vercel 发布到 `https://www.qqbytran.com/insights`。

## 当前形态

Local Brain 已经不再使用 Streamlit。

现在它和 SEO 文章自动生产线使用同样的技术栈与工作台架构：

- Next.js App Router 前端工作台
- Next.js API Route 作为本地控制层
- Python 生成器负责 Researcher / Writer / Reviewer
- 本地 `status.json` 轮询展示后台任务进度
- 草稿池 -> 校验 -> 发布中心 -> GitHub -> Vercel

入口页面：

```text
http://127.0.0.1:3000/local-brain
```

线上发布目标：

```text
https://www.qqbytran.com/insights
```

## 目录结构

```text
app/local-brain/page.tsx                  Local Brain 工作台页面
components/workflow/LocalBrainDashboard.tsx
app/api/local-brain/status/route.ts       轮询状态
app/api/local-brain/run/route.ts          启动后台任务
app/api/local-brain/drafts/route.ts       草稿池
app/api/local-brain/materials/route.ts    手动资料包上传
app/api/local-brain/config/route.ts       LLM 配置读写
app/api/local-brain/config/test/route.ts  LLM 连通性测试

lib/local-brain-core.ts                   本地工作台共享工具
scripts/local-brain/generate-insight.py   多智能体文章生成器
scripts/local-brain/orchestrate.mjs       后台任务编排器
scripts/local-brain/validate-insight.mjs  单篇草稿校验
scripts/local-brain/add-insight.mjs       单篇导入 content/insights.ts
scripts/local-brain/add-insights-batch.mjs
scripts/publish-insights.ps1              批量发布到网站

local-brain/drafts/                       草稿 JSON
local-brain/audits/                       审计轨迹
local-brain/materials/                    手动资料包
local-brain/runtime/status.json           前端轮询状态文件
local-brain/config.json                   本地 LLM 配置
```

## 工作流

### 1. 知识库自动生产

适合直接基于本地默认知识库运行：

```text
local-brain/knowledge/
local-brain/reviews/
```

流程：

```text
种子词
  -> Researcher 汇总红线 / VOC / 证据线索
  -> Writer 生成长文草稿 + intelligence cards
  -> Reviewer 审核红线词、承诺语和语气
  -> Fail-Safe 校验 JSON / Markdown / FAQ / 表格
  -> 写入 local-brain/drafts
```

### 2. 手动资料导入

适合某个专题要临时追加资料。

可在 `/local-brain` 页面上传三类材料：

- 红线 / 合规资料
- VOC / 投诉资料
- 事实源 / 证据资料

上传后会生成一个“资料包”，后台任务不再让前端拼本地路径，而是由服务端按 `packageId` 自动解析目录并注入生成器。

## LLM 配置

配置入口：

```text
/local-brain 页面底部的“模型配置”
```

配置写入：

```text
local-brain/config.json
```

优先级：

1. `/local-brain` 页面保存的配置
2. 环境变量

支持提供商：

```text
OpenAI   -> https://api.openai.com/v1
Claude   -> https://api.anthropic.com/v1/
Gemini   -> https://generativelanguage.googleapis.com/v1beta/openai/
DeepSeek -> https://api.deepseek.com
```

说明：

- 没有 API Key 时，生产线会硬阻断
- 禁止无 LLM 干跑
- “测试模型连接”只做轻量连通性探针，不会启动整条生产线

## 页面使用方式

### 1. 打开本地工作台

先启动站点：

```bash
npm run dev
```

然后进入：

```text
http://127.0.0.1:3000/local-brain
```

### 2. 输入种子词

每行一个：

```text
智能宠物喂食器
Amazon POA root cause
PayPal chargeback evidence
```

### 3. 可选：补充运营备注

例如：

- 目标市场
- 必须规避的表达
- 平台通知摘要
- 希望强调的风险角度

### 4. 运行文章生产

页面会实时显示：

```text
RUNNING / IDLE
当前步骤
Recent Log
```

后台任务状态来自：

```text
local-brain/runtime/status.json
```

### 5. 校验草稿

生成完成后，草稿会进入“草稿池”。

你可以：

- 勾选部分草稿
- 或直接校验全部待发布草稿

校验命令底层仍然是：

```bash
npm run brain:add-batch -- --dry-run local-brain/drafts
```

### 6. 发布到网站

在“发布中心”输入：

```text
PUBLISH
```

然后执行发布。

底层流程：

```text
选中的 draft JSON
  -> 导入 content/insights.ts
  -> next build
  -> git commit
  -> git push
  -> Vercel 自动更新 qqbytran.com
```

如果只想本地提交，不想推 GitHub，可勾选：

```text
只做本地 commit，不推送 GitHub
```

## 命令行兜底

如果不走工作台，也可以直接用命令：

### 生成单篇

```bash
powershell -ExecutionPolicy Bypass -File scripts/run-local-brain.ps1 -Seed "智能宠物喂食器"
```

### 发布全部草稿

```bash
powershell -ExecutionPolicy Bypass -File scripts/publish-insights.ps1
```

### 只检查，不发布

```bash
powershell -ExecutionPolicy Bypass -File scripts/publish-insights.ps1 -CheckOnly
```

### 只 commit，不 push

```bash
powershell -ExecutionPolicy Bypass -File scripts/publish-insights.ps1 -NoPush
```

## 输出物

生成后主要会得到两类文件：

### 草稿

```text
local-brain/drafts/<slug>.json
```

### 审计轨迹

```text
local-brain/audits/<slug>.audit.json
```

文章草稿不是简报卡片，而是长文载体，内部带：

- Markdown 正文
- FAQ
- intelligence cards
- 表格
- CTA
- 中英文标题与摘要

## 发布边界

- Local Brain 只负责生产、校验、导入、发布
- 网站对外只展示成品文章，不暴露“AI 流水线”措辞
- 高风险类目仍然建议人工复核后再发布
- `local-brain/config.json` 已加入忽略列表，不应提交真实密钥
