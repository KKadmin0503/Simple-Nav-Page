# Simple Nav Page 改造流程和结构清单

这份文档记录当前改造后的项目结构、上线流程、后台使用流程和后续扩展方式。后续继续开发时优先看这里，再看具体接口文档。

## 1. 当前目标

项目已经从原始静态导航页改造成可配置个人门户：

- 前台负责搜索、分类导航、背景、一言、页面特效、标题离开提示、Live2D。
- 后台负责配置站点信息、分类站点、小工具页面、JSON 导入导出和前台预览。
- Worker 负责公共配置、分类站点、小工具托管、管理员登录、访问统计、点击统计和在线保存。
- 鼠标拖尾类效果已从当前路线中移除，避免影响页面流畅度。

## 2. 目录结构

```text
Simple-Nav-Page/
├─ index.html                  # 前台导航页
├─ style.css                   # 前台样式
├─ admin.html                  # 后台管理页
├─ worker.js                   # Cloudflare Worker 代理、配置 API、小工具 API
├─ wrangler.toml               # Cloudflare Worker 部署配置
├─ package.json                # Wrangler 本地运行、检查和部署脚本
├─ .dev.vars.example           # 本地 Worker 后台密码示例
├─ links.json                  # 原始静态分类站点数据
├─ assets/
│  ├─ css/
│  │  └─ admin.css             # 后台样式
│  └─ js/
│     ├─ app.js                # 前台入口
│     ├─ config-loader.js      # 配置加载和本地保存
│     ├─ links-loader.js       # 分类站点加载、保存和清洗
│     ├─ nav-renderer.js       # 导航卡片渲染
│     ├─ search.js             # 搜索和搜索引擎切换
│     ├─ admin/
│     │  └─ admin-app.js       # 后台入口和编辑逻辑
│     ├─ effects/
│     │  └─ ambient-manager.js # 樱花、雪花、下雨等页面特效
│     └─ features/
│        ├─ background.js      # 图片/视频背景接口
│        ├─ favicon.js         # 站点图标和失败兜底
│        ├─ live2d.js          # Live2D 看板娘
│        ├─ network-toggle.js  # 内外网地址切换
│        ├─ quote.js           # 一言接口
│        └─ tab-title.js       # 标签页标题离开/返回提示
├─ data/
│  └─ default-config.json      # 默认页面配置
└─ docs/
   ├─ ai-tool-api.md           # AI 创建小工具接口说明
   ├─ cloudflare-github-deploy.md # GitHub 到 Cloudflare 部署说明
   └─ project-flow.md          # 当前文档
```

## 3. 本地使用流程

1. 打开 `index.html` 查看前台导航。
2. 打开 `admin.html` 进入后台。
3. 未部署 Worker 时，后台保存会写入当前浏览器本地配置，适合预览。
4. 修改基础配置、背景、一言、页面特效、标题、Live2D 等内容后，点“保存配置”。
5. 修改分类和站点后，同样点“保存配置”，前台刷新后读取新数据。
6. 创建小工具时，填写 `slug`、名称、描述和 HTML，勾选加入导航后保存。

## 4. Cloudflare Worker 部署流程

1. 安装依赖：

```powershell
npm install
```

2. 登录 Cloudflare：

```powershell
npx wrangler login
```

3. 创建 KV 命名空间：

```powershell
npx wrangler kv namespace create CONFIG_KV
npx wrangler kv namespace create CONFIG_KV --preview
```

4. 把返回的 `id` 和 `preview_id` 填入 `wrangler.toml`：

```toml
[[kv_namespaces]]
binding = "CONFIG_KV"
id = "你的生产 KV id"
preview_id = "你的预览 KV id"
```

5. 复制本地密钥示例：

```powershell
Copy-Item .dev.vars.example .dev.vars
```

6. 修改 `.dev.vars`，用于本地调试：

```text
ADMIN_PASSWORD=你的后台管理员密码
```

7. 写入线上 Worker Secret：

```powershell
npx wrangler secret put ADMIN_PASSWORD
```

8. 本地运行 Worker：

```powershell
npm run worker:dev
```

9. 部署 Worker：

```powershell
npm run worker:deploy
```

