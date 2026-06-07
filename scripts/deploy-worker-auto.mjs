import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const workerName = 'simple-nav-page';
const workerEntry = resolve('worker.js');
const bindingName = 'CONFIG_KV';
const namespaceTitle = process.env.CONFIG_KV_NAMESPACE || `${workerName}-config`;
const generatedConfigPath = resolve('.wrangler/generated-wrangler.toml');
const generatedSiteDir = resolve('.wrangler/site');
const staticEntries = [
  'index.html',
  'admin.html',
  'robots.txt',
  'sitemap.xml',
  'style.css',
  'links.json',
  'assets',
  'data'
];

main();

function main() {
  console.log(`[deploy] Preparing Cloudflare Worker "${workerName}".`);
  if (!existsSync(workerEntry)) {
    throw new Error(`Worker entry file was not found: ${workerEntry}`);
  }

  const namespaceId = process.env.CONFIG_KV_ID || process.env.CONFIG_KV_NAMESPACE_ID || ensureKvNamespace(namespaceTitle);

  prepareStaticAssets();
  writeGeneratedConfig(namespaceId);

  if (process.env.DEPLOY_DRY_RUN === '1') {
    console.log('[deploy] Dry run complete. Skipping Wrangler deploy.');
    return;
  }

  runWrangler(['deploy', '--config', generatedConfigPath]);

  if (process.env.ADMIN_PASSWORD) {
    runWrangler(['secret', 'put', 'ADMIN_PASSWORD', '--config', generatedConfigPath], {
      input: `${process.env.ADMIN_PASSWORD}\n`,
      allowFailure: true
    });
  } else {
    console.warn('[deploy] ADMIN_PASSWORD is not set. Add it in Cloudflare settings before using admin login.');
  }

  console.log('[deploy] Done.');
}

function prepareStaticAssets() {
  assertInsideWorkspace(generatedSiteDir);
  rmSync(generatedSiteDir, { recursive: true, force: true });
  mkdirSync(generatedSiteDir, { recursive: true });

  staticEntries.forEach(entry => {
    const source = resolve(entry);
    if (!existsSync(source)) {
      throw new Error(`Static asset entry was not found: ${source}`);
    }
    cpSync(source, resolve(generatedSiteDir, entry), { recursive: true });
  });

  console.log(`[deploy] Prepared static assets in ${generatedSiteDir}.`);
}

function ensureKvNamespace(title) {
  const existing = findNamespace(title);
  if (existing?.id) {
    console.log(`[deploy] Reusing KV namespace "${title}" (${existing.id}).`);
    return existing.id;
  }

  console.log(`[deploy] Creating KV namespace "${title}".`);
  const output = runWrangler(['kv', 'namespace', 'create', title, '--binding', bindingName]);
  const createdId = extractNamespaceId(output);
  if (createdId) return createdId;

  const created = findNamespace(title);
  if (created?.id) return created.id;

  throw new Error(`KV namespace "${title}" was created but its id could not be detected.`);
}

function findNamespace(title) {
  const output = runWrangler(['kv', 'namespace', 'list']);
  return parseNamespaces(output).find(namespace => namespace.title === title);
}

function writeGeneratedConfig(namespaceId) {
  mkdirSync(dirname(generatedConfigPath), { recursive: true });
  const mainPath = toTomlPath(relative(dirname(generatedConfigPath), workerEntry));
  const assetsPath = toTomlPath(relative(dirname(generatedConfigPath), generatedSiteDir));
  writeFileSync(generatedConfigPath, `name = "${workerName}"
main = "${mainPath}"
compatibility_date = "2026-06-07"
workers_dev = true

assets = { directory = "${assetsPath}", binding = "ASSETS", not_found_handling = "none" }

[[kv_namespaces]]
binding = "${bindingName}"
id = "${namespaceId}"
preview_id = "${namespaceId}"
`, 'utf8');
  console.log(`[deploy] Generated ${generatedConfigPath}.`);
}

function toTomlPath(value) {
  return value.replace(/\\/g, '/');
}

function assertInsideWorkspace(path) {
  const workspace = resolve('.');
  const target = resolve(path);
  if (target !== workspace && !target.startsWith(`${workspace}${process.platform === 'win32' ? '\\' : '/'}`)) {
    throw new Error(`Refusing to modify path outside workspace: ${target}`);
  }
}

function parseNamespaces(output) {
  const jsonMatch = output.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) {
        return parsed
          .map(item => ({ id: String(item.id || ''), title: String(item.title || '') }))
          .filter(item => item.id && item.title);
      }
    } catch {
      // Fall back to text parsing below.
    }
  }

  return output
    .split(/\r?\n/)
    .map(line => {
      const idMatch = line.match(/\b([a-f0-9]{32})\b/i);
      if (!idMatch) return null;
      const id = idMatch[1];
      const title = line
        .replace(id, '')
        .replace(/[│|]/g, ' ')
        .trim()
        .split(/\s+/)
        .find(part => part && part !== 'id' && part !== 'title');
      return title ? { id, title } : null;
    })
    .filter(Boolean);
}

function extractNamespaceId(output) {
  return output.match(/\bid\s*=\s*"([^"]+)"/)?.[1]
    || output.match(/\b([a-f0-9]{32})\b/i)?.[1]
    || '';
}

function runWrangler(args, options = {}) {
  const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const result = spawnSync(command, ['wrangler', ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
    input: options.input,
    shell: false
  });

  const output = `${result.stdout || ''}${result.stderr || ''}`;
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(`wrangler ${args.join(' ')} failed with exit code ${result.status}`);
  }

  if (result.status !== 0 && options.allowFailure) {
    console.warn(`[deploy] Optional command failed: wrangler ${args.join(' ')}`);
  }

  return output;
}
