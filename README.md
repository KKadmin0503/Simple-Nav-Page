# 🌐 Simple Nav Page

一个**低门槛的个人导航页模板**，无需服务器，小白也能快速搭建属于自己的导航页。

---

## ✨ 特点

* 🚀 **无需服务器**：支持 Cloudflare Worker 一次部署前台、后台接口和小工具

* 🧩 **极简配置**：只需修改少量文件即可完成自定义

* 🎯 **面向新手**：无需前端基础也能上手

* 🌙 **轻量美观**：简洁 UI，专注实用体验

* 📱 **响应式布局**：自适应手机、平板与桌面端

* 🔍 **多搜索引擎支持**：内置常用搜索分类与引擎

* ⚡ **站内快速检索**：支持标题 & 描述关键词筛选

* 🖼️ **自动网站图标**：自动获取 favicon（多源 fallback）

* ✨ **站点信息自动匹配**：后台填入 URL 后可自动读取标题、简介和图标

* 🌄 **随机背景图**：每次刷新自动切换背景

* 🌐 **内外网地址切换**：默认外网，一键切换

---

## 🧑‍💻 适合人群

* 想要一个属于自己的导航页
* 不会前端 / 不想折腾部署
* 没有服务器
* 想快速搭建个人主页

---

## 🛠️ 使用方法

### 1️⃣ Fork 项目

点击右上角 Fork

---

### 2️⃣ 修改页面标题

编辑 `index.html`：

```html
<title>你的导航页名称</title>
```

---

### 3️⃣ 配置网站数据

编辑 `links.json`：

* `section`：分类名
* `title`：显示名称、用于站内定位关键词(不宜过长)
* `data-desc`：用于站内定位关键词
* `desc` ：网站下方的介绍
* `url`：网站地址
  
* `intranet`（可选）：若有内外网切换需求，则在"url" 下方加一行，【"intranet": "输入你的内网网址",】

图标源不需要再改 `main.js`。进入 `admin.html` 后台，在“基础配置 -> 站点和图标”里可以切换：

* `DuckDuckGo`：默认图标源
* `Google`：Google favicon 服务

如果图标访问不稳定，可以填写 Worker 代理地址。

默认站点 Logo 和浏览器 favicon 位于：

```text
assets/brand/chengyan-inkmark-logo.svg
```

---

### 4️⃣（推荐）部署 Cloudflare Worker

如果你在国内访问时遇到：

* 图标无法加载

可以使用项目内置的 `worker.js` 来部署代理服务。改造后的 Worker 也负责后台登录、线上配置保存、小工具托管、访问统计和点击统计。

---

#### 📦 命令部署流程

先安装依赖：

```powershell
npm install
```

登录 Cloudflare：

```powershell
npx wrangler login
```

复制本地密钥示例，并修改后台管理员密码：

```powershell
Copy-Item .dev.vars.example .dev.vars
```

`.dev.vars` 内容示例：

```text
ADMIN_PASSWORD=你的后台管理员密码
```

本地运行 Worker：

```powershell
npm run worker:dev
```

写入线上后台密码：

```powershell
npx wrangler secret put ADMIN_PASSWORD
```

部署 Worker：

```powershell
npm run worker:deploy
```

`npm run worker:deploy` 会自动检查并创建 KV：`simple-nav-page-config`，不需要手动把 KV ID 写进 `wrangler.toml`。

部署成功后，直接打开 Worker 域名就是导航页：

```text
https://你的-worker.workers.dev
```

后台地址：

```text
https://你的-worker.workers.dev/admin.html
```

---

#### 🔗 部署后使用方式

假设你的worker自定义域名是：

```text id="8n1jnt"
https://api.xxx.com
```

当前推荐 Worker 同域部署，`index.html` 和 `admin.html` 的 `simple-nav-api-base` 保持空值即可自动使用当前域名。

如果你另外单独部署 Pages，才需要在 `index.html` 和 `admin.html` 里填写 Worker 根地址：

```html
<meta name="simple-nav-api-base" content="https://api.xxx.com">
```

