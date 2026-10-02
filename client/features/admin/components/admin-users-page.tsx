"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { DetailDialog } from "@/components/ui/detail-dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import type { Role } from "@/features/auth/types";
import type { AdminUserApi, AdminUserPayload, StaffWorkingHoursApi } from "@/features/admin/api-types";
import {
  createAdminUser,
  createConfig,
  deleteConfig,
  listAdminUsers,
  listConfig,
  updateAdminUser,
  updateConfig,
} from "@/features/admin/services/admin-api-service";
import {
  buildWorkingHourMutations,
  emptyWeek,
  groupWorkingHours,
  isSchedulableRole,
  type WorkingHourDraft,
} from "@/features/admin/services/admin-working-hours";
import ui from "@/components/ui/clinical.module.css";
import styles from "./admin-users-page.module.css";
import { AdminGuard } from "./admin-guard";

const roleOptions: Array<{ value: Role; label: string }> = [
  { value: "ADMIN", label: "Administrateur" },
  { value: "DOCTOR", label: "Chirurgien" },
  { value: "NURSE", label: "Soins infirmiers" },
  { value: "SECRETARY", label: "Secrétariat" },
];

const weekdays = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
type WeeklySchedule = Record<number, WorkingHourDraft[]>;
type Editing = AdminUserApi | "new" | null;

function fullName(user: AdminUserApi) {
  return `${user.first_name} ${user.last_name}`.trim() || user.username;
}

function initials(user: AdminUserApi) {
  return fullName(user).split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "U";
}

function roleLabel(role: Role) {
  return roleOptions.find((option) => option.value === role)?.label ?? role;
}

function countIntervals(schedule: WeeklySchedule) {
  return Object.values(schedule).reduce((total, intervals) => total + intervals.length, 0);
}

function userPayload(form: HTMLFormElement, item: AdminUserApi | null): AdminUserPayload {
  const data = new FormData(form);
  const password = String(data.get("password") ?? "");
  const payload: AdminUserPayload = {
    username: String(data.get("username") ?? "").trim(),
    first_name: String(data.get("first_name") ?? "").trim(),
    last_name: String(data.get("last_name") ?? "").trim(),
    email: String(data.get("email") ?? "").trim(),
    phone: String(data.get("phone") ?? "").trim(),
    role: String(data.get("role") ?? "DOCTOR") as Role,
    professional_title: String(data.get("professional_title") ?? "").trim(),
    profile_notes: String(data.get("profile_notes") ?? "").trim(),
    is_active: data.get("is_active") === "on",
  };
  if (!item || password.trim()) payload.password = password;
  return payload;
}

async function persistWorkingHours(staffId: number, existing: StaffWorkingHoursApi[], schedule: WeeklySchedule) {
  const mutations = buildWorkingHourMutations(staffId, existing, schedule);
  await Promise.all(mutations.deleteIds.map((id) => deleteConfig("staff-working-hours", id)));
  await Promise.all(mutations.update.map((item) => updateConfig<StaffWorkingHoursApi>("staff-working-hours", item.id, item.payload)));
  await Promise.all(mutations.create.map((payload) => createConfig<StaffWorkingHoursApi>("staff-working-hours", payload)));
}

