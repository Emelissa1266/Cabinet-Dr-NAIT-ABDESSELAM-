import type { ReactNode } from "react";
import styles from "./status-badge.module.css";

export type StatusTone = "neutral" | "success" | "warning" | "teal" | "error";
export function StatusBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: StatusTone }) {
  return <span className={`${styles.badge} ${styles[tone]}`}><span aria-hidden="true" />{children}</span>;
}
