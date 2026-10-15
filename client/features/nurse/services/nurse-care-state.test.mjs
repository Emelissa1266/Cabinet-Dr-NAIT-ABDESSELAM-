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

const { eligibleSessionCares, mergeById, mergeCreatedSession, replaceById } = loadTs("./nurse-care-state.ts");

const care = (overrides = {}) => ({
  id: 10,
  status: "PLANNED",
  remaining_sessions: 2,
  patient_name: "Sarah X",
  care_type_name: "Pansement",
  ...overrides,
});

test("successful create result is preserved locally without duplicating care", () => {
  const created = care({ id: 12 });
  const state = mergeById([care({ id: 11 }), care({ id: 12, notes: "stale" })], created);
  assert.equal(state[0], created);
  assert.deepEqual(state.map((item) => item.id), [12, 11]);
});

test("care updates replace the matching local record", () => {
  const updated = care({ id: 11, planned_sessions: 5 });
  const state = replaceById([care({ id: 10 }), care({ id: 11, planned_sessions: 2 })], updated);
  assert.equal(state[1], updated);
  assert.equal(state[0].id, 10);
});

test("planned nurse-created care remains eligible for session creation", () => {
  const active = eligibleSessionCares([
    care({ id: 1, status: "PLANNED", remaining_sessions: 1 }),
    care({ id: 2, status: "IN_PROGRESS", remaining_sessions: 2 }),
    care({ id: 3, status: "COMPLETED", remaining_sessions: 0 }),
    care({ id: 4, status: "CANCELLED", remaining_sessions: 3 }),
    care({ id: 5, status: "PLANNED", remaining_sessions: 0 }),
  ]);
  assert.deepEqual(active.map((item) => item.id), [1, 2]);
});

test("created session is merged by backend id", () => {
  const session = { id: 40, care: 1 };
  const state = mergeCreatedSession([{ id: 39, care: 1 }, { id: 40, care: 2 }], session);
  assert.equal(state[0], session);
  assert.deepEqual(state.map((item) => item.id), [40, 39]);
});

const { collectCarePages } = loadTs("../../care/services/care-pagination.ts");

test("assigned planned care without sessions beyond page one is loaded", async () => {
  const calls = [];
  const result = await collectCarePages(async (page) => {
    calls.push(page);
    return page === 1
      ? { count: 21, next: "http://localhost:8000/api/v1/cares/?page=2", previous: null, results: Array.from({ length: 20 }, (_, id) => care({ id })) }
      : { count: 21, next: null, previous: "?page=1", results: [care({ id: 99, assigned_nurse: 7, prescribed_by: 3, completed_sessions: 0 })] };
  });
  assert.deepEqual(calls, [1, 2]);
  assert.equal(result.results.length, 21);
  assert.ok(eligibleSessionCares(result.results).some((item) => item.id === 99));
});

test("fresh assignment snapshot replaces former nurse records without retaining stale care", async () => {
  const result = await collectCarePages(async () => ({ count: 1, next: null, previous: null, results: [care({ id: 12 })] }));
  assert.deepEqual(result.results.map((item) => item.id), [12]);
});

test("pagination errors reject the snapshot instead of presenting a partial assignment list", async () => {
  await assert.rejects(collectCarePages(async (page) => {
    if (page === 2) throw new Error("Network unavailable");
    return { count: 2, next: "?page=2", previous: null, results: [care()] };
  }), /Network unavailable/);
});
