# Cloudflare 连接 GitHub 部署流程

这份流程适用于在 Cloudflare Dashboard 里连接 GitHub 仓库部署。Cloudflare 自己拉取仓库并执行部署命令，不需要 GitHub Actions，也不需要在 GitHub 里配置 Cloudflare API Token。

## 1. 推送代码到 GitHub

当前仓库远程地址：

```text
https://github.com/KKadmin0503/Simple-Nav-Page.git
```

提交并推送：

```powershell
git status
git add .
git commit -m "feat: update nav deployment"
git push origin main
```

## 2. 部署 Worker 后台接口

在 Cloudflare Dashboard：

1. 打开 Workers & Pages。
2. 创建 Worker。
3. 选择连接 GitHub 仓库。
4. 选择 `KKadmin0503/Simple-Nav-Page`。
5. 构建命令留空。
6. 部署命令填写：

```bash
npm run worker:deploy
```

`npm run worker:deploy` 会自动完成：

- 检查是否存在 KV：`simple-nav-page-config`
- 不存在时自动创建 KV
- 自动生成带真实 KV ID 的临时 Wrangler 配置
- 部署 `worker.js`

因此不需要手动把 KV ID 写入 `wrangler.toml`。

## 3. 配置后台密码

后台登录依赖 `ADMIN_PASSWORD`。

推荐在 Cloudflare Worker 的环境变量或 Secret 里添加：

```text
ADMIN_PASSWORD=你的后台管理员密码
```

如果你在 Cloudflare 构建环境里也设置了 `ADMIN_PASSWORD`，自动部署脚本会尝试同步为 Worker Secret。未设置也不影响 Worker 部署，但后台登录会提示未配置密码。

## 4. 部署静态前台

在 Cloudflare Pages：

1. 创建 Pages 项目。
2. 连接同一个 GitHub 仓库。
3. Framework preset 选择 `None`。
4. Build command 留空。
5. Build output directory 使用项目根目录。
6. 部署完成后记录 Pages 域名。

## 5. 连接前台和 Worker

如果 Pages 和 Worker 不是同一个域名，需要在 `index.html` 和 `admin.html` 里填写 Worker 根地址：

```html
<meta name="simple-nav-api-base" content="https://你的-worker.workers.dev">
```

填 Worker 根地址，不要写 `/api`，末尾不要带 `/`。

填写后：

- 前台读取 Worker 的 `/api/config`、`/api/links` 和访问统计。
- 后台向 Worker 调用登录、保存、发布检查和小工具接口。
- `/tools/<slug>/` 小工具链接自动指向 Worker。

## 6. 上线检查

1. 打开 Pages 域名确认前台正常。
2. 打开 `admin.html`。
3. 输入 `ADMIN_PASSWORD` 登录。
4. 进入“发布检查”页，点击“检测 Worker”。
5. 确认 `ADMIN_PASSWORD`、`CONFIG_KV`、配置、分类站点、小工具和访问统计均正常。
