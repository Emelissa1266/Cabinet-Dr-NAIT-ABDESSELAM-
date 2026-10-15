import type { ApiBlobResponse } from "./api-client";

export async function openPrivatePdf(load: () => Promise<ApiBlobResponse>, print = false) {
  // Open during the click gesture, before awaiting the authenticated request.
  const preview = window.open("about:blank", "_blank");
  if (!preview) throw new Error("Autorisez les fenêtres contextuelles pour ouvrir le document.");
  preview.opener = null;
  preview.document.title = "Document PDF";
  preview.document.body.textContent = "Chargement du document…";
  try {
    const response = await load();
    if (preview.closed) return;
    const url = URL.createObjectURL(response.blob);
    const frame = preview.document.createElement("iframe");
    frame.title = "Aperçu A4 du document";
    frame.style.cssText = "border:0;width:100%;height:calc(100vh - 64px)";
    const button = preview.document.createElement("button");
    button.textContent = "Imprimer";
    const printDocument = () => {
      // The browser's PDF viewer also provides its own print controls.
      try { frame.contentWindow?.focus(); frame.contentWindow?.print(); } catch { /* Native PDF toolbar remains available. */ }
    };
    button.onclick = printDocument;
    frame.onload = () => { if (print) printDocument(); };
    frame.src = url;
    preview.document.body.style.margin = "8px";
    preview.document.body.replaceChildren(button, frame);
    const cleanup = window.setInterval(() => {
      if (preview.closed) {
        URL.revokeObjectURL(url);
        window.clearInterval(cleanup);
      }
    }, 1000);
  } catch (cause) {
    preview.close();
    throw cause;
  }
}
