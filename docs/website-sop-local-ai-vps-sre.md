# 官网建站 SOP：本地 AI 生产 + Vercel 前端 + VPS 后端 + 轻量 SRE 灾备架构

版本：v1.1（前端改为 Vercel 托管）

适用对象：一人公司、小团队、低成本数字产品官网。

目标：用尽量轻量的技术栈，搭建一套可以自动生成内容、自动发布、自动收款、自动履约、可监控、可备份、可回滚、可持续扩展的官网系统。

---

## 0. 总体架构

### 0.1 架构图

```text
本地工作站
  - AI Agent 内容生产
  - 爬虫与资料清洗
  - JSON 组装与质量检查
  - Python 推送脚本
        |
        v
Vercel
  - Next.js 官网
  - ISR / On-Demand Revalidation
  - Preview Deployments
        |
        v
海外 VPS
  - Nginx
  - Strapi CMS
  - PostgreSQL
  - FastAPI Webhook/履约服务
  - PM2/systemd
        |
        v
外部服务
  - Cloudflare DNS/CDN/WAF
  - Lemon Squeezy 支付
  - Resend 邮件
  - UptimeRobot 可用性监控
  - Telegram/飞书/钉钉告警
  - Cloudflare R2 异地备份
```

### 0.2 域名规划

```text
www.yourdomain.com       官网前台，Vercel 托管的 Next.js
api.yourdomain.com       Strapi CMS 数据接口与后台
webhook.yourdomain.com   FastAPI 支付回调与内部任务接口
```

### 0.3 核心原则

- 本地电脑负责 AI 内容生产、资料处理和批量推送。
- Vercel 负责官网展示、Next.js 构建、Preview 部署、ISR 和按需刷新。
- VPS 负责 CMS、数据库、支付回调、订单履约、备份、日志和监控接口。
- 不使用 `output: 'export'` 纯静态导出作为长期方案。
- Next.js 在 Vercel 上使用 ISR 和按需刷新，避免每次新增内容都全站构建。
- Webhook 必须验签、幂等、可重试、可审计。
- 所有关键失败必须告警。
- 所有核心数据必须异地备份，并定期恢复演练。
- 所有公网入口必须有认证、限流或验签。
- 所有密钥必须有清单、存放位置和轮换周期。

---

## 1. VPS 基础设施

### 1.1 采购建议

海外 VPS 最低建议：

```text
系统：Ubuntu 22.04 LTS 或 Ubuntu 24.04 LTS
CPU：2 vCPU 起
内存：4GB 起
磁盘：60GB SSD 起
网络：海外机房，面向目标客户访问速度稳定
```

说明：前端迁移到 Vercel 后，VPS 不再长期运行 Next.js，资源压力会明显下降。但 PostgreSQL、Strapi、FastAPI、Nginx、备份脚本和日志仍会共享同一台机器。2GB 内存只能作为验证阶段的极限生存线，不适合承载生产流量；生产环境仍建议 4GB 起步。

内存阈值建议：

```text
2GB 验证机：
  - Strapi max-memory-restart: 400-500MB
  - FastAPI/worker: 由 systemd 或 PM2 控制，避免无上限增长

4GB 生产起步机：
  - Strapi max-memory-restart: 800MB-1GB
  - FastAPI/worker: 独立日志与失败重试，必要时拆分
```

早期可以把 Strapi、PostgreSQL、FastAPI 和 Nginx 放在同一台 VPS。后期优先拆分 PostgreSQL、附件存储、履约 worker 和日志系统；Next.js 前端默认已经由 Vercel 承载。

### 1.2 系统安全加固

创建非 root 用户：

```bash
adduser deploy
usermod -aG sudo deploy
```

配置 SSH Key 登录后，禁用 root 密码登录：

```text
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
```

重启 SSH 前，必须保留一个已登录会话，避免把自己锁在服务器外。

### 1.3 防火墙

只开放必要端口：

```bash
ufw allow 22
ufw allow 80
ufw allow 443
ufw enable
ufw status
```

PostgreSQL、Strapi、FastAPI 的内部端口不得直接暴露公网。Next.js 不在 VPS 上常驻运行，由 Vercel 托管。

### 1.4 基础依赖

安装基础软件：

```bash
apt update && apt upgrade -y
apt install nginx postgresql postgresql-contrib certbot python3-certbot-nginx git curl unzip -y
```

安装 Node.js 20、Python 3.10+，并全局安装 PM2：

```bash
npm install -g pm2
pm2 startup
```

### 1.5 Swap 安全垫

低配 VPS 必须配置 Swap，避免瞬时内存尖峰导致 OOM Kill。

```bash
fallocate -l 4G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
```

写入 `/etc/fstab`：

```text
/swapfile none swap sw 0 0
```

设置较低 swappiness：

```bash
sysctl vm.swappiness=10
```

说明：Swap 是安全垫，不是性能方案。如果系统长期使用大量 Swap，应升级内存或拆分服务。

---

## 2. DNS 与 HTTPS

### 2.1 DNS 与 CDN

