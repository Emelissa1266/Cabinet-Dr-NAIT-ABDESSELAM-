import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const cache = new Map();

function load(file) {
  let filename = path.resolve(root, file);
  if (!path.extname(filename)) filename += ".ts";
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = { exports: {} };
  cache.set(filename, mod);
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  new Function("require", "module", "exports", code)(
    (id) => id.startsWith("@/") ? load(id.slice(2)) : id.startsWith(".") ? load(path.resolve(path.dirname(filename), id)) : require(id),
    mod,
    mod.exports,
  );
  return mod.exports;
}

const {
  buildWorkingHourMutations,
  groupWorkingHours,
  isSchedulableRole,
} = load("features/admin/services/admin-working-hours.ts");

const existing = [
  { id: 1, staff: 10, weekday: 0, start_time: "09:00:00", end_time: "12:00:00", is_active: true },
  { id: 2, staff: 10, weekday: 0, start_time: "13:00:00", end_time: "17:00:00", is_active: true },
];

test("staff working hours preserve multiple intervals per weekday", () => {
  const grouped = groupWorkingHours(existing);
  assert.equal(grouped[0].length, 2);
  assert.equal(grouped[0][0].start_time, "09:00");
  assert.equal(grouped[0][1].start_time, "13:00");
});

test("user schedule synchronization creates updates and deletes real working-hour records", () => {
  const grouped = groupWorkingHours(existing);
  grouped[0] = [{ ...grouped[0][0], end_time: "12:30" }];
  grouped[1] = [{ weekday: 1, start_time: "10:00", end_time: "16:00", is_active: true }];
  const mutations = buildWorkingHourMutations(10, existing, grouped);
  assert.deepEqual(mutations.deleteIds, [2]);
  assert.equal(mutations.update.length, 1);
  assert.equal(mutations.update[0].id, 1);
  assert.equal(mutations.update[0].payload.end_time, "12:30:00");
  assert.deepEqual(mutations.create, [{ staff: 10, weekday: 1, start_time: "10:00:00", end_time: "16:00:00", is_active: true }]);
});

test("only schedulable roles receive the working-hours editor", () => {
  assert.equal(isSchedulableRole("ADMIN"), true);
  assert.equal(isSchedulableRole("DOCTOR"), true);
  assert.equal(isSchedulableRole("NURSE"), true);
  assert.equal(isSchedulableRole("SECRETARY"), false);
});
