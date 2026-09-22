import Link from "next/link";
export function Breadcrumb({ items }: { items: readonly { label: string; href?: string }[] }) {
  return <nav aria-label="Fil d’Ariane"><ol className="breadcrumb">{items.map((item, index) => <li key={`${item.label}-${index}`}>{index > 0 && <span aria-hidden="true">/</span>}{item.href ? <Link href={item.href}>{item.label}</Link> : <span aria-current={index === items.length - 1 ? "page" : undefined}>{item.label}</span>}</li>)}</ol></nav>;
}
