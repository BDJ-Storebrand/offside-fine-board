/* =========================================================
   Shared rig for the Offside tests.

   There is no build step and no test framework — the site is plain scripts a
   browser loads in order, so the tests load them the same way: into a `vm`
   context with a hand-rolled stub DOM. That keeps the thing being tested the
   actual app.js that ships, not a module-shaped copy of it.

   The stub is deliberately thin. It records what the app writes (innerHTML,
   textContent, hidden) and what it listens for, and does nothing else. If a
   test needs the DOM to behave in some richer way, prefer asserting on the
   HTML the app produced over teaching the stub new tricks.
   ========================================================= */
"use strict";

const fs = require("fs");
const vm = require("vm");
const nodePath = require("path");

const ROOT = nodePath.join(__dirname, "..");

/* Every element is conjured on first query and remembered, so a test can
   inspect `els["#feed"]` after the app has written to it. */
function makeEl(sel) {
  return {
    _sel: sel,
    _handlers: {},
    _focused: false,
    innerHTML: "",
    textContent: "",
    className: "",
    hidden: false,
    value: "",
    disabled: false,
    classList: { add() {}, remove() {} },
    style: {},
    addEventListener(ev, fn) {
      (this._handlers[ev] = this._handlers[ev] || []).push(fn);
    },
    setAttribute() {},
    getAttribute() { return null; },
    focus() { this._focused = true; },
    closest() { return null; },
  };
}

/**
 * Boot the real data.js + app.js against a stub DOM.
 *
 * `fixture(RULES)` returns the ledger to serve, and is handed the rule ids
 * from data.js so tests never hard-code a rule name that a future edit to the
 * rule book would invalidate.
 */
function boot(fixture, options) {
  const opts = options || {};
  const els = {};
  const localStore = {};
  const calls = { inserted: null, removed: [] };

  const document = {
    querySelector(sel) { return els[sel] || (els[sel] = makeEl(sel)); },
    querySelectorAll() { return []; },
    addEventListener() {},
    hidden: false,
  };

  const window = {
    localStorage: {
      getItem: (k) => (k in localStore ? localStore[k] : null),
      setItem: (k, v) => { localStore[k] = String(v); },
      removeItem: (k) => { delete localStore[k]; },
    },
  };

  const squad = opts.squad || [
    { id: "eivind", name: "Eivind", colour: "#b20000" },
    { id: "isabel", name: "Isabel", colour: "#da291c" },
    { id: "mie", name: "Mie", colour: "#819f2b" },
    { id: "tor", name: "Tor", colour: "#410e44" },
  ];

  let fines = [];

  const ctx = {
    window, document, console,
    setTimeout, clearTimeout, setInterval, clearInterval,
    Date, Math, Object, JSON, String, Number, Array, Error, Promise,
    OffsideStore: {
      configured: () => true,
      players: async () => squad.slice(),
      fines: async () => fines.slice(),
      addFine: async (f) => {
        calls.inserted = f;
        return Object.assign({ id: "new-1", at: Date.now() }, f);
      },
      removeFine: async (id) => {
        calls.removed.push(id);
        if (opts.removeFineThrows) throw new Error(opts.removeFineThrows);
      },
      subscribe: () => {},
    },
  };

  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(nodePath.join(ROOT, "data.js"), "utf8"), ctx);

  // data.js declares `const INFRACTIONS`, which lands in the context's lexical
  // scope rather than on the sandbox object — reach it by evaluating inside.
  const RULES = vm.runInContext("INFRACTIONS.map(function (i) { return i.id })", ctx);
  const ruleName = (id) =>
    vm.runInContext(
      "INFRACTIONS.filter(function (i) { return i.id === " + JSON.stringify(id) + " })[0].name",
      ctx
    );

  fines = fixture(RULES);
  vm.runInContext(fs.readFileSync(nodePath.join(ROOT, "app.js"), "utf8"), ctx);

  // `els` only holds what the app has already queried. Some elements (the
  // note field, say) are looked up lazily on submit, so a test that wants to
  // set one up front has to conjure it the same way the app would.
  const el = (sel) => document.querySelector(sel);

  return { els, el, ctx, calls, localStore, squad, RULES, ruleName, fines };
}

/* app.js loads its data asynchronously, so tests need a beat before asserting. */
const settle = (ms) => new Promise((r) => setTimeout(r, ms === undefined ? 60 : ms));

/* Minimal tally. Each test file is its own process; run.js sums the exits. */
function suite(title) {
  let failed = 0;
  console.log("\n\x1b[1m" + title + "\x1b[0m");
  return {
    section(name) { console.log("\n  " + name); },
    check(name, cond, detail) {
      console.log((cond ? "    \x1b[32mPASS\x1b[0m  " : "    \x1b[31mFAIL\x1b[0m  ") + name);
      if (!cond) {
        failed++;
        if (detail !== undefined) console.log("          " + detail);
      }
    },
    done() {
      console.log(failed ? "\n  \x1b[31m" + failed + " failed\x1b[0m\n" : "\n  \x1b[32mall passed\x1b[0m\n");
      process.exit(failed ? 1 : 0);
    },
  };
}

/* Pull the standings table apart into { playerName: [cell text, ...] }. */
function boardRows(html) {
  const rows = {};
  (html.match(/<tr>[\s\S]*?<\/tr>/g) || []).forEach((tr) => {
    const cells = (tr.match(/<td[^>]*>[\s\S]*?<\/td>/g) || []).map((c) =>
      c.replace(/<[^>]*>/g, "").trim()
    );
    const name = (tr.match(/class="player__name">([^<]+)</) || [])[1];
    if (name) rows[name] = cells;
  });
  return rows;
}

module.exports = { ROOT, boot, settle, suite, boardRows };