10. 将站点静态文件部署到 GitHub Pages、Cloudflare Pages 或同类静态托管。
11. 如果前台和 Worker 不在同一域名，需要保证前台请求的 API 地址指向 Worker。
12. 打开 `admin.html`，输入管理员密码登录。
13. 保存配置后，线上会写入 Worker/KV，前台刷新读取公共配置。
14. 在后台“发布检查”页点击“检测 Worker”，或直接访问 `/api/status`，确认 `ADMIN_PASSWORD`、`CONFIG_KV`、配置、分类站点、小工具、访问统计和点击统计状态。

如果走 Cloudflare Pages 连接 GitHub 仓库，完整步骤见 `docs/cloudflare-github-deploy.md`。

如果 Pages 和 Worker 不同域，在 `index.html` 和 `admin.html` 里填写：

```html
<meta name="simple-nav-api-base" content="https://你的-worker.workers.dev">
```

填 Worker 根地址，不要写 `/api`，末尾不要带 `/`。

## 5. 后台分页说明

后台分为六页：

- 基础配置：站点标题、标签页标题、favicon 图标源、访问统计、动态常用、背景、一言、特效、Live2D。
- 分类站点：新增、删除、编辑分类和站点。
- 小工具：创建、更新、删除 Worker 托管的小工具页面。
- 导入导出：直接查看和替换配置 JSON。
- 发布检查：上线前核对保存位置、Worker 状态、导航数据、手机端策略、小工具、备份和接口文档。
- 前台预览：在后台里快速查看前台页面。

危险操作已经增加确认，包括恢复默认、重载默认链接、删除分类、删除站点、删除小工具。

“常用”分区不再由后台自定义。后台保存和前台读取时都会过滤自定义“常用”，前台会根据点击统计自动生成最多 16 个常用站点。

## 6. AI 创建小工具流程

详细接口见 `docs/ai-tool-api.md`。最小流程如下：

1. `POST /api/admin/login` 获取管理员 `token`。
2. 生成完整 HTML，工具页面不能依赖后台 CSS。
3. `PUT /api/admin/tools` 保存工具。
4. 如果要自动加入导航，设置 `addToNav: true`。
5. 访问 `/tools/<slug>/` 验证工具页面。
6. 访问 `/api/links` 验证导航卡片是否已加入。

## 7. 访问和点击统计

前台顶部会显示网站总访问和今日访问。未部署 Worker 时使用当前浏览器本地统计；部署 Worker 且绑定 KV 后使用全站统计。

相关接口：

- `POST /api/analytics/visit`：记录一次访问，并返回总访问、今日访问和点击统计。
- `GET /api/analytics`：读取访问和点击统计。
- `POST /api/analytics/click`：记录一次站点点击，用于动态生成“常用”分区。

字段限制：

- `slug` 最长 64 个字符，只保留小写字母、数字和中划线。
- `title` 最长 80 个字符。
- `description` 最长 160 个字符。
- `html` 最长 250000 个字符。

## 8. 移动端规则

- 手机端不显示 Live2D。
- 手机端禁用重型页面特效。
- 后台分页和工具栏在窄屏下自动换行或横向滚动。
- 所有按钮和输入框需要保留明显焦点态。

## 9. 验证清单

每次改造后至少验证：

- 前台是否能渲染所有分类和卡片。
- “常用”是否由点击统计生成，且最多 16 个。
- 顶部访问统计是否显示总访问和今日访问。
- 手机端是否没有横向溢出。
- 一言接口失败时是否显示兜底文案。
- 背景接口失败时是否回退到固定图片或默认背景。
- favicon 失败时是否显示默认占位图。
- 后台“站点和图标”里是否能切换 DuckDuckGo/Google 图标源。
- 后台未登录时是否禁用 Worker 远程操作。
- 删除类操作是否出现确认框。
- Worker 未配置 `ADMIN_PASSWORD` 或 `CONFIG_KV` 时是否返回清晰错误。
- `/api/status` 是否能返回 Worker 部署状态和数据数量。
- 小工具公开列表是否不暴露 HTML 内容。

## 10. 后续可做

- 增加后台主题预览和配置变更历史。
- 增加 Worker KV 备份和导出接口。
- 增加小工具模板库，例如计算器、文本处理、图片处理、时间转换。
- 增加后台表单字段级校验提示。
- 增加 Cloudflare Pages 和 Worker 同域部署示例。