推荐使用 Cloudflare 托管 DNS，并开启 CDN 代理。Cloudflare 免费版即可提供基础缓存、DDoS 缓解、WAF/Firewall Rules 和源站隐藏能力。

DNS 记录：

```text
www      CNAME  cname.vercel-dns.com
api      A      VPS_IP
webhook  A      VPS_IP
```

代理模式建议：

```text
www      DNS Only 或按 Vercel 官方 Cloudflare 配置接入；HTTPS 与边缘缓存由 Vercel 负责
api      Proxied 或 DNS Only；如果 Strapi 后台访问异常，先用 DNS Only 排查
webhook  Proxied；配合 Cloudflare Firewall Rules 与 Nginx 限流
```

注意：`www` 由 Vercel 托管后，不建议再让 Cloudflare 对 HTML 做额外强缓存，否则可能干扰 Vercel 的 ISR、Preview Deployment 和按需刷新。Cloudflare 主要负责 DNS、WAF 和对 `api`、`webhook` 的入口保护。

必须配置：

```text
Vercel 上的 Next.js 页面输出正确 Cache-Control
Webhook 路径禁止 CDN 缓存
Strapi admin 路径禁止 CDN 缓存
Cloudflare Firewall Rules 拦截异常国家、异常 UA 或高频请求
源站 Nginx 仍然保留 limit_req，不能只依赖 Cloudflare
```

如果不熟悉 Cloudflare 与 Vercel 的组合缓存规则，早期 `www` 使用 DNS Only 交给 Vercel 管理，避免双 CDN 缓存导致排障困难。

### 2.2 Nginx 反向代理

建议端口规划：

```text
Strapi   127.0.0.1:1337
FastAPI  127.0.0.1:8000
```

Nginx 只为 VPS 后端域名配置 server block：

```text
api.yourdomain.com      -> 127.0.0.1:1337
webhook.yourdomain.com  -> 127.0.0.1:8000
```

### 2.3 HTTPS

`www.yourdomain.com` 的 HTTPS 证书由 Vercel 自动签发和续期，不在 VPS 上执行 Certbot。VPS 只需要为 `api` 与 `webhook` 配置 Certbot：

```bash
certbot --nginx -d api.yourdomain.com
certbot --nginx -d webhook.yourdomain.com
certbot renew --dry-run
```

确认 Vercel 域名证书和 VPS Certbot 自动续期都正常后，再进入正式业务测试。

---

## 3. PostgreSQL 数据库

### 3.1 创建数据库

```sql
CREATE DATABASE strapi_db;
CREATE USER strapi_user WITH PASSWORD 'strong_password';
GRANT ALL PRIVILEGES ON DATABASE strapi_db TO strapi_user;
```

PostgreSQL 只允许本机访问，不开放公网端口。

### 3.2 数据库信息登记

必须记录到加密密钥清单中：

```text
数据库名
数据库用户
数据库密码
连接地址
备份位置
恢复命令
负责人
轮换周期
```

---

## 4. Strapi CMS 部署

### 4.1 部署目标

Strapi 是云端内容金库，用于接收本地 AI 生成的结构化内容，并为 Next.js 提供读取接口。

### 4.2 核心内容模型

建议模型：`SEO_Keyword_Asset`

字段示例：

```text
title
slug
keyword
pain_point
compliance_notes
product_level
price_tier
downloadable_file
publishedAt
createdAt
updatedAt
```

### 4.3 API Token 策略

至少拆分两个 Token：

```text
Local Write Token
  - 只允许 create 指定 collection
  - 用于本地 Python 脚本推送内容

Next Read Token
  - 只允许 read 已发布内容
  - 用于 Next.js 读取 Strapi 数据
```

禁止：

- 使用 Full Access Token。
- 将 Token 写入 Git 仓库。
- 在浏览器端暴露写入 Token。

更安全的长期方案：本地脚本不要直接写 Strapi，而是写入 FastAPI 的受限 ingestion 接口，由服务端校验后再写 Strapi。

### 4.4 进程托管

使用 PM2：

```bash
pm2 start npm --name strapi -- run start
pm2 save
```

设置内存保护：

```bash
pm2 start npm --name strapi --max-memory-restart 1G -- run start
```

### 4.5 版本锁定与选型边界

Strapi 的价值在于管理后台、内容建模 UI、权限系统和现成 API。早期需要人工查看、编辑、发布内容时，Strapi 是合理选择。

但 Strapi 也有长期维护成本：

```text
大版本升级可能不平滑
内容模型复杂变更需要迁移
Node.js 运行时占用内存
如果内容完全由本地 AI 生成，后台使用频率可能很低
```

生产环境必须锁定版本：

```text
package-lock.json 必须提交
Strapi 大版本不自动升级
升级前先读 migration guide
升级前先做 pg_dump
升级前先在测试环境跑完整链路
```

满足以下条件时，可以考虑去掉 Strapi，改为 FastAPI + PostgreSQL 直接提供内容 API：

```text
内容模型长期稳定
几乎不需要人工后台编辑
所有内容都来自本地 AI 流水线
需要降低内存占用和升级复杂度
团队愿意自己维护简单的后台或 SQL 管理工具
```

