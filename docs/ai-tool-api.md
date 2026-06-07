# AI 小工具创建接口

这份文档用于让 AI 或脚本在导航页的 Worker 里创建小工具网站。

## 部署前提

- Cloudflare Worker 使用仓库中的 `worker.js`
- 推荐使用仓库中的 `wrangler.toml` 部署 Worker
- Worker 环境变量：`ADMIN_PASSWORD`
- KV 绑定：`CONFIG_KV`
- 本地调试时复制 `.dev.vars.example` 为 `.dev.vars`

## 登录

```http
POST /api/admin/login
Content-Type: application/json

{
  "password": "你的后台密码"
}
```

返回：

```json
{
  "token": "..."
}
```

后续管理员接口请求头：

```http
Authorization: Bearer <token>
```

## 创建或更新小工具

```http
PUT /api/admin/tools
Authorization: Bearer <token>
Content-Type: application/json

{
  "slug": "bmi-calculator",
  "title": "BMI 计算器",
  "description": "计算 BMI 和健康区间",
  "html": "<!doctype html><html lang=\"zh-CN\">...</html>",
  "addToNav": true
}
```

字段说明：

- `slug`：工具访问路径，只允许小写字母、数字和中划线
- `title`：工具名称
- `description`：导航卡片描述
- `html`：完整 HTML 内容
- `addToNav`：是否自动加入导航里的“小工具”分类

访问地址：

```text
/tools/bmi-calculator/
```

## 小工具列表

```http
GET /api/tools
```

管理员完整列表：

```http
GET /api/admin/tools
Authorization: Bearer <token>
```

## Worker 状态检查

```http
GET /api/status
```

返回 Worker 发布状态，不需要管理员 Token，也不会暴露管理员密码或小工具 HTML：

```json
{
  "ok": true,
  "checks": {
    "adminPassword": { "ok": true, "message": "ADMIN_PASSWORD 已配置" },
    "kvBinding": { "ok": true, "message": "CONFIG_KV 已绑定" },
    "config": { "ok": true, "exists": true, "keys": 8 },
    "links": { "ok": true, "sections": 11, "sites": 157 },
    "tools": { "ok": true, "count": 1 }
  }
}
```

## 访问和点击统计

记录访问：

```http
POST /api/analytics/visit
Content-Type: application/json

{
  "date": "2026-06-07"
}
```

读取统计：

```http
GET /api/analytics
```

记录站点点击：

```http
POST /api/analytics/click
Content-Type: application/json

{
  "id": "https://github.com/",
  "title": "GitHub",
  "url": "https://github.com/"
}
```

这些接口用于顶部总访问/今日访问统计，以及自动生成最多 16 个站点的“常用”分区。

## 删除小工具

```http
DELETE /api/admin/tools/bmi-calculator
Authorization: Bearer <token>
```

## 分类和站点接口

公开读取：

```http
GET /api/links
```

管理员保存：

```http
PUT /api/admin/links
Authorization: Bearer <token>
Content-Type: application/json

[
  {
    "section": "小工具",
    "items": [
      {
        "title": "BMI 计算器",
        "url": "/tools/bmi-calculator/",
        "desc": "计算 BMI 和健康区间",
        "data-desc": "BMI 体重 健康",
        "icon": "https://example.com/icon.png",
        "intranet": ""
      }
    ]
  }
]
```

站点字段说明：

- `title`：前台卡片标题
- `url`：外网访问地址，也可以是 `/tools/xxx/` 这种 Worker 内部工具路径
- `desc`：前台卡片描述
- `data-desc`：搜索关键词
- `icon`：可选，手动指定站点图标 URL；不填时前台会自动获取网站 favicon，并在失败时显示默认占位图
- `intranet`：可选，内网地址；开启内外网切换时使用

## 字段限制

Worker 会在保存前做基础校验，避免 AI 一次写入过大的页面或无效字段：

- `slug`：不能为空，规范化后最长 64 个字符，只保留小写字母、数字和中划线
- `title`：不能为空，最长 80 个字符
- `description`：最长 160 个字符
- `html`：不能为空，最长 250000 个字符
- 小工具最多 50 个
- 小工具总占用最多 5 MiB
- `links`：`PUT /api/admin/links` 的请求体必须是分类数组，不能传单个对象

`GET /api/admin/tools` 和 `PUT /api/admin/tools` 会返回 `usage`，可用于显示资源占用：

```json
{
  "usage": {
    "toolCount": 3,
    "maxTools": 50,
    "totalBytes": 120000,
    "maxTotalBytes": 5242880,
    "maxToolHtmlLength": 250000,
    "countPercent": 6,
    "bytesPercent": 2
  }
}
```

## 返回格式

成功示例：

```json
{
  "ok": true,
  "tool": {
    "slug": "bmi-calculator",
    "title": "BMI 计算器",
    "description": "计算 BMI 和健康区间",
    "url": "/tools/bmi-calculator/",
    "updatedAt": "2026-06-07T00:00:00.000Z"
  },
  "usage": {
    "toolCount": 1,
    "maxTools": 50,
    "totalBytes": 2048,
    "maxTotalBytes": 5242880,
    "maxToolHtmlLength": 250000,
    "countPercent": 2,
    "bytesPercent": 1
  },
  "url": "/tools/bmi-calculator/"
}
```

失败示例：

```json
{
  "error": "slug、title、html 不能为空"
}
```

常见状态码：

- `400`：请求体不是合法 JSON，或字段不符合限制
- `401`：未登录、Token 缺失或 Token 已过期
- `404`：接口或小工具页面不存在
- `501`：Worker 未配置 `ADMIN_PASSWORD` 或未绑定 `CONFIG_KV`
- `500`：Worker 内部处理失败，会返回 `detail` 便于排查

## 给 AI 的最小流程

1. `POST /api/admin/login` 获取 `token`
2. 生成完整 HTML，确保移动端可用，不依赖后台页面的 CSS 或 JS
3. `PUT /api/admin/tools` 保存工具，按需设置 `addToNav: true`
4. 调用 `GET /tools/<slug>/` 检查页面是否可访问
5. 调用 `GET /api/links` 检查导航里是否已有对应卡片
6. 调用 `GET /api/status` 检查 Worker/KV 状态

接口支持跨域预检，允许 `GET,POST,PUT,DELETE,OPTIONS`，请求头允许 `Content-Type,Authorization`。

## 小工具页面安全边界

`/tools/<slug>/` 会直接托管你提交的 HTML。为了避免 AI 生成的小工具影响后台登录态，Worker 会给工具页面加 `Content-Security-Policy: sandbox`：

- 工具页面可以运行自己的内联脚本和样式
- 工具页面可以访问 HTTPS 外部资源
- 工具页面不能依赖后台页面的同源 `sessionStorage`、`localStorage` 或管理员 Token
- 工具页面不应该调用 `/api/admin/*`，需要后台能力时应让管理员在后台执行保存

如果某个工具必须使用浏览器本地存储，建议改用工具页面内部状态、URL 参数，或后续单独做安全隔离域名。
