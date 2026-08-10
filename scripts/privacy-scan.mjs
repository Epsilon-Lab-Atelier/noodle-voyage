import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const includeDist = process.argv.includes('--include-dist');
const localTermsPath = path.join(root, 'private-terms.local.txt');
const localAllowlistPath = path.join(root, 'privacy-allowlist.local.json');

const ignoredDirectories = new Set(['node_modules', '.git', '.vite', 'coverage']);
if (!includeDist) ignoredDirectories.add('dist');
const ignoredFiles = new Set([
  'private-terms.local.txt',
  'private-terms.example.txt',
  'privacy-allowlist.local.json',
  'privacy-allowlist.example.json',
  'scripts/privacy-scan.mjs'
]);
const textExtensions = new Set([
  '.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.html', '.css', '.md', '.txt',
  '.csv', '.yml', '.yaml', '.svg', '.xml', '.webmanifest', '.toml', '.ini', '.env'
]);
const generatedDependencyMetadataFiles = new Set([
  'package-lock.json',
  'npm-shrinkwrap.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lock',
  'bun.lockb'
]);
const isGeneratedDependencyMetadata = (relativePath) =>
  generatedDependencyMetadataFiles.has(path.posix.basename(relativePath));
const isGeneratedDependencyDeprecation = (relativePath, line) =>
  isGeneratedDependencyMetadata(relativePath) && /^\s*\"deprecated\"\s*:/.test(line);

const normalizePath = (filePath) => path.relative(root, filePath).split(path.sep).join('/');
const globMatches = (relativePath, pattern) => {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '::DOUBLE_STAR::')
    .replace(/\*/g, '[^/]*')
    .replace(/::DOUBLE_STAR::/g, '.*');
  return new RegExp(`^${escaped}$`).test(relativePath);
};

const allowlist = fs.existsSync(localAllowlistPath)
  ? JSON.parse(fs.readFileSync(localAllowlistPath, 'utf8')).rules ?? []
  : [];
const isAllowed = (term, relativePath) => allowlist.some((rule) =>
  rule.term === term && (rule.paths ?? []).some((pattern) => globMatches(relativePath, pattern))
);

const privateTerms = fs.existsSync(localTermsPath)
  ? fs.readFileSync(localTermsPath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
  : [];

const secretPatterns = [
  { label: 'macOS absolute user path', regex: /\/Users\/[A-Za-z0-9._-]+\//g },
  { label: 'Linux absolute home path', regex: /\/home\/[A-Za-z0-9._-]+\//g },
  { label: 'Windows absolute user path', regex: /[A-Za-z]:\\Users\\[A-Za-z0-9._-]+\\/g },
  { label: 'private key header', regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { label: 'GitHub token-like value', regex: /\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}\b/g },
  { label: 'generic bearer token', regex: /\bBearer\s+[A-Za-z0-9._-]{24,}\b/g },
  { label: 'AWS access key-like value', regex: /\bAKIA[0-9A-Z]{16}\b/g },
  {
    label: 'email address outside public noreply domains',
    regex: /\b[A-Z0-9._%+-]+@(?!users\.noreply\.github\.com\b)[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    sourceOnly: true,
    skipGeneratedDependencyDeprecation: true
  }
];

function collectFiles(current) {
  const entries = fs.readdirSync(current, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const fullPath = path.join(current, entry.name);
    const relativePath = normalizePath(fullPath);
    if (entry.isDirectory()) result.push(...collectFiles(fullPath));
    else if (!ignoredFiles.has(relativePath) && textExtensions.has(path.extname(entry.name).toLowerCase())) result.push(fullPath);
  }
  return result;
}

const findings = [];
for (const filePath of collectFiles(root)) {
  const relativePath = normalizePath(filePath);
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    for (const term of privateTerms) {
      if (line.includes(term) && !isAllowed(term, relativePath)) {
        findings.push({ file: relativePath, line: index + 1, kind: `private term: ${term}`, excerpt: line.trim().slice(0, 160) });
      }
    }
    for (const pattern of secretPatterns) {
      if (pattern.sourceOnly && relativePath.startsWith('dist/')) continue;
      if (pattern.skipGeneratedDependencyDeprecation && isGeneratedDependencyDeprecation(relativePath, line)) continue;
      pattern.regex.lastIndex = 0;
      if (pattern.regex.test(line)) {
        findings.push({ file: relativePath, line: index + 1, kind: pattern.label, excerpt: line.trim().slice(0, 160) });
      }
    }
  }
}

// The reader's own places, menus and records live in the browser. Nothing the
// build publishes may carry the shapes those records are stored in (spec 15.3).
const privateRecordKeys = ['googlePlaceId', 'nameNormalized', 'tabelogUrl', 'placeSnapshot', 'menuSnapshot', 'customConceptId', 'targetType', 'legacyFavoriteDishIds', 'storageSchemaVersion'];
const publishedDataDirectories = ['public/data', ...(includeDist ? ['dist/data'] : [])];
for (const directory of publishedDataDirectories) {
  const absolute = path.join(root, directory);
  if (!fs.existsSync(absolute)) continue;
  for (const filePath of collectFiles(absolute)) {
    if (!filePath.endsWith('.json')) continue;
    const relativePath = normalizePath(filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    for (const key of privateRecordKeys) {
      if (content.includes(`"${key}"`)) {
        findings.push({ file: relativePath, line: 0, kind: 'private record field in published data', excerpt: key });
      }
    }
  }
}

if (findings.length) {
  console.error(`Privacy scan failed with ${findings.length} finding(s):`);
  for (const finding of findings.slice(0, 100)) {
    console.error(`- ${finding.file}:${finding.line} [${finding.kind}] ${finding.excerpt}`);
  }
  process.exit(1);
}

const termNotice = privateTerms.length
  ? `${privateTerms.length} local private term(s) loaded`
  : 'no private-terms.local.txt found; built-in path and secret checks only';
console.log(`Privacy scan passed (${termNotice}${includeDist ? ', dist included' : ''}).`);
