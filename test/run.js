#!/usr/bin/env node
/* =========================================================
   Runs every *.test.js in this directory, each in its own process so one
   file's stub DOM cannot leak into another's.

   No dependencies and no framework: `node test/run.js`.
   ========================================================= */
"use strict";

const fs = require("fs");
const nodePath = require("path");
const { spawnSync } = require("child_process");

const dir = __dirname;
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".test.js")).sort();

if (!files.length) {
  console.error("No test files found in " + dir);
  process.exit(1);
}

// app.js is loaded into a stub DOM rather than parsed by a bundler, so a
// syntax error would otherwise surface as a confusing runtime failure.
const syntax = ["app.js", "store.js", "data.js", "config.js"].filter((f) =>
  fs.existsSync(nodePath.join(dir, "..", f))
);
for (const f of syntax) {
  const res = spawnSync(process.execPath, ["--check", nodePath.join(dir, "..", f)], {
    stdio: "inherit",
  });
  if (res.status !== 0) {
    console.error("\nSyntax error in " + f);
    process.exit(1);
  }
}

let failed = 0;
for (const f of files) {
  const res = spawnSync(process.execPath, [nodePath.join(dir, f)], { stdio: "inherit" });
  if (res.status !== 0) failed++;
}

console.log(
  failed
    ? "\x1b[31m" + failed + " of " + files.length + " test files failed\x1b[0m"
    : "\x1b[32m" + files.length + " test files passed\x1b[0m"
);
process.exit(failed ? 1 : 0);
