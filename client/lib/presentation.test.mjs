import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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
  auditActionLabel,
  dateTime,
  entityLabel,
  personName,
  roleLabel,
  statusLabel,
} = load("lib/presentation.ts");
const {
  anesthesiaEvaluationStatusLabels,
  anesthesiaLabels,
  fastingStatusLabels,
  intraoperativeEventTypeLabels,
  intraoperativeSeverityLabels,
  preopChecklistStatusLabels,
  preopReadinessLabels,
  preopRequirementStatusLabels,
  preopRequirementTypeLabels,
  pregnancyStatusLabels,
  surgeryComplicationSeverityLabels,
  surgeryConsentStatusLabels,
  surgeryStatusLabels,
  surgeryTeamRoleLabels,
} = load("features/interventions/services/surgery-display.ts");
const { invoiceStatusLabels, paymentStatusLabels } = load("features/billing/services/billing-display.ts");
const { careStatusLabels, sessionStatusLabels } = load("features/care/services/care-display.ts");
const { photoTypeLabels } = load("features/documents/services/document-display.ts");

test("roles render as product labels instead of backend enum values", () => {
  assert.equal(roleLabel("ADMIN"), "Administrateur");
  assert.equal(roleLabel("DOCTOR"), "Chirurgien plasticien");
  assert.equal(roleLabel("NURSE"), "Personnel soignant");
  assert.equal(roleLabel("SECRETARY"), "Secrétariat");
});

test("common statuses render as human labels", () => {
  assert.equal(statusLabel("IN_PROGRESS"), "En cours");
  assert.equal(statusLabel("NO_SHOW"), "Absent");
  assert.equal(statusLabel("PARTIALLY_PAID"), "Partiellement payée");
  assert.equal(statusLabel("UNKNOWN_NEW_STATUS"), "Statut non renseigné");
});

test("domain status mappings avoid raw backend values", () => {
  const labels = [
    surgeryStatusLabels.IN_PROGRESS,
    careStatusLabels.IN_PROGRESS,
    sessionStatusLabels.COMPLETED,
    invoiceStatusLabels.PARTIALLY_PAID,
    paymentStatusLabels.COMPLETED,
    photoTypeLabels.PROGRESS,
    anesthesiaLabels.GENERAL,
    preopReadinessLabels.NEEDS_REVIEW,
    preopChecklistStatusLabels.NOT_APPLICABLE,
    preopRequirementTypeLabels.MEDICAL_CLEARANCE,
    preopRequirementStatusLabels.SATISFIED,
    surgeryConsentStatusLabels.DECLINED,
    surgeryTeamRoleLabels.ANESTHESIA,
    intraoperativeEventTypeLabels.MEDICATION,
    intraoperativeSeverityLabels.CRITICAL,
    surgeryComplicationSeverityLabels.SEVERE,
    fastingStatusLabels.NOT_FASTED,
    anesthesiaEvaluationStatusLabels.CLEARED,
    pregnancyStatusLabels.NOT_APPLICABLE,
  ];
  const visible = labels.join(" ");
  assert.doesNotMatch(visible, /IN_PROGRESS|PARTIALLY_PAID|NOT_APPLICABLE|MEDICAL_CLEARANCE|ANESTHESIA|CRITICAL|SEVERE|NOT_FASTED|CLEARED/);
});

test("audit feed screenshot values map to French presentation labels", () => {
  assert.equal(auditActionLabel("ADMIN_USER_UPDATED"), "Utilisateur modifié");
  assert.equal(auditActionLabel("CLINICAL_PHOTO_VIEWED"), "Photo clinique consultée");
  assert.equal(entityLabel("ClinicalPhoto"), "Photo clinique");
  assert.equal(entityLabel("ClinicalPhotoSet"), "Série de photos");
  const rendered = `${auditActionLabel("CLINICAL_PHOTO_VIEWED")} ${entityLabel("ClinicalPhoto")}`;
  assert.doesNotMatch(rendered, /CLINICAL_PHOTO_VIEWED|ClinicalPhoto/);
});

test("unknown audit and entity values use safe fallbacks instead of leaking raw codes", () => {
  assert.equal(auditActionLabel("NEW_BACKEND_CODE"), "Activité système");
  assert.equal(entityLabel("NewDjangoModel"), "Élément");
});

test("placeholder, null and date values render safely", () => {
  assert.equal(personName("string string"), "Utilisateur");
  assert.equal(personName("undefined undefined"), "Système");
  assert.equal(personName(null), "Système");
  assert.match(dateTime("2026-10-02T16:50:24.152703+01:00"), /2026|oct/i);
});
