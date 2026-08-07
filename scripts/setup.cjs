#!/usr/bin/env node
// camscanner-cli installer - cross-platform Node.js script.
// Requires Node.js >= 18 (uses native fetch).
//
// Usage:
//   node scripts/setup.cjs
//
// Environment variables (all optional):
//   CAMSCANNER_CLI_VERSION - version to install (default: read from SKILL.md)
//   CAMSCANNER_CLI_CDN     - CDN base URL override
//   CAMSCANNER_CLI_DIR     - install directory override

'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pipeline } = require('stream/promises');

const CDN_BASE = process.env.CAMSCANNER_CLI_CDN || 'https://data.camscanner.com/camscanner-cli/releases';
const BIN_NAME = 'camscanner-cli';

function say(msg) { console.log(`  ${msg}`); }
function err(msg) { console.error(`  [ERROR] ${msg}`); process.exit(1); }

function detectPlatform() {
  const platform = os.platform();
  const arch = os.arch();
  const osMap = { linux: 'linux', darwin: 'darwin', win32: 'windows' };
  const archMap = { x64: 'amd64', arm64: 'arm64' };
  const osName = osMap[platform];
  const archName = archMap[arch];
  if (!osName) err(`Unsupported OS: ${platform}`);
  if (!archName) err(`Unsupported architecture: ${arch}`);
  return { os: osName, arch: archName };
}

function defaultInstallDir(osName) {
  if (process.env.CAMSCANNER_CLI_DIR) return process.env.CAMSCANNER_CLI_DIR;
  if (osName === 'windows') {
    return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'camscanner-cli');
  }
  return path.join(os.homedir(), '.local', 'bin');
}

function resolveVersion() {
  if (process.env.CAMSCANNER_CLI_VERSION) return process.env.CAMSCANNER_CLI_VERSION;
  const scriptDir = __dirname;
  const candidates = [
    path.join(scriptDir, '..', 'SKILL.md'),
    path.join(scriptDir, '..', '..', 'SKILL.md'),
    path.resolve('SKILL.md'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      const content = fs.readFileSync(candidate, 'utf8');
      const match = content.match(/^version:\s*"?([^"\s]+)"?\s*$/m);
      if (match) return match[1];
      const metadataMatch = content.match(/^metadata:\s*(\{.*\})\s*$/m);
      if (metadataMatch) {
        try {
          const metadata = JSON.parse(metadataMatch[1]);
          if (metadata.version) return metadata.version;
        } catch {
          // Ignore invalid metadata and continue searching.
        }
      }
    }
  }
  err('Cannot determine version. Set CAMSCANNER_CLI_VERSION explicitly.');
}

function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const va = pa[i] || 0;
    const vb = pb[i] || 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

function checkExisting(targetVersion) {
  try {
    const existingVer = execSync(`${BIN_NAME} --version`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    const existingPath = execSync(
      os.platform() === 'win32' ? `where ${BIN_NAME}` : `command -v ${BIN_NAME}`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim().split(/\r?\n/)[0];

    if (existingVer === targetVersion) {
      say(`${BIN_NAME} v${targetVersion} is already installed at ${existingPath}`);
      process.exit(0);
    }
    if (compareVersions(existingVer, targetVersion) >= 0) {
      say(`Installed ${BIN_NAME} v${existingVer} >= target v${targetVersion}, skipping.`);
      process.exit(0);
    }
    say(`Found existing ${BIN_NAME} v${existingVer} at ${existingPath}`);
    say(`Will upgrade to v${targetVersion}`);
  } catch {
    // Not installed; proceed.
  }
}

async function download(url, dest) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${url}`);
  const fileStream = fs.createWriteStream(dest);
  await pipeline(resp.body, fileStream);
}

async function main() {
  if (typeof globalThis.fetch !== 'function') {
    err('Node.js >= 18 required (native fetch). Current: ' + process.version);
  }

  const { os: osName, arch } = detectPlatform();
  const version = resolveVersion();
  const installDir = defaultInstallDir(osName);

  checkExisting(version);

  // Artifact naming matches the Makefile: camscanner-cli-{os}-{arch}[.exe]
  const binFile = osName === 'windows'
    ? `${BIN_NAME}-${osName}-${arch}.exe`
    : `${BIN_NAME}-${osName}-${arch}`;
  const downloadUrl = `${CDN_BASE}/v${version}/${binFile}`;

  say(`Installing ${BIN_NAME} v${version} (${osName}/${arch})...`);
  say(`Target: ${path.join(installDir, osName === 'windows' ? `${BIN_NAME}.exe` : BIN_NAME)}`);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'camscanner-cli-install-'));
  try {
    const tmpFile = path.join(tmpDir, binFile);

    say(`Downloading ${binFile}...`);
    await download(downloadUrl, tmpFile);

    fs.mkdirSync(installDir, { recursive: true });
    const destBin = path.join(installDir, osName === 'windows' ? `${BIN_NAME}.exe` : BIN_NAME);
    fs.copyFileSync(tmpFile, destBin);
    if (osName !== 'windows') fs.chmodSync(destBin, 0o755);

    say(`[OK] Installed: ${destBin}`);

    const envPath = process.env.PATH || '';
    if (!envPath.split(path.delimiter).includes(installDir)) {
      say('');
      say(`${installDir} is not in your PATH.`);
      if (osName === 'windows') {
        say(`  Run: [Environment]::SetEnvironmentVariable("PATH", "${installDir};$env:PATH", "User")`);
      } else {
        say(`  Add to ~/.bashrc or ~/.zshrc:`);
        say(`    export PATH="${installDir}:$PATH"`);
      }
    }

    say('');
    say(`${BIN_NAME} v${version} ready!`);
    say(`  Run: ${BIN_NAME} --version`);
    say(`  Login: ${BIN_NAME} auth login`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

main().catch(e => { err(e.message); });