function ScheduleEditor({ schedule, onChange }: { schedule: WeeklySchedule; onChange: (schedule: WeeklySchedule) => void }) {
  function addInterval(weekday: number) {
    onChange({ ...schedule, [weekday]: [...(schedule[weekday] ?? []), { weekday, start_time: "09:00", end_time: "17:00", is_active: true }] });
  }
  function updateInterval(weekday: number, index: number, patch: Partial<WorkingHourDraft>) {
    onChange({ ...schedule, [weekday]: schedule[weekday].map((item, current) => current === index ? { ...item, ...patch } : item) });
  }
  function removeInterval(weekday: number, index: number) {
    onChange({ ...schedule, [weekday]: schedule[weekday].filter((_, current) => current !== index) });
  }

  return (
    <section className={styles.schedule}>
      <div>
        <h3>Horaires de travail</h3>
        <p>Les plages enregistrées ici sont utilisées par les disponibilités de l’agenda.</p>
      </div>
      {weekdays.map((label, weekday) => (
        <div className={styles.day} key={label}>
          <div className={styles.dayHeader}>
            <strong>{label}</strong>
            <button className={ui.action} type="button" onClick={() => addInterval(weekday)}>Ajouter une plage</button>
          </div>
          {schedule[weekday]?.length ? schedule[weekday].map((interval, index) => (
            <div className={styles.interval} key={`${weekday}-${index}-${interval.id ?? "new"}`}>
              <label><span>Travaille</span><input type="checkbox" checked={interval.is_active} onChange={(event) => updateInterval(weekday, index, { is_active: event.target.checked })} /></label>
              <label>Début<input type="time" value={interval.start_time} onChange={(event) => updateInterval(weekday, index, { start_time: event.target.value })} required /></label>
              <label>Fin<input type="time" value={interval.end_time} onChange={(event) => updateInterval(weekday, index, { end_time: event.target.value })} required /></label>
              <button className={ui.action} type="button" onClick={() => removeInterval(weekday, index)}>Retirer</button>
            </div>
          )) : <p className={ui.muted}>Non travaillé.</p>}
        </div>
      ))}
    </section>
  );
}

