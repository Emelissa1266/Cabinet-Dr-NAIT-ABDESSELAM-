"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DetailDialog } from "@/components/ui/detail-dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import ui from "@/components/ui/clinical.module.css";
import { AdminGuard } from "./admin-guard";
import { createConfig, listConfig, updateConfig } from "../services/admin-api-service";

type ConfigValue = string | number | boolean | null | undefined;
export type ConfigRecord = Record<string, ConfigValue>;

export interface FieldOption {
  value: string | number | boolean;
  label: string;
}

export interface ConfigField {
  name: string;
  label: string;
  type?: "text" | "textarea" | "number" | "select" | "checkbox" | "date" | "datetime" | "time" | "password";
  required?: boolean;
  options?: FieldOption[];
  createOnly?: boolean;
  readOnly?: boolean;
}

export interface AdminConfigPageProps<T extends { id: number | string }> {
  title: string;
  eyebrow: string;
  description: string;
  path: string;
  ordering?: string;
  fields: ConfigField[];
  columns: Array<{ key: keyof T & string; label: string; render?: (item: T) => string }>;
  activeField?: keyof T & string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  newLabel?: string;
  dependencies?: () => Promise<Partial<Record<string, FieldOption[]>>>;
  note?: string;
}

function textValue(value: ConfigValue) {
  if (value === true) return "Oui";
  if (value === false) return "Non";
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function optionLabel(fields: ConfigField[], key: string, value: ConfigValue) {
  const field = fields.find((item) => item.name === key && item.type === "select");
  if (!field?.options) return null;
  const option = field.options.find((item) => String(item.value) === String(value));
  return option?.label ?? null;
}

function inputValue(value: unknown, type?: ConfigField["type"]) {
  if (value === null || value === undefined) return "";
  if (type === "datetime" && typeof value === "string") return value.slice(0, 16);
  return String(value);
}

function payloadFromForm(form: HTMLFormElement, fields: ConfigField[]) {
  const data = new FormData(form);
  const payload: ConfigRecord = {};
  for (const field of fields) {
    if (field.readOnly) continue;
    if (field.type === "checkbox") {
      payload[field.name] = data.get(field.name) === "on";
      continue;
    }
    const raw = data.get(field.name);
    if (raw === null) continue;
    const value = String(raw).trim();
    if (value === "") {
      payload[field.name] = field.type === "number" || field.type === "select" || field.type === "date" || field.type === "datetime" || field.type === "time" ? null : "";
    } else if (field.type === "number") {
      payload[field.name] = Number(value);
    } else {
      payload[field.name] = value;
    }
  }
  return payload;
}

function ConfigForm<T extends { id: number | string }>({
  fields,
  item,
  onCancel,
  onSave,
}: {
  fields: ConfigField[];
  item: T | null;
  onCancel: () => void;
  onSave: (payload: ConfigRecord) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSave(payloadFromForm(event.currentTarget, fields.filter((field) => !field.createOnly || !item)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={ui.form} onSubmit={submit}>
      {fields.filter((field) => !field.createOnly || !item).map((field) => {
        const value = item ? item[field.name as keyof T] : undefined;
        if (field.type === "textarea") {
          return <label key={field.name}>{field.label}<textarea name={field.name} defaultValue={inputValue(value)} required={field.required} readOnly={field.readOnly} /></label>;
        }
        if (field.type === "select") {
          return (
            <label key={field.name}>{field.label}
              <select name={field.name} defaultValue={inputValue(value)} required={field.required} disabled={field.readOnly}>
                <option value="">Selectionner</option>
                {(field.options ?? []).map((option) => <option key={String(option.value)} value={String(option.value)}>{option.label}</option>)}
              </select>
            </label>
          );
        }
        if (field.type === "checkbox") {
          return <label key={field.name}><span>{field.label}</span><input name={field.name} type="checkbox" defaultChecked={Boolean(value ?? false)} disabled={field.readOnly} /></label>;
        }
        return (
          <label key={field.name}>{field.label}
            <input
              name={field.name}
              type={field.type === "datetime" ? "datetime-local" : field.type ?? "text"}
              defaultValue={inputValue(value, field.type)}
              required={field.required}
              readOnly={field.readOnly}
              autoComplete={field.type === "password" ? "new-password" : undefined}
            />
          </label>
        );
      })}
      {error && <p role="alert">{error}</p>}
      <div className={ui.actions}>
        <button className={`${ui.action} ${ui.primary}`} type="submit" disabled={busy}>{busy ? "Enregistrement..." : "Enregistrer"}</button>
        <button className={ui.action} type="button" disabled={busy} onClick={onCancel}>Annuler</button>
      </div>
    </form>
  );
}

export function AdminConfigPage<T extends { id: number | string }>({
  title,
  eyebrow,
  description,
  path,
  ordering = "name",
  fields,
  columns,
  activeField,
  searchPlaceholder = "Rechercher...",
  emptyMessage = "Aucune configuration trouvee.",
  newLabel = "Ajouter",
  dependencies,
  note,
}: AdminConfigPageProps<T>) {
  const [rows, setRows] = useState<T[]>([]);
  const [count, setCount] = useState(0);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<T | "new" | null>(null);
  const [togglingId, setTogglingId] = useState<string | number | null>(null);
  const [options, setOptions] = useState<Partial<Record<string, FieldOption[]>>>({});
  const hydratedFields = useMemo(
    () => fields.map((field) => ({ ...field, options: options[field.name] ?? field.options })),
    [fields, options],
  );

  const load = useCallback(async () => {
    const [page, dependencyOptions] = await Promise.all([
      listConfig<T>(path, { search: query, ordering }),
      dependencies ? dependencies() : Promise.resolve({}),
    ]);
    setRows(page.results);
    setCount(page.count);
    setOptions(dependencyOptions);
  }, [path, query, ordering, dependencies]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      load()
        .catch((cause) => {
          if (active) setError(cause instanceof Error ? cause.message : "Chargement impossible.");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [load]);

  async function save(payload: ConfigRecord) {
    if (editing === "new") await createConfig<T>(path, payload);
    else if (editing) await updateConfig<T>(path, editing.id as string | number, payload);
    setEditing(null);
    await load();
  }

  async function toggleActive(item: T) {
    if (!activeField) return;
    setTogglingId(item.id);
    setError("");
    try {
      await updateConfig<T>(path, item.id as string | number, { [activeField]: !item[activeField] });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Mise a jour impossible.");
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <AdminGuard>
      <main className={ui.page}>
        <header className={ui.heading}>
          <div>
            <p className={ui.eyebrow}>{eyebrow}</p>
            <h1 className={ui.title}>{title}</h1>
            <p className={ui.description}>{description}</p>
          </div>
          <div className={ui.actions}><button className={`${ui.action} ${ui.primary}`} onClick={() => setEditing("new")}>{newLabel}</button></div>
        </header>
        {note && <p className={ui.panel}>{note}</p>}
        {error && <p className={ui.panel} role="alert">{error}</p>}
        <section className={ui.toolbar}>
          <label className={ui.search}>Recherche<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={searchPlaceholder} /></label>
        </section>
        {loading ? <p className={ui.panel} role="status">Chargement...</p> : (
          <section className={ui.tableScroll}>
            <table className={ui.table}>
              <thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}<th>Statut</th><th>Actions</th></tr></thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={String(item.id)}>
                    {columns.map((column) => {
                      const value = item[column.key] as ConfigValue;
                      return <td key={column.key}>{column.render ? column.render(item) : optionLabel(hydratedFields, column.key, value) ?? textValue(value)}</td>;
                    })}
                    <td>{activeField ? <StatusBadge tone={item[activeField] ? "success" : "neutral"}>{item[activeField] ? "Actif" : "Inactif"}</StatusBadge> : "-"}</td>
                    <td>
                      <div className={ui.actions}>
                        <button className={ui.action} onClick={() => setEditing(item)}>Modifier</button>
                        {activeField && (
                          <button className={ui.action} disabled={togglingId === item.id} onClick={() => toggleActive(item)}>
                            {item[activeField] ? "Desactiver" : "Activer"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && <p className={ui.empty}>{emptyMessage}</p>}
            <footer className={ui.footer}><span>{count} elements</span></footer>
          </section>
        )}
        <DetailDialog title={editing === "new" ? newLabel : `Modifier ${title}`} open={Boolean(editing)} onClose={() => setEditing(null)}>
          {editing && <ConfigForm fields={hydratedFields} item={editing === "new" ? null : editing} onCancel={() => setEditing(null)} onSave={save} />}
        </DetailDialog>
      </main>
    </AdminGuard>
  );
}
