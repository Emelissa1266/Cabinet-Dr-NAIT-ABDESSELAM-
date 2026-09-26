import { StatusBadge } from "@/components/ui/status-badge";
import { useNurse } from "./nurse-provider";
import type { NursingSession } from "../types";
import styles from "./nurse.module.css";
export function SessionList({ sessions, selectedId, onSelect, showDate = false }: {
    sessions: NursingSession[];
    selectedId?: string;
    onSelect: (session: NursingSession) => void;
    showDate?: boolean;
}) {
    const { data } = useNurse();
    return <div className={styles.sessionList}>{sessions.map(session => { const program = data.programs.find(p => p.id === session.programId)!; const patient = data.patients.find(p => p.id === program.patientId)!; return <button key={session.id} className={styles.sessionRow} aria-pressed={session.id === selectedId} onClick={() => onSelect(session)} aria-label={`Ouvrir ${patient.name}, ${session.start}, ${program.name}`}><span className={styles.time}><strong>{session.start||"À définir"}</strong><small>{showDate ? session.date : session.room}</small></span><span className={styles.sessionText}><strong>{patient.name}<small>#{patient.id}</small></strong><span>{program.name}</span><small>Séance {session.sessionNumber??1} · {session.start} {session.end&&"– "+session.end} · {program.category}</small></span><StatusBadge tone={session.status === "Terminé" ? "success" : session.status === "En cours" ? "teal" : session.status === "À revoir" ? "warning" : "neutral"}>{session.status}</StatusBadge></button>; })}{!sessions.length && <p className={styles.empty}>Aucun soin pour ces critères.</p>}</div>;
}
