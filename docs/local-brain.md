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
```

## 3. 标准工作流

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

6. 构建验证：

```bash
npm run build
```

7. 提交上线：

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
