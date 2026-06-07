# GitHub 到 Cloudflare 部署流程

这份流程用于把当前项目推送到 GitHub，并接入 Cloudflare Pages + Cloudflare Worker。

## 1. 推送代码到 GitHub

当前仓库远程地址是：

```text
https://github.com/KKadmin0503/Simple-Nav-Page.git
```

提交并推送：

```powershell
git status
git add .
git commit -m "feat: add configurable nav admin and worker deployment"
git push origin main
```

## 2. 部署静态前台到 Cloudflare Pages

1. 进入 Cloudflare Dashboard。
2. 打开 Workers & Pages。
3. 创建 Pages 项目。
4. 选择连接 GitHub 仓库。
5. 选择 `KKadmin0503/Simple-Nav-Page`。
6. Framework preset 选择 `None`。
7. Build command 留空。
8. Build output directory 使用项目根目录。
9. 部署完成后记录 Pages 域名。

## 3. 创建 Worker KV

本地执行：

```powershell
npx wrangler login
npx wrangler kv namespace create CONFIG_KV
npx wrangler kv namespace create CONFIG_KV --preview
```

把返回的 `id` 和 `preview_id` 写入 `wrangler.toml`。

## 4. 配置 GitHub Secrets

进入 GitHub 仓库：

```text
Settings -> Secrets and variables -> Actions -> New repository secret
```

需要添加：

- `CLOUDFLARE_API_TOKEN`：Cloudflare API Token，需要 Workers 部署权限。
- `CLOUDFLARE_ACCOUNT_ID`：Cloudflare Account ID。
- `ADMIN_PASSWORD`：导航后台管理员密码。

## 5. 自动部署 Worker

`.github/workflows/deploy-worker.yml` 会在推送 `worker.js`、`wrangler.toml`、`package.json` 或工作流文件时自动部署 Worker。

也可以在 GitHub Actions 页面手动运行 `Deploy Worker`。

## 6. 连接前台和 Worker

如果 Pages 和 Worker 不是同一个域名，需要在 `index.html` 和 `admin.html` 里填写 Worker 根地址：

```html
<meta name="simple-nav-api-base" content="https://你的-worker.workers.dev">
```

填的是 Worker 根地址，不要写 `/api`，末尾不要带 `/`。

填写后：

- 前台会从 Worker 读取 `/api/config`、`/api/links` 和访问统计。
- 后台会向 Worker 调用登录、保存、发布检查和小工具接口。
- `/tools/<slug>/` 小工具链接会自动指向 Worker。

## 7. 上线检查

1. 打开 Pages 域名确认前台正常。
2. 打开 `admin.html`。
3. 输入 `ADMIN_PASSWORD` 登录。
4. 进入“发布检查”页，点击“检测 Worker”。
5. 确认 `ADMIN_PASSWORD`、`CONFIG_KV`、配置、分类站点、小工具和访问统计均正常。
