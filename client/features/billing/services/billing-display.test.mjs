import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import ts from "typescript";

function loadTs(relative) {
  const filename = path.resolve(__dirname, relative);
  const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const mod = { exports: {} };
  new Function("require", "module", "exports", source)(
    (id) => id.startsWith(".") ? loadTs(path.resolve(path.dirname(filename), id.endsWith(".ts") ? id : `${id}.ts`)) : require(id),
    mod,
    mod.exports,
  );
  return mod.exports;
}

const { dateTime, money } = loadTs("./billing-display.ts");

test("billing money uses grouped French DZD display", () => {
  assert.equal(money("20997.00", "DZD"), "20 997,00 DZD");
  assert.equal(money(null, "DZD"), "0,00 DZD");
});

test("billing datetime uses 24-hour presentation", () => {
  const rendered = dateTime("2026-10-05T14:34:00+01:00");
  assert.match(rendered, /13:34|14:34/);
  assert.doesNotMatch(rendered, /AM|PM/i);
});
