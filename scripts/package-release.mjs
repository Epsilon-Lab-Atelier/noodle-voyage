import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const parent = path.dirname(root);
const outputPath = path.join(parent, 'noodle-voyage-v2.1.2.zip');
const stagingRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'noodle-voyage-release-'));
const stagedProject = path.join(stagingRoot, 'v2.1.2');

const ignoredNames = new Set(['node_modules', 'dist', '.git', '.vite', 'coverage']);
const ignoredFiles = new Set(['private-terms.local.txt', 'privacy-allowlist.local.json', 'ramen-master.xlsx', '.DS_Store']);

function copyDirectory(source, target) {
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredNames.has(entry.name)) continue;
    if (!entry.isDirectory() && (ignoredFiles.has(entry.name) || entry.name.endsWith('.zip') || entry.name.endsWith('.log'))) continue;
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) copyDirectory(sourcePath, targetPath);
    else fs.copyFileSync(sourcePath, targetPath);
  }
}

try {
  copyDirectory(root, stagedProject);
  if (fs.existsSync(outputPath)) fs.rmSync(outputPath);
  const result = spawnSync('zip', ['-q', '-r', outputPath, 'v2.1.2'], { cwd: stagingRoot, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`zip command failed with status ${result.status}`);
  console.log(`Created ${outputPath} (${fs.statSync(outputPath).size} bytes)`);
} finally {
  fs.rmSync(stagingRoot, { recursive: true, force: true });
}