填 Worker 根地址，不要写 `/api`，末尾不要带 `/`。

图标代理地址可以在后台“站点和图标”里填写，不需要再修改 `main.js`。

---

#### ⚙️ 原理说明

Worker 会代理以下资源：

* 网站图标：`icons.duckduckgo.com`,`www.google.com`

从而提升国内访问稳定性。

---

#### ✅ 优点

* 提升加载成功率
* 减少外部依赖
* 适合国内网络环境
  
---

### 5️⃣ 部署

部署到 Cloudflare 时，通常需要先把代码推送到 GitHub，再在 Cloudflare Dashboard 里连接仓库。完整流程见 [`docs/cloudflare-github-deploy.md`](docs/cloudflare-github-deploy.md)。

推荐只部署 Worker，一个域名同时访问前台、后台和 API：

* `/`：前台导航页
* `/admin.html`：后台管理页
* `/api/status`：Worker 状态
* `/tools/<slug>/`：小工具页面

如果 Pages 和 Worker 分开部署，才需要在 `index.html` 和 `admin.html` 的 meta 里填写 Worker 根地址：

```html
<meta name="simple-nav-api-base" content="https://你的-worker.workers.dev">
```

填的是 Worker 根地址，不要写 `/api`。

---

### 6️⃣ 管理后台（可选）

项目已预留 `admin.html` 后台配置页。纯静态部署时，后台会把配置保存到当前浏览器，适合本地预览；如果需要线上管理员密码和公共配置，需要配合 Cloudflare Worker。

Worker 需要配置：

* 环境变量：`ADMIN_PASSWORD`
* KV 绑定：`CONFIG_KV`
* 部署配置：`wrangler.toml`
* 本地密钥：复制 `.dev.vars.example` 为 `.dev.vars`

接口：

* `GET /api/config`：前台读取线上配置
* `POST /api/admin/login`：后台登录
* `GET /api/admin/config`：后台读取配置
* `PUT /api/admin/config`：后台保存配置
* `GET /api/links`：前台读取分类和站点
* `GET /api/admin/links`：后台读取分类和站点
* `PUT /api/admin/links`：后台保存分类和站点
* `GET /api/admin/site-meta?url=`：后台根据 URL 自动匹配站点标题、描述和图标
* `GET /api/tools`：公开读取小工具列表
* `GET /api/admin/tools`：后台读取小工具列表
* `PUT /api/admin/tools`：创建或更新小工具网站
* `DELETE /api/admin/tools/<slug>`：删除小工具网站
* `GET /tools/<slug>/`：访问 Worker 托管的小工具页面
* `GET /api/status`：检查 Worker、后台密码、KV、配置、站点和小工具状态
* `GET /api/analytics`：读取访问统计和点击统计
* `POST /api/analytics/visit`：记录一次访问
* `POST /api/analytics/click`：记录一次站点点击，用于动态常用

AI 创建小工具的接口说明见 [`docs/ai-tool-api.md`](docs/ai-tool-api.md)。
完整改造流程和结构清单见 [`docs/project-flow.md`](docs/project-flow.md)。
GitHub 到 Cloudflare 的部署流程见 [`docs/cloudflare-github-deploy.md`](docs/cloudflare-github-deploy.md)。

小工具字段限制：

* `slug` 最长 64 个字符，只保留小写字母、数字和中划线
* `title` 最长 80 个字符
* `description` 最长 160 个字符
* `html` 最长 250000 个字符
* 小工具最多 50 个
* 小工具总占用最多 5 MiB，后台“小工具”页会显示进度条和具体数值

---

### 7️⃣ 完成 🎉

---

## 📸 示例

👉 https://xmynscnq.github.io/Simple-Nav-Page

<img width="1920" height="919" alt="王五导航 (04 05 2026 09_29)" src="https://github.com/user-attachments/assets/36f545b3-b3f6-4b26-9038-f27df15476ef" />

---

## 📄 开源协议

使用 MIT License，可自由使用与修改。
