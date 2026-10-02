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

const { patientAppointmentHref, patientAppointmentSummary } = load("features/patients/services/patient-appointments.ts");

const appointment = {
  id: "42",
  apiId: 42,
  type: "Consultation de contrôle",
  date: "2026-10-02",
  start: "09:00",
  doctor: "Dr. Test Planning",
  statusLabel: "Confirmé",
  reason: "Contrôle postopératoire",
};

test("patient appointment summary is human-readable and hides database identifiers", () => {
  const summary = patientAppointmentSummary(appointment);
  assert.equal(summary.title, "Consultation de contrôle");
  assert.match(summary.dateTime, /2 octobre 2026 · 09:00/);
  assert.equal(summary.staff, "Dr. Test Planning");
  assert.equal(summary.status, "Confirmé");
  assert.equal(summary.reason, "Contrôle postopératoire");
  assert.equal(JSON.stringify(summary).includes("42"), false);
});

test("patient appointment navigation reuses the agenda route", () => {
  assert.equal(patientAppointmentHref("/patients", appointment), "/agenda?appointment=42");
  assert.equal(patientAppointmentHref("/secretary/patients", appointment), "/secretary/agenda?appointment=42");
});

test("patient detail no longer contains the obsolete phase placeholder", () => {
  const source = fs.readFileSync(path.resolve(root, "features/patients/components/patient-detail.tsx"), "utf8");
  assert.equal(source.includes("À raccorder en Phase 9D"), false);
  assert.equal(source.includes("Les rendez-vous ne sont pas chargés"), false);
});
