import styles from "./module-summary.module.css";
export function ModuleSummary({ items }: { items: { label: string; value: string }[] }) {
  return <dl className={styles.summary}>{items.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>;
}
