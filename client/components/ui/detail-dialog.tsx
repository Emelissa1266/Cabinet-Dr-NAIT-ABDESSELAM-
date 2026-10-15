"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import styles from "./detail-dialog.module.css";

interface DetailDialogProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}
export function DetailDialog({ title, open, onClose, children, wide = false }: DetailDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog ref={ref} className={`${styles.dialog} ${wide ? styles.wide : ""}`} aria-labelledby={titleId}
      onClose={onClose} onClick={(event) => { if (event.target === event.currentTarget) ref.current?.close(); }}>
      <header className={styles.header}>
        <h2 id={titleId}>{title}</h2>
        <button type="button" onClick={() => ref.current?.close()} aria-label="Fermer les détails">Fermer</button>
      </header>
      <div className={styles.body}>{children}</div>
    </dialog>
  );
}