迁移方向：

```text
Strapi collection
  -> PostgreSQL 原生表
  -> FastAPI content API
  -> Next.js 从 FastAPI 读取内容
```

去 Strapi 不应在业务早期过早执行。只有当 Strapi 的运维成本明显高于后台价值时，再做迁移。

---

## 5. Next.js 官网部署到 Vercel 与 ISR

### 5.1 路线选择

不采用长期纯静态导出：

```js
// 不作为长期方案
output: 'export'
```

采用 Vercel 托管 Next.js：

```text
GitHub/GitLab/Bitbucket 仓库
  -> Vercel Project
  -> Production Deployment
  -> Preview Deployment
  -> Vercel Edge Network
```

VPS 不再运行 `next-www` 进程，也不再维护 `.next/cache`。前端构建、运行时、ISR 缓存、Preview 环境和 HTTPS 均由 Vercel 管理。

### 5.2 页面策略

```text
首页：ISR 或 SSR
列表页：ISR
详情页：ISR
支付按钮：携带 asset_id、slug 或 variant_id 映射
sitemap.xml：可按需刷新
```

### 5.3 动态路由与 SSG/ISR 整合

内容详情页使用 Next.js App Router 动态路由：

```text
app/insights/[slug]/page.tsx
```

核心职责：

```text
[slug]/page.tsx
  - 接收 params.slug
  - 使用服务端 fetch 调用 Strapi Read-Only API
  - 根据 slug 拉取单篇内容
  - 输出 SEO metadata
  - 渲染详情页静态 HTML
```

构建期预生成路径：

```ts
export async function generateStaticParams() {
  const articles = await fetch(`${process.env.STRAPI_API_URL}/api/seo-keyword-assets`, {
    headers: {
      Authorization: `Bearer ${process.env.STRAPI_READ_TOKEN}`,
    },
  }).then((res) => res.json());

  return articles.data.map((item) => ({
    slug: item.attributes.slug,
  }));
}
```

详情页读取示例：

```ts
export default async function InsightDetailPage({ params }) {
  const { slug } = await params;
  const article = await fetch(
    `${process.env.STRAPI_API_URL}/api/seo-keyword-assets?filters[slug][$eq]=${slug}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.STRAPI_READ_TOKEN}`,
      },
      next: { revalidate: 3600 },
    },
  ).then((res) => res.json());

  return <ArticleView article={article.data[0]} />;
}
```

要求：

- `STRAPI_READ_TOKEN` 只能在服务端使用，不得传入客户端组件。
- `generateStaticParams` 用于让 Vercel 在构建时预生成已发布内容的静态 HTML。
- 新增内容不应触发全站 `npm run build`，而是由 FastAPI 调用 `/api/revalidate` 刷新 `/insights` 与 `/insights/{slug}`。
- 当文章量达到数千篇时，不一定要在构建期生成全部详情页；可以只预生成核心高流量页面，其余页面依赖 ISR 首次访问生成。
- 详情页必须处理 Strapi 无数据、未发布、slug 重复、API 超时等异常，不能把空数据渲染成正常页面。

### 5.4 Vercel 环境变量

Vercel Production 与 Preview 环境必须分别配置环境变量：

```text
NEXT_PUBLIC_SITE_URL=https://www.yourdomain.com
STRAPI_API_URL=https://api.yourdomain.com
STRAPI_READ_TOKEN=...
REVALIDATE_SECRET=...
LEMON_CHECKOUT_BASE_URL=...
```

规则：

- `STRAPI_READ_TOKEN` 只能在服务端读取，不得暴露给浏览器。
- `REVALIDATE_SECRET` 与 FastAPI 内部调用保持一致。
- Preview 环境可使用独立 Strapi token 或测试 Strapi 数据。
- Vercel 环境变量变更后必须重新部署才会进入运行时。

### 5.5 按需刷新

实现受保护接口：

```text
POST /api/revalidate
```

要求：

- 必须校验 `REVALIDATE_SECRET`。
- 只允许刷新白名单路径。
- 记录刷新路径、触发来源、耗时、结果。
- 刷新失败必须告警。
- 不允许外部任意路径刷爆缓存。

典型刷新路径：

```text
/
/insights
/insights/{slug}
/sitemap.xml
```

FastAPI 调用 Vercel revalidate 时，必须使用 HTTPS 访问正式域名或 Vercel 提供的部署域名：

```text
POST https://www.yourdomain.com/api/revalidate
Authorization: Bearer REVALIDATE_SECRET
```

### 5.6 Vercel 部署流程

```text
推送代码到主分支
Vercel 自动安装依赖
Vercel 执行 npm run build
生成 Production Deployment
Vercel 自动切换流量
UptimeRobot 验证 www 可用性
```

上线前必须先检查 Preview Deployment：

```text
页面是否渲染正常
中英文切换是否正常
表单提交是否正常
Strapi 内容读取是否正常
revalidate 接口是否拒绝错误 secret
```

### 5.7 Vercel 回滚

Vercel 自带部署历史。新版本异常时，不需要在 VPS 上 `git checkout` 或重新构建，直接在 Vercel Dashboard 中 Promote 上一个稳定 Deployment，或使用 Vercel CLI 回滚。

