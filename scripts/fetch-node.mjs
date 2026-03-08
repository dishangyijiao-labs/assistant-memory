#!/usr/bin/env node
// Downloads the official Node.js standalone binary for bundling in the Tauri app.
// Uses a self-contained build (no shared libnode) so it works without Homebrew.
import { execSync } from "child_process";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import { arch, platform } from "os";

// Must match the local Node.js major version so native addons (better-sqlite3) are compatible.
const NODE_VERSION = `v${process.versions.node}`;
const dest = join("src-tauri", "resources", "bundled-node");

if (!existsSync(dest)) mkdirSync(dest, { recursive: true });

const plat = platform() === "darwin" ? "darwin" : "linux";
const ar = arch() === "arm64" ? "arm64" : "x64";
const tarName = `node-${NODE_VERSION}-${plat}-${ar}`;
const url = `https://nodejs.org/dist/${NODE_VERSION}/${tarName}.tar.gz`;
const tmp = `/tmp/${tarName}.tar.gz`;

if (!existsSync(tmp)) {
  console.log(`Downloading ${url} ...`);
  execSync(`curl -sL "${url}" -o "${tmp}"`, { stdio: "inherit" });
}

console.log("Extracting node binary...");
execSync(`tar -xzf "${tmp}" -C /tmp/`);
execSync(`cp "/tmp/${tarName}/bin/node" "${dest}/node"`);
execSync(`chmod u+rwx "${dest}/node"`);
console.log(`Bundled node ${NODE_VERSION} (${plat}-${ar}) -> ${dest}/node`);
