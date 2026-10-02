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
  appointmentDisplay,
  careSessionDisplay,
  dashboardFailureState,
  dashboardRoleCopy,
  surgeryDisplay,
} = load("features/dashboard/services/dashboard-view.ts");

test("dashboard role copy uses user-facing labels instead of raw role names", () => {
  assert.equal(dashboardRoleCopy.ADMIN.eyebrow, "Administration");
  assert.equal(dashboardRoleCopy.DOCTOR.eyebrow, "Activité médicale");
  assert.equal(dashboardRoleCopy.NURSE.eyebrow, "Soins infirmiers");
  assert.equal(dashboardRoleCopy.SECRETARY.eyebrow, "Accueil et administration");

  for (const copy of Object.values(dashboardRoleCopy)) {
    const visibleText = `${copy.eyebrow} ${copy.title} ${copy.description}`;
    assert.doesNotMatch(visibleText, /\bADMIN\b|\bDOCTOR\b|\bNURSE\b|\bSECRETARY\b/);
    assert.doesNotMatch(visibleText, /backend|mock|phase|réel/i);
  }
});

test("appointment and surgery display helpers expose patient names, not system references", () => {
  const appointment = appointmentDisplay({
    id: 42,
    patient_name: "Amina Rahmani",
    appointment_type_name: "Consultation",
    primary_staff_name: "Dr Nait",
    start_at: "2026-10-02T09:00:00+01:00",
    status: "SCHEDULED",
  });
  const surgery = surgeryDisplay({
    id: 7,
    patient_name: "Amina Rahmani",
    procedure_name: "Rhinoplastie",
    planned_date: "2026-10-03T09:00:00+01:00",
    status: "SCHEDULED",
  });

  assert.deepEqual(appointment, { title: "Amina Rahmani", subtitle: "Consultation", meta: "Dr Nait" });
  assert.deepEqual(surgery, { title: "Amina Rahmani", subtitle: "Rhinoplastie" });
  assert.doesNotMatch(JSON.stringify({ appointment, surgery }), /P-\d{5}|patient_reference|reference/i);
});

test("care session display keeps care-session wording separate from appointment wording", () => {
  const session = careSessionDisplay({
    id: 19,
    patient_name: "Lina Haddad",
    care_type_name: "Pansement",
    scheduled_at: "2026-10-02T13:00:00+01:00",
    status: "PLANNED",
    planned_sessions: 4,
  });

  assert.deepEqual(session, {
    title: "Lina Haddad",
    subtitle: "Pansement",
    meta: "4 séance(s) prévues",
  });
});

test("dashboard failure state clears data instead of rendering legitimate-looking zero metrics", () => {
  const state = dashboardFailureState("Impossible de charger le tableau de bord.");
  assert.equal(state.data, null);
  assert.equal(state.error, "Impossible de charger le tableau de bord.");
});

test("dashboard error formatter avoids technical HTTP details", () => {
  const { dashboardErrorMessage } = load("features/dashboard/services/dashboard-display.ts");
  assert.equal(dashboardErrorMessage(new Error("500")), "Impossible de charger le tableau de bord.");
});

test("dashboard source does not contain internal implementation language in visible copy", () => {
  const source = fs.readFileSync(path.resolve(root, "features/dashboard/components/real-dashboard.tsx"), "utf8");
  assert.doesNotMatch(source, /Tableau de bord réel|Vue opérationnelle|backend|mock|Phase/);
});