回滚后必须验证：

```text
https://www.yourdomain.com
核心列表页
核心详情页
表单提交
revalidate 接口
支付按钮跳转
```

---

## 6. FastAPI 履约中枢

### 6.1 职责

FastAPI 负责：

```text
Lemon Squeezy webhook 接收与验签
订单履约队列
邮件发货
失败重试
告警推送
Vercel Next.js ISR 触发
健康检查
```

### 6.2 核心接口

```text
GET  /health
POST /webhook/lemonsqueezy
POST /internal/revalidate
```

### 6.3 Webhook 安全要求

Lemon Squeezy webhook 必须：

- 使用原始请求体验签。
- 使用 HMAC-SHA256 校验签名。
- 校验事件类型。
- 校验订单状态。
- 校验 product_id 或 variant_id。
- 做 event_id 和 order_id 幂等。
- 验签失败记录日志并按阈值告警。

### 6.4 订单履约表

不要在 webhook 请求中同步完成所有发货逻辑。先写订单表，再后台处理。

```text
orders
  - id
  - event_id
  - order_id
  - email
  - product_id
  - variant_id
  - asset_id
  - status: pending/sent/failed/refunded
  - retry_count
  - last_error
  - created_at
  - updated_at
```

处理流程：

```text
Webhook 到达
验签
校验事件类型和订单状态
校验商品映射
写入 orders 表
立即返回 200
后台 worker 发送邮件
成功后标记 sent
失败后重试
重试耗尽标记 failed 并告警
```

### 6.5 早期 Worker 模型

单机早期推荐使用 cron 轮询 `orders` 表，而不是 FastAPI `BackgroundTasks`。

推荐方案：

```text
Webhook 只负责验签和写入 pending 订单
独立 Python worker 脚本每分钟由 cron 触发
worker 查询 pending 或可重试 failed 订单
worker 执行发货、重试、状态更新和告警
```

原因：

```text
任务状态持久化在 PostgreSQL 中
FastAPI 进程重启不会丢任务
实现简单，不需要 Redis/Celery/RQ
失败订单可以人工查询和补偿
```

不推荐早期依赖：

```text
FastAPI BackgroundTasks：进程重启时任务可能丢失
纯内存 asyncio task：进程退出后状态丢失
复杂队列系统：早期维护成本偏高
```

cron 示例：

```text
* * * * * /apps/fastapi/venv/bin/python /apps/fastapi/current/scripts/process_orders.py >> /var/log/fastapi/worker.log 2>&1
```

worker 必须加锁，避免上一轮未完成时下一轮重复处理同一批订单。

### 6.6 重试策略

使用 Tenacity 对外部调用做指数退避重试：

```text
Resend 邮件发送失败：最多重试 3 次
Vercel Next.js revalidate 失败：最多重试 3 次
Strapi 读取失败：最多重试 3 次
```

重试耗尽后：

- 写入错误日志。
- 更新数据库状态。
- 推送 Telegram/飞书/钉钉告警。
- 保留人工补偿入口。

### 6.7 内部接口安全

`/internal/revalidate` 必须：

- 只监听本机，或必须带内部 secret。
- 不接受任意 shell 命令。
- 不拼接外部传入参数执行命令。
- 加路径白名单。
- 加防抖和锁。

### 6.8 Lemon Squeezy 商品映射

商品映射是支付闭环中最容易出错的环节，必须有单一事实来源。

推荐做法：在 Strapi 的内容模型中保存 Lemon Squeezy 映射字段。

```text
SEO_Keyword_Asset
  - slug
  - title
  - lemon_product_id
  - lemon_variant_id
  - price_tier
  - fulfillment_type
  - downloadable_file
  - is_sellable
```

Webhook 处理时必须校验：

```text
event.variant_id 能匹配唯一一条已发布 asset
asset.is_sellable = true
订单金额或 price_tier 与预期一致
订单状态为 paid/order_created 对应的可履约状态
该 order_id 未发货过
```

禁止：

```text
在 Next.js 环境变量中硬编码大量商品映射
只依赖前端按钮传来的 asset_id 发货
同一个 lemon_variant_id 对应多个可售 asset
映射变更后不做测试订单
```

如果多个资产共用一个 Lemon Squeezy variant，应增加独立的 license key、custom data 或 checkout metadata，并在 webhook 中二次校验。否则容易发错货。

---

## 7. 本地 AI 生产流水线

### 7.1 本地职责

本地电脑负责：

```text
原始资料抓取
资料清洗
AI 内容生成
合规检查
JSON 结构化
质量检查
推送到云端
```

### 7.2 Agent 分工

```text
Agent A：痛点挖掘，输入原始资料，输出用户场景、搜索意图和购买动机
Agent B：合规排雷，输入候选内容，输出风险点、禁用表述和替代表述
Agent C：JSON 组装，输入审核后的内容，输出符合 schema 的结构化 JSON
Agent D：质量检查，输入最终 JSON，输出通过/拒绝、修改建议和置信度
```

### 7.3 推送脚本

