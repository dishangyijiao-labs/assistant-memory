#!/usr/bin/env node

// Called by npm's "version" lifecycle hook.
// Syncs the version from package.json to tauri.conf.json and Cargo.toml,
// then stages the changed files so they're included in npm's auto-commit.

import { readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";

const version = JSON.parse(readFileSync("package.json", "utf-8")).version;

// tauri.conf.json
const tauriPath = "src-tauri/tauri.conf.json";
const tauri = JSON.parse(readFileSync(tauriPath, "utf-8"));
tauri.version = version;
writeFileSync(tauriPath, JSON.stringify(tauri, null, 2) + "\n");

// Cargo.toml
const cargoPath = "src-tauri/Cargo.toml";
let cargo = readFileSync(cargoPath, "utf-8");
cargo = cargo.replace(/^version = ".*"/m, `version = "${version}"`);
writeFileSync(cargoPath, cargo);

// Update Cargo.lock
execSync("cargo check --manifest-path src-tauri/Cargo.toml --quiet 2>/dev/null || true");

// Stage files so npm includes them in the version commit
execSync(`git add ${tauriPath} ${cargoPath} src-tauri/Cargo.lock`);

console.log(`Synced version ${version} to tauri.conf.json and Cargo.toml`);