function UserForm({ item, onCancel, onSave }: { item: AdminUserApi | null; onCancel: () => void; onSave: (payload: AdminUserPayload, schedule: WeeklySchedule, existingHours: StaffWorkingHoursApi[]) => Promise<void> }) {
  const [role, setRole] = useState<Role>(item?.role ?? "DOCTOR");
  const [schedule, setSchedule] = useState<WeeklySchedule>(() => emptyWeek());
  const [existingHours, setExistingHours] = useState<StaffWorkingHoursApi[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadingHours, setLoadingHours] = useState(Boolean(item));
  const [error, setError] = useState("");
  const showSchedule = isSchedulableRole(role);

  useEffect(() => {
    let active = true;
    if (!item) {
      return () => { active = false; };
    }
    listConfig<StaffWorkingHoursApi>("staff-working-hours", { staff: item.id, ordering: "weekday,start_time" })
      .then((page) => {
        if (!active) return;
        setExistingHours(page.results);
        setSchedule(groupWorkingHours(page.results));
      })
      .catch(() => {
        if (active) setError("Impossible de charger les horaires de travail.");
      })
      .finally(() => {
        if (active) setLoadingHours(false);
      });
    return () => { active = false; };
  }, [item]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSave(userPayload(event.currentTarget, item), showSchedule ? schedule : emptyWeek(), existingHours);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={ui.form} onSubmit={submit}>
      <section className={styles.formSection}>
        <h3>Informations du compte</h3>
        <label>Nom d’utilisateur *<input name="username" defaultValue={item?.username ?? ""} required /></label>
        <label>Prénom<input name="first_name" defaultValue={item?.first_name ?? ""} /></label>
        <label>Nom<input name="last_name" defaultValue={item?.last_name ?? ""} /></label>
        <label>Email *<input name="email" type="email" defaultValue={item?.email ?? ""} required /></label>
        <label>Téléphone<input name="phone" defaultValue={item?.phone ?? ""} /></label>
        <label>Rôle applicatif *<select name="role" value={role} onChange={(event) => setRole(event.target.value as Role)} required>{roleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label><span>Compte actif</span><input name="is_active" type="checkbox" defaultChecked={item?.is_active ?? true} /></label>
        <label>{item ? "Nouveau mot de passe" : "Mot de passe initial *"}<input name="password" type="password" required={!item} autoComplete="new-password" /></label>
      </section>
      <section className={styles.formSection}>
        <h3>Informations professionnelles</h3>
        <label>Titre professionnel<input name="professional_title" defaultValue={item?.professional_title ?? ""} /></label>
        <label>Notes de profil<textarea name="profile_notes" defaultValue={item?.profile_notes ?? ""} /></label>
      </section>
      {loadingHours ? <p className={ui.panel} role="status">Chargement des horaires…</p> : showSchedule && <ScheduleEditor schedule={schedule} onChange={setSchedule} />}
      {!showSchedule && <p className={ui.panel}>Ce rôle ne participe pas aux disponibilités de l’agenda.</p>}
      {error && <p role="alert">{error}</p>}
      <div className={ui.actions}>
        <button className={`${ui.action} ${ui.primary}`} type="submit" disabled={busy || loadingHours}>{busy ? "Enregistrement…" : "Enregistrer"}</button>
        <button className={ui.action} type="button" disabled={busy} onClick={onCancel}>Annuler</button>
      </div>
    </form>
  );
}

export function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserApi[]>([]);
  const [count, setCount] = useState(0);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [editing, setEditing] = useState<Editing>(null);
  const filteredQuery = query.trim();

  const load = useCallback(async () => {
    const page = await listAdminUsers({ search: filteredQuery, ordering: "last_name" });
    setUsers(page.results);
    setCount(page.count);
  }, [filteredQuery]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
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

  async function save(payload: AdminUserPayload, schedule: WeeklySchedule, existingHours: StaffWorkingHoursApi[]) {
    setFeedback("");
    if (editing === "new") {
      const created = await createAdminUser(payload);
      if (isSchedulableRole(created.role) && countIntervals(schedule)) {
        try {
          await persistWorkingHours(created.id, [], schedule);
          setFeedback("Compte créé avec ses horaires de travail.");
        } catch {
          setFeedback("Le compte a été créé, mais les horaires n’ont pas pu être enregistrés. Vous pouvez les compléter depuis la fiche utilisateur.");
        }
      } else {
        setFeedback("Compte créé.");
      }
    } else if (editing) {
      const updated = await updateAdminUser(editing.id, payload);
      await persistWorkingHours(updated.id, existingHours, isSchedulableRole(updated.role) ? schedule : emptyWeek());
      setFeedback("Compte et horaires mis à jour.");
    }
    setEditing(null);
    await load();
  }

  const title = useMemo(() => editing === "new" ? "Ajouter un utilisateur" : "Modifier l’utilisateur", [editing]);

  return (
    <AdminGuard>
      <main className={ui.page}>
        <header className={ui.heading}>
          <div>
            <p className={ui.eyebrow}>Administration</p>
            <h1 className={ui.title}>Utilisateurs</h1>
            <p className={ui.description}>Comptes, rôles applicatifs, activation et horaires du personnel.</p>
          </div>
          <div className={ui.actions}><button className={`${ui.action} ${ui.primary}`} onClick={() => { setFeedback(""); setEditing("new"); }}>Ajouter un utilisateur</button></div>
        </header>
        {feedback && <p className={ui.panel} role="status">{feedback}</p>}
        {error && <p className={ui.panel} role="alert">{error}</p>}
        <section className={ui.toolbar}>
          <label className={ui.search}>Recherche<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nom, identifiant, email..." /></label>
        </section>
        {loading ? <p className={ui.panel} role="status">Chargement...</p> : (
          <section className={ui.tableScroll}>
            <table className={ui.table}>
              <thead><tr><th>Identifiant</th><th>Nom</th><th>Email</th><th>Rôle</th><th>Statut</th><th>Actions</th></tr></thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td><span className={ui.identity}><span className={ui.avatar}>{initials(user)}</span><span><strong>{user.username}</strong><small>{user.professional_title || "Titre non renseigné"}</small></span></span></td>
                    <td>{fullName(user)}</td>
                    <td>{user.email}</td>
                    <td>{roleLabel(user.role)}</td>
                    <td><StatusBadge tone={user.is_active ? "success" : "neutral"}>{user.is_active ? "Actif" : "Inactif"}</StatusBadge></td>
                    <td><button className={ui.action} onClick={() => { setFeedback(""); setEditing(user); }}>Modifier</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!users.length && <p className={ui.empty}>Aucun utilisateur configuré.</p>}
            <footer className={ui.footer}><span>{count} utilisateurs</span></footer>
          </section>
        )}
        <DetailDialog title={title} open={Boolean(editing)} onClose={() => setEditing(null)}>
          {editing && <UserForm key={editing === "new" ? "new" : editing.id} item={editing === "new" ? null : editing} onCancel={() => setEditing(null)} onSave={save} />}
        </DetailDialog>
      </main>
    </AdminGuard>
  );
}