```text
POST https://api.yourdomain.com/api/seo-keyword-assets
Authorization: Bearer LOCAL_WRITE_TOKEN
Content-Type: application/json
```

建议在推送前校验：

- 必填字段完整。
- slug 唯一。
- 敏感词或合规风险已处理。
- JSON schema 校验通过。

批量推送要求：

```text
限制并发，避免打爆 Strapi
每条内容有唯一 request_id
失败任务写入本地 failed 队列
重复 slug 直接跳过或进入人工审核
每批推送后生成 summary 报告
```

### 7.4 内容质量与成本控制

每条内容必须记录：

```text
来源 URL 或来源文件
模型名称
生成耗时
估算成本
审核结果
slug
推送状态
```

质量门槛：

```text
JSON schema 通过
slug 唯一
标题不重复
核心字段非空
合规检查通过
低置信度内容进入人工审核
```

成本控制：

```text
先用低成本模型做初筛
高价值内容再用强模型精修
同一来源内容去重后再生成
批量任务设置每日预算上限
```

人工兜底：

```text
高风险合规内容必须人工抽检
低置信度内容不自动发布
被投诉或退款的内容回流到本地质检库
```

### 7.5 机密边界说明

如果使用 OpenAI、Gemini 等云端模型 API，资料会进入第三方模型服务，不能称为“商业机密绝不上云”。

如果必须做到机密不上云，应采用：

- 本地开源模型推理。
- 脱敏后再调用云端模型。
- 明确哪些资料允许进入第三方 API。

---

## 8. CI/CD 部署与 SEO 启动

### 8.1 代码发布链路

前端代码发布走 GitHub 与 Vercel：

```text
本地开发 Next.js
提交代码到 GitHub
Pull Request 触发 Vercel Preview Deployment
检查 Preview 页面、表单、语言切换和 Strapi 读取
合并到主分支
Vercel 自动执行 npm run build
Vercel 发布 Production Deployment
正式域名自动切换到新版本
```

要求：

- 主分支只能合并已通过构建和预览检查的代码。
- Vercel Production 绑定 `www.yourdomain.com`。
- Preview 环境使用独立环境变量，避免误连生产 webhook 或生产支付。
- Vercel 构建失败必须阻止上线，并触发告警或至少发送邮件通知。

### 8.2 内容发布链路

```text
本地 AI 生成内容
本地脚本推送 Strapi
Strapi 保存内容
Strapi Webhook 通知 FastAPI
FastAPI 计算受影响路径
FastAPI 调用 Vercel 上的 Next.js /api/revalidate
Vercel Next.js 只刷新对应页面
```

内容更新的默认策略是按需刷新，不是全站重构。

推荐 Strapi Webhook：

```text
事件：entry.create / entry.update / entry.publish / entry.unpublish
目标：https://webhook.yourdomain.com/internal/revalidate
鉴权：自定义 secret header
载荷：collection、entry id、slug、locale、operation、request_id
```

FastAPI 收到 Strapi Webhook 后：

```text
验证 secret
解析 collection 与 slug
计算受影响路径
写入 revalidate 日志
调用 https://www.yourdomain.com/api/revalidate
失败重试
重试耗尽告警
```

### 8.3 Deploy Hook 使用边界

Vercel Deploy Hook 可以保留，但只作为低频兜底，不作为每篇文章发布的默认动作。

适合触发 Vercel Deploy Hook 的场景：

```text
内容模型 schema 大改
导航结构大改
sitemap 生成逻辑大改
全站模板代码变更
批量导入后需要重新生成大量静态路径
```

不推荐的做法：

```text
Python 每写入一篇文章就调用 Vercel Deploy Hook
Strapi 每新增一条内容就触发全站重构
把 Deploy Hook 当作内容发布主链路
```

原因：几百篇或几千篇文章后，频繁全站构建会拖慢发布、消耗 Vercel 构建额度，并增加失败面。正常内容更新应走 ISR/revalidate。

### 8.4 防抖与锁

避免频繁刷新：

```text
同一路径 1-5 分钟内只刷新一次
同一时间只允许一个刷新任务处理同一路径
失败后重试，连续失败告警
```

### 8.5 不再全站 build

禁止在每次新增内容时执行：

```bash
npm run build
```

全站 build 只由 Vercel 在正式部署新版本时执行，内容更新走 ISR/revalidate。

### 8.6 SEO 基础设施

Next.js 必须提供动态 SEO 基础文件：

```text
app/sitemap.ts       动态 sitemap.xml
app/robots.ts        动态 robots.txt
metadata             页面 title、description、canonical、open graph
```

sitemap 必须包含：

```text
首页
服务页或核心锚点页
情报库列表页
情报详情页
资料收集页中允许索引的公开页面
```

robots 基础策略：

```text
允许 Googlebot/Bingbot 抓取公开内容
禁止抓取后台、API、Webhook、Intake 提交接口
声明 Sitemap: https://www.yourdomain.com/sitemap.xml
```

上线后执行：

