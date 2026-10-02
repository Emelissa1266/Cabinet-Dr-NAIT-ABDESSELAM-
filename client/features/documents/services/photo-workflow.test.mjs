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
  buildPhotoSetPayload,
  buildPhotoUploadPayload,
  clinicalPhotoErrorMessage,
  patientPhotoSets,
  PhotoWorkflowError,
  photoSetSelectState,
  photoSetsForUploadSelector,
  photoSetOptionLabel,
  upsertPhotoSet,
} = load("features/documents/services/photo-workflow.ts");
const { ApiError } = load("lib/api-client.ts");

function photoSet(overrides = {}) {
  return {
    id: 17,
    patient: 42,
    surgery: null,
    consultation: null,
    title: "Suivi postopératoire",
    anatomical_area: "Visage",
    captured_at: null,
    created_by: 3,
    notes: "",
    created_at: "2026-10-02T10:30:00+01:00",
    updated_at: "2026-10-02T10:30:00+01:00",
    ...overrides,
  };
}

test("create-series mapper matches the clinical photo set API contract", () => {
  const payload = buildPhotoSetPayload(42, {
    title: " Suivi postopératoire ",
    anatomical_area: " Visage ",
    captured_at: "2026-10-02T10:30",
    notes: " Contrôle d'évolution ",
  });
  assert.equal(payload.patient, 42);
  assert.equal(payload.title, "Suivi postopératoire");
  assert.equal(payload.anatomical_area, "Visage");
  assert.match(payload.captured_at, /^2026-10-02T/);
  assert.equal(payload.notes, "Contrôle d'évolution");
  assert.equal("image" in payload, false);
});

test("upload mapper uses the selected real series foreign key and preserves sans série", () => {
  const image = new File(["image"], "photo.jpg", { type: "image/jpeg" });
  const withSeries = buildPhotoUploadPayload(42, {
    photo_type: "AFTER",
    anatomical_area: "Visage",
    view_angle: "FRONT",
    photo_set: "17",
    captured_at: "",
    description: "Après",
    notes: "",
  }, image);
  const withoutSeries = buildPhotoUploadPayload(42, {
    photo_type: "BEFORE",
    anatomical_area: "Visage",
    view_angle: "FRONT",
    photo_set: "",
    captured_at: "",
    description: "",
    notes: "",
  }, image);
  assert.equal(withSeries.photo_set, "17");
  assert.equal(withoutSeries.photo_set, undefined);
});

test("photothèque failures use domain-specific messages instead of document fallback", () => {
  const message = clinicalPhotoErrorMessage(
    new ApiError("La requête a échoué.", 400, { patient: ["This field is required."] }),
    "Impossible de créer la série.",
  );
  assert.equal(message, "Le patient est requis pour cette opération.");
  assert.notEqual(message, "La requête document a échoué.");
});

test("invalid local capture date becomes a safe field error", () => {
  assert.throws(
    () => buildPhotoSetPayload(42, { title: "Série", anatomical_area: "Visage", captured_at: "not-a-date", notes: "" }),
    PhotoWorkflowError,
  );
  const message = clinicalPhotoErrorMessage(
    new PhotoWorkflowError("La date de prise est invalide."),
    "Impossible de créer la série.",
  );
  assert.equal(message, "La date de prise est invalide.");
});

test("series labels remain human-readable and do not expose raw identifiers", () => {
  const label = photoSetOptionLabel(photoSet());
  assert.equal(label, "Suivi postopératoire — Visage");
  assert.doesNotMatch(label, /#17|ClinicalPhotoSet|patient|42/i);
});

test("201 created photo-set JSON can be merged into state before any refresh", () => {
  const created = photoSet({
    id: 99,
    title: "Suivi postopératoire test",
    captured_at: "2026-10-02T16:35:06+01:00",
    notes: "Contrôle",
  });
  const next = upsertPhotoSet([], created);
  assert.equal(next.length, 1);
  assert.equal(next[0].title, "Suivi postopératoire test");
  assert.equal(photoSetOptionLabel(next[0]).startsWith("Suivi postopératoire test"), true);
});

test("created-series refresh warning is distinct from create failure", () => {
  const warning = clinicalPhotoErrorMessage(
    new Error("refresh failed"),
    "La série a été créée, mais la liste n’a pas pu être actualisée.",
  );
  assert.equal(warning, "La série a été créée, mais la liste n’a pas pu être actualisée.");
  assert.notEqual(warning, "Impossible de créer la série.");
});

test("backend paginated photo-set results map into the patient selector", () => {
  const page = {
    count: 2,
    next: null,
    previous: null,
    results: [
      photoSet({ id: 31, title: "Préop visage" }),
      photoSet({ id: 32, title: "Contrôle cicatrice", anatomical_area: "Abdomen" }),
    ],
  };
  const options = patientPhotoSets(page.results, 42);
  assert.deepEqual(options.map((set) => set.title), ["Préop visage", "Contrôle cicatrice"]);
});

test("zero-photo persisted series stay visible because options come from photo-set records", () => {
  const photos = [];
  const options = patientPhotoSets([photoSet({ id: 41, title: "Série vide" })], 42);
  assert.equal(photos.length, 0);
  assert.equal(options.length, 1);
  assert.equal(options[0].title, "Série vide");
});

test("photo-set selector excludes another patient's persisted series", () => {
  const options = patientPhotoSets([
    photoSet({ id: 51, patient: 42, title: "Patient courant" }),
    photoSet({ id: 52, patient: 99, title: "Autre patient" }),
  ], "42");
  assert.deepEqual(options.map((set) => set.title), ["Patient courant"]);
});

test("created series remains preselected after a backend refresh confirms it", () => {
  const created = photoSet({ id: 61, title: "Contrôle confirmé" });
  const selectedSetId = String(created.id);
  const refreshed = patientPhotoSets([photoSet({ id: 62, title: "Ancienne série" }), created], 42);
  assert.equal(refreshed.some((set) => String(set.id) === selectedSetId), true);
});

test("hard-loaded selector state comes from backend list results, not local temporary state", () => {
  const temporary = upsertPhotoSet([], photoSet({ id: 71, title: "Série locale" }));
  const backendPage = {
    count: 1,
    next: null,
    previous: null,
    results: [photoSet({ id: 72, title: "Série persistée" })],
  };
  const hardLoaded = patientPhotoSets(backendPage.results, 42);
  assert.deepEqual(temporary.map((set) => set.title), ["Série locale"]);
  assert.deepEqual(hardLoaded.map((set) => set.title), ["Série persistée"]);
});

test("series selector state distinguishes empty data from a load failure", () => {
  assert.equal(photoSetSelectState([], false, ""), "empty");
  assert.equal(photoSetSelectState([], false, "Impossible de charger les séries."), "failed");
  assert.equal(photoSetSelectState([photoSet()], true, ""), "loading");
  assert.equal(photoSetSelectState([photoSet()], false, ""), "ready");
});

test("photo type filtering does not remove persisted series from the upload selector", () => {
  const sets = [
    photoSet({ id: 81, title: "Avant" }),
    photoSet({ id: 82, title: "Après" }),
  ];
  assert.deepEqual(photoSetsForUploadSelector(sets, "BEFORE").map((set) => set.id), [81, 82]);
  assert.deepEqual(photoSetsForUploadSelector(sets, "AFTER").map((set) => set.id), [81, 82]);
});
