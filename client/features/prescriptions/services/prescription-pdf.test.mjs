import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function setup({ blocked = false, failure = false } = {}) {
  const calls = [];
  const cache = new Map();
  const api = {
    apiBlobRequest: async (endpoint, options) => {
      calls.push({ endpoint, options });
      if (failure) throw new Error("Accès refusé");
      return { blob: new Blob(["%PDF-test"], { type: "application/pdf" }), headers: new Headers({ "content-disposition": 'attachment; filename="Ordonnance_TEST_2026-10-13.pdf"' }) };
    },
    apiRequest: async (endpoint) => {
      calls.push({ endpoint });
      return endpoint.includes("page=2")
        ? { count: 2, next: null, previous: "?page=1", results: [{ id: 2 }] }
        : { count: 2, next: "?page=2", previous: null, results: [{ id: 1 }] };
    },
  };
  function load(file) {
    let filename = path.resolve(root, file);
    if (!path.extname(filename)) filename += ".ts";
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = { exports: {} };
    cache.set(filename, mod);
    const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
    new Function("require", "module", "exports", source)((id) => id === "@/lib/api-client" ? api : load(id.startsWith("@/") ? id.slice(2) : path.resolve(path.dirname(filename), id)), mod, mod.exports);
    return mod.exports;
  }
  const nodes = [];
  const makeNode = (tag) => {
    const node = { tag, style: {}, contentWindow: { focus() {}, print() { calls.push("print-pdf"); } }, click() { calls.push("download-click"); }, remove() {} };
    nodes.push(node);
    return node;
  };
  const preview = { closed: false, opener: {}, document: { title: "", createElement: makeNode, body: { style: {}, replaceChildren(...children) { calls.push(children); } } }, close() { this.closed = true; } };
  let interval;
  globalThis.document = { createElement: makeNode, body: { appendChild() {} } };
  globalThis.window = {
    open() { calls.push("open-preview"); return blocked ? null : preview; },
    setTimeout(callback) { callback(); },
    setInterval(callback) { interval = callback; return 1; }, clearInterval() {},
  };
  const create = URL.createObjectURL;
  const revoke = URL.revokeObjectURL;
  URL.createObjectURL = () => "blob:private-test";
  URL.revokeObjectURL = (url) => calls.push({ revoked: url });
  return {
    pdf: load("features/prescriptions/services/prescription-pdf.ts"),
    service: load("features/prescriptions/services/prescription-service.ts"),
    invoice: load("features/billing/services/billing-api-service.ts"),
    shared: load("lib/private-pdf.ts"),
    calls, nodes, preview, closePreview() { preview.closed = true; interval(); },
    restore() { URL.createObjectURL = create; URL.revokeObjectURL = revoke; delete globalThis.window; delete globalThis.document; },
  };
}

test("download uses the authenticated blob API and backend filename", async () => {
  const context = setup();
  try {
    await context.pdf.downloadPrescriptionPdf(42);
    assert.equal(context.calls[0].endpoint, "prescriptions/42/pdf/");
    assert.equal(context.calls[0].options.cache, "no-store");
    assert.equal(context.nodes[0].download, "Ordonnance_TEST_2026-10-13.pdf");
    assert.ok(context.calls.includes("download-click"));
    assert.ok(context.calls.some((call) => call.revoked === "blob:private-test"));
  } finally { context.restore(); }
});

test("print opens before fetch, displays only the PDF, and prints its frame", async () => {
  const context = setup();
  try {
    await context.pdf.previewPrescriptionPdf(42, true);
    assert.equal(context.calls[0], "open-preview");
    assert.equal(context.calls[1].endpoint, "prescriptions/42/print/");
    assert.equal(context.preview.opener, null);
    const frame = context.nodes.find((node) => node.tag === "iframe");
    assert.equal(frame.src, "blob:private-test");
    frame.onload();
    assert.ok(context.calls.includes("print-pdf"));
    context.closePreview();
    assert.ok(context.calls.some((call) => call.revoked === "blob:private-test"));
  } finally { context.restore(); }
});

test("view opens PDF without automatically invoking print", async () => {
  const context = setup();
  try {
    await context.pdf.previewPrescriptionPdf(42);
    context.nodes.find((node) => node.tag === "iframe").onload();
    assert.ok(!context.calls.includes("print-pdf"));
  } finally { context.restore(); }
});

test("blocked popup reports an actionable error without making a medical request", async () => {
  const context = setup({ blocked: true });
  try {
    await assert.rejects(context.pdf.previewPrescriptionPdf(42, true), /fenêtres contextuelles/);
    assert.deepEqual(context.calls, ["open-preview"]);
  } finally { context.restore(); }
});

test("denied PDF closes the loading preview and propagates the error", async () => {
  const context = setup({ failure: true });
  try {
    await assert.rejects(context.pdf.previewPrescriptionPdf(42), /Accès refusé/);
    assert.equal(context.preview.closed, true);
  } finally { context.restore(); }
});

test("all saved prescriptions are loaded beyond the first page", async () => {
  const context = setup();
  try {
    const response = await context.service.prescriptionService.list({ patient: 7 });
    assert.deepEqual(response.results.map((item) => item.id), [1, 2]);
    assert.ok(context.calls.every((call) => call.endpoint.includes("patient=7")));
  } finally { context.restore(); }
});


test("invoice view and print reuse the authenticated PDF preview", async () => {
  const context = setup();
  try {
    await context.shared.openPrivatePdf(() => context.invoice.getInvoicePrintPdf(9), true);
    assert.equal(context.calls[1].endpoint, "invoices/9/print/");
    const frame = context.nodes.find((node) => node.tag === "iframe");
    frame.onload();
    assert.ok(context.calls.includes("print-pdf"));
    assert.equal(frame.src, "blob:private-test");
  } finally { context.restore(); }
});