```text
创建 Google Search Console 属性
验证域名所有权
提交 https://www.yourdomain.com/sitemap.xml
检查 robots.txt 是否可访问
检查核心页面是否可索引
观察 Coverage、Indexing、Crawl Stats 和搜索展示数据
```

SEO 启动后的最低监控：

```text
sitemap 是否 200
robots.txt 是否 200
核心详情页是否返回 200
重要页面 title/description 是否为空
Search Console 是否出现抓取错误
```

---

## 9. 开发与测试环境

### 9.1 本地开发环境

禁止直接在生产环境调试。至少要在本地跑通一套最小开发环境：

```text
PostgreSQL
Strapi
Next.js 本地开发服务
FastAPI
本地 worker
```

推荐使用 Docker Compose 管理 PostgreSQL，也可以直接本机安装。Strapi、Next.js、FastAPI 可以本机进程运行，便于调试。前端上线前必须通过 Vercel Preview Deployment 验证一次真实托管环境。

### 9.2 环境隔离

至少区分：

```text
local：本地开发
staging：可选，小团队可以用本地替代
production：正式环境
```

每个环境必须有独立：

```text
数据库
.env
Lemon Squeezy webhook secret
Resend API Key 或测试 key
Vercel/Next.js revalidate secret
```

### 9.3 Lemon Squeezy 沙盒测试

上线前必须使用 Lemon Squeezy 沙盒或测试模式跑通：

```text
测试商品创建
测试 checkout
测试 webhook 验签
测试订单入库
测试邮件发货
测试重复 webhook 不重复发货
```

### 9.4 Migration 本地验证

任何数据库 migration 必须先在本地或 staging 验证：

```text
导入生产备份的脱敏副本
执行 migration
启动 Strapi 和 Next.js
检查内容读取
检查订单履约表
确认回滚脚本可用
```

---

## 10. 监控与告警

### 10.1 监控原则

一人公司的监控原则：

```text
平时绝对安静
出事立刻叫醒
告警必须可行动
```

### 10.2 外部可用性监控

使用 UptimeRobot 免费版，每 5 分钟监控：

```text
https://www.yourdomain.com
https://api.yourdomain.com/admin
https://webhook.yourdomain.com/health
```

### 10.3 健康检查

FastAPI `/health` 至少检查：

```text
FastAPI 进程是否存活
PostgreSQL 是否可连接
最近一次 webhook 是否失败
最近一次邮件是否失败
最近一次 revalidate 是否成功
磁盘空间是否低于阈值
订单队列是否有失败积压
```

### 10.4 必须告警的事件

```text
Webhook 验签失败次数异常
订单发货失败
邮件重试耗尽
Vercel Next.js revalidate 失败
Strapi 写入失败
PostgreSQL 连接失败
磁盘空间不足
备份失败
PM2 进程频繁重启
Nginx 返回 5xx 异常增加
```

### 10.5 告警渠道

至少配置一个即时渠道：

```text
Telegram Bot
飞书 Webhook
钉钉 Webhook
企业微信机器人
```

邮件只能作为兜底，不应作为唯一告警渠道。

---

## 11. 异地备份与恢复

### 11.1 备份内容

每日凌晨 3 点执行备份：

```text
PostgreSQL pg_dump
Strapi uploads 目录
Nginx 配置
PM2 ecosystem 配置
FastAPI/Next.js/Strapi .env 示例文件
部署脚本
关键 migration 脚本
```

注意：备份 `.env` 时不要明文扩散敏感密钥。Vercel 前端的环境变量不在 VPS 文件系统中，必须在主密钥清单中记录变量名、用途、所属环境和轮换周期；实际密钥存放在 Vercel Project Settings 与加密密码管理器中。建议只备份 `.env.example`，不要明文备份真实密钥。

### 11.2 备份目标

使用 rclone 加密上传到 Cloudflare R2：

```text
VPS 本地临时备份
  -> rclone crypt 加密
  -> Cloudflare R2 bucket
```

推荐 Cloudflare R2 的原因：

- 兼容 S3 API。
- 适合 SQL dump、文本资产、配置文件。
- 免费额度对早期文本业务足够。
- 免流出费，恢复成本可控。

### 11.3 保留策略

```text
每日备份保留 7 天
每周备份保留 4 周
每月备份保留 6 个月
```

### 11.4 恢复演练

每月至少做一次恢复演练：

```text
新建临时数据库
导入 pg_dump
启动临时 Strapi
确认内容可读
确认附件存在
确认 Vercel/Next.js 能读取内容
记录恢复耗时和问题
```

没有恢复演练的备份，不算真正备份。

---

## 12. 日志管理

### 12.1 日志原则

日志必须满足：

```text
有位置
有轮转
能查询
能定位订单、内容和失败原因
不会撑爆磁盘
```

### 12.2 PM2 日志轮转

