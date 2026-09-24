import ui from "./clinical.module.css";
export function ModuleLoading({ label }: { label: string }) { return <section className={ui.panel} aria-busy="true"><p role="status">Chargement : {label}…</p></section>; }
