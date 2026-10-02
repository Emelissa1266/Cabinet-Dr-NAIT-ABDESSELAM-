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
  buildCreateAppointmentPayload,
  compatibleAgendaStaff,
  defaultAgendaStaff,
} = load("features/agenda/services/agenda-form.ts");
const { agendaErrorMessage } = load("features/agenda/services/agenda-errors.ts");
const { ApiError } = load("lib/api-client.ts");

const doctor = { id: 1, role: "DOCTOR" };
const nurse = { id: 2, role: "NURSE" };
const admin = { id: 3, role: "ADMIN" };
const nurseType = { id: 10, requires_doctor: false, requires_nurse: true, default_duration_minutes: 3 };
const doctorType = { id: 11, requires_doctor: true, requires_nurse: false, default_duration_minutes: 30 };

test("appointment type role requirements filter incompatible primary staff", () => {
  assert.deepEqual(compatibleAgendaStaff([doctor, nurse, admin], nurseType).map((item) => item.id), [2]);
  assert.deepEqual(compatibleAgendaStaff([doctor, nurse, admin], doctorType).map((item) => item.id), [1]);
  assert.equal(defaultAgendaStaff([doctor, nurse], nurseType, doctor.id).id, nurse.id);
});

test("create appointment payload uses unambiguous clinic datetime and backend-derived duration", () => {
  const payload = buildCreateAppointmentPayload({
    patient: 13,
    appointmentType: 10,
    primaryStaff: 2,
    date: "2026-10-01",
    time: "09:00",
    reason: " sdddd ",
    notes: " sssssss ",
    internalNotes: " sssssssss ",
  });
  assert.equal(payload.start_at, "2026-10-01T09:00:00+01:00");
  assert.equal("end_at" in payload, false);
  assert.equal(payload.reason, "sdddd");
});

test("agenda validation errors expose the backend rejection reason", () => {
  const message = agendaErrorMessage(new ApiError(
    "La requête a échoué.",
    400,
    ["Appointment type requires nurse primary staff."],
  ));
  assert.equal(message, "Ce type de rendez-vous doit être affecté à un personnel infirmier.");
});