安装 PM2 日志轮转插件：

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 20M
pm2 set pm2-logrotate:retain 14
pm2 set pm2-logrotate:compress true
```

### 12.3 FastAPI 日志

FastAPI 使用 Python `RotatingFileHandler`：

```text
单文件最大 20MB
保留 14 个历史文件
错误日志单独输出
关键失败推送告警
```

建议日志文件：

```text
app.log
webhook.log
fulfillment.log
revalidate.log
error.log
```

### 12.4 结构化日志

FastAPI 业务日志必须优先使用 JSON 格式，方便后续用 `jq`、`grep` 或集中日志系统查询。

最小字段：

```text
timestamp
level
service
env
request_id
event_type
order_id
event_id
asset_id
path
status
duration_ms
error_code
message
```

典型事件类型：

```text
webhook_received
webhook_signature_failed
order_queued
fulfillment_started
fulfillment_sent
fulfillment_failed
revalidate_requested
revalidate_failed
backup_failed
```

Nginx access log 也建议改为 JSON 格式，至少包含：

```text
time
remote_addr
request
status
body_bytes_sent
request_time
http_user_agent
http_cf_connecting_ip
```

必须在所有服务中传递或生成 `request_id`。同一次 webhook、订单履约、邮件发送和 revalidate 应能通过同一个 `request_id` 串起来。

### 12.5 Nginx 日志

确认系统 logrotate 已管理 Nginx：

```bash
cat /etc/logrotate.d/nginx
```

重点关注：

```text
access.log
error.log
5xx 比例
异常请求来源 IP
```

### 12.6 后期集中日志

当排障变复杂时，可接入：

```text
Better Stack
Grafana Cloud
Loki
```

早期不强制上集中日志，但必须先做好本机轮转。

---

## 13. 数据库迁移策略

### 13.1 迁移原则

Strapi 内容模型会随业务迭代变化。简单变更可以依赖 Strapi 自动处理，复杂变更必须人工迁移。

复杂变更包括：

```text
字段重命名
字段类型改变
拆分 collection
合并 collection
批量数据清洗
关系字段调整
唯一约束调整
```

### 13.2 变更前动作

每次修改 Content-Type 前：

```text
执行 pg_dump
记录变更原因
在测试环境验证
准备回滚方案
再上生产
```

### 13.3 Migration 文件管理

复杂变更必须写 migration 脚本并纳入 Git：

```text
migrations/
  2026-04-22-rename-keyword-field.sql
  2026-04-22-backfill-asset-slug.js
```

### 13.4 推荐上线顺序

```text
备份数据库
部署兼容旧字段的新代码
执行 migration
验证数据
切换新字段
观察日志
删除旧字段
```

不要同时做“破坏性 schema 变更”和“业务代码大改”。

---

## 14. 灰度发布与快速回滚

### 14.1 发布原则

前端由 Vercel 托管后，官网发布与回滚交给 Vercel Deployment；VPS 仍然必须为 Strapi 和 FastAPI 保留最小回滚能力。不能只依赖 `git checkout` 后重新构建。

### 14.2 推荐目录结构

```text
/apps/fastapi/releases/20260422-120000
/apps/fastapi/releases/20260422-150000
/apps/fastapi/current -> /apps/fastapi/releases/20260422-150000
/apps/strapi/releases/20260422-120000
/apps/strapi/current -> /apps/strapi/releases/20260422-120000
```

Next.js 不在 VPS 上使用 releases/current 结构；它的历史版本保留在 Vercel Deployments 中。

### 14.3 发布流程

```text
前端：
  - 推送代码
  - 检查 Vercel Preview Deployment
  - 合并到主分支
  - Vercel 自动发布 Production Deployment
  - 检查 www 页面和核心路径

VPS 后端：
  - 拉取代码到新 release 目录
  - 安装依赖
  - 运行测试或最小检查
  - 启动临时进程或执行健康检查
  - 切换 current 软链接
  - PM2 reload 或 systemd restart
  - 检查 /health
  - 记录发布版本
```

### 14.4 回滚流程

如果新版本异常：

```text
前端：
  - 在 Vercel 中 Promote 上一个稳定 Deployment
  - 确认 www 页面正常
  - 确认 revalidate 接口正常

VPS 后端：
  - current 切回上一版本
  - PM2 reload 或 systemd restart
  - 确认 /health 正常
  - 记录回滚原因
  - 保留失败版本用于排查
```

### 14.5 构建产物保留

Next.js 构建产物由 Vercel 保存为 Deployment 历史，不需要在 VPS 备份 `.next`。但必须保留 Vercel 项目权限、部署记录、环境变量清单和回滚权限，避免出现“代码能回滚但密钥无法恢复”的问题。

---

## 15. 速率限制

### 15.1 限流原则

认证和验签只能解决“谁有权限”，不能解决“高频请求耗尽资源”。`www` 由 Vercel/Cloudflare 侧做边缘防护与速率限制；`api` 与 `webhook` 仍必须在 Cloudflare Firewall Rules 和源站 Nginx 两层限流。

### 15.2 建议策略

```text
www 普通页面：使用 Vercel/Cloudflare 侧防护策略，不走 VPS Nginx
api 普通接口：每 IP 每秒 3 请求
Strapi admin 登录：每 IP 每分钟 5 请求
webhook 接口：每 IP 每秒 1 请求
```

### 15.3 Nginx 配置方向

使用：

```text
limit_req_zone
limit_req
limit_conn_zone
limit_conn
```

对不同域名、路径使用不同策略。

Webhook 端点即使有签名校验，也需要限流，避免垃圾请求消耗 CPU 和日志磁盘。

---

## 16. Secrets 管理与轮换

### 16.1 管理原则

所有 secret 可以放在 `.env` 中供服务读取，但必须有一份加密的主密钥清单。

推荐工具：

```text
1Password
Bitwarden
KeePassXC
age/sops 加密文件
```

### 16.2 密钥清单字段

每个密钥至少记录：

```text
密钥名称
用途
所属服务
存放位置
创建日期
轮换周期
负责人
泄露后的处理步骤
```

### 16.3 必须纳入清单的密钥

```text
Strapi Admin 密码
Strapi API Tokens
PostgreSQL 密码
Lemon Squeezy Signing Secret
Resend API Key
Telegram/飞书/钉钉 Webhook
Vercel/Next.js Revalidate Secret
Cloudflare R2 Access Key
Rclone 加密密码
SSH 私钥
```

### 16.4 轮换周期

```text
高风险 API Token：每季度轮换
支付/Webhook Secret：每季度轮换，疑似泄露时立刻轮换
数据库密码：半年轮换
SSH Key：人员或设备变化时立刻轮换
R2 Access Key：半年轮换
```

### 16.5 轮换后测试

每次轮换后必须完成端到端测试：

```text
本地推送内容
Strapi 写入成功
Vercel Next.js ISR 刷新成功
Lemon Squeezy 测试订单成功
Resend 邮件发货成功
R2 备份上传成功
告警渠道可用
```

---

## 17. 单机资源保护

### 17.1 PM2 进程管理

PM2 托管：

```text
strapi
fastapi
```

Next.js 不由 PM2 托管，前端运行在 Vercel。PostgreSQL 由 systemd 管理，不交给 PM2。

### 17.2 常用检查命令

```bash
pm2 status
pm2 logs
systemctl status postgresql
systemctl status nginx
df -h
free -m
```

### 17.3 资源竞争处理

当出现下列情况时，应考虑拆分服务：

```text
Next.js 内存长期接近阈值
PostgreSQL I/O 等待明显
Strapi 后台频繁变慢
订单履约延迟增加
磁盘空间增长过快
Swap 被长期大量使用
```

---

## 18. 上线点火测试

### 18.1 正向链路测试

上线前必须跑通：

```text
本地生成一条测试资产
推送到 Strapi
确认 Strapi 收到数据
触发 Vercel ISR revalidate
访问官网确认新资产出现
Lemon Squeezy 沙盒下单
FastAPI 验签成功
orders 表出现订单
Resend 发出邮件
客户邮箱收到附件或下载链接
UptimeRobot 状态正常
备份脚本成功上传 R2
```

### 18.2 失败链路测试

必须模拟：

```text
邮件发送失败，确认重试和告警
Webhook 重放，确认不会重复发货
错误签名 webhook，确认拒绝并记录
Revalidate 失败，确认页面旧版本仍可访问
数据库备份恢复，确认数据可读
PM2 进程异常退出，确认自动拉起
```

---

## 19. 扩展路线

### 19.1 单机阶段

早期单 VPS 可以承载：

```text
Nginx
Strapi
PostgreSQL
FastAPI
PM2
```

Next.js 官网默认运行在 Vercel，不计入 VPS 单机负载。

### 19.2 拆分触发信号

出现以下信号后，开始拆分：

```text
内容超过 5000-10000 页
PostgreSQL CPU 或 I/O 紧张
Vercel 构建时间、函数调用或带宽接近套餐限制
Webhook 履约量明显增长
备份文件快速膨胀
磁盘空间频繁告警
```

### 19.3 推荐拆分顺序

```text
1. PostgreSQL 迁移到托管数据库
2. 静态资源和附件迁移到 R2/CDN
3. Vercel 前端升级套餐、优化构建或拆分内容生成策略
4. FastAPI 履约服务独立部署
5. 订单履约进入 Redis/Celery/RQ 等队列系统
6. 日志进入集中平台
```

---

## 20. 最小运行手册

### 20.1 每日检查

```text
UptimeRobot 是否有告警
订单是否有 failed 状态
磁盘空间是否充足
备份任务是否成功
```

### 20.2 每周检查

```text
pm2 status
Nginx error.log
FastAPI error.log
PostgreSQL 连接与慢查询迹象
R2 备份数量和大小
```

### 20.3 每月检查

```text
恢复演练
密钥清单更新
依赖安全更新
日志空间检查
发布和回滚流程演练
```

### 20.4 每季度检查

```text
高风险 Token 轮换
支付/Webhook Secret 轮换
架构容量评估
备份保留策略复核
成本复核
```

---

## 21. 最终定位

这套 SOP 的目标不是大厂式复杂架构，而是适合一人公司和小团队的轻量生产级系统：

```text
能自动生产内容
能自动发布页面
能自动收款
能自动发货
失败能告警
数据能恢复
版本能回滚
增长时不立刻推倒重来
```

在业务早期，它保持足够轻。到了增长期，它也留下了清晰的拆分路径。
