import type { Patient } from "@/features/patients/types";
import type { CareCategory, CareNurse, CareTreatment } from "../types";
import { Icon } from "@/components/shared/icon";
import styles from "./care-workspace.module.css";

export function CarePlanningTable({ treatments, patients, categories, nurses, selectedId, onSelect }: {
 treatments: CareTreatment[]; patients: Patient[]; categories: CareCategory[]; nurses: CareNurse[];
 selectedId?: string; onSelect: (treatment: CareTreatment) => void;
}) {
 return <div className={styles.tableScroll}><table className={styles.table}>
 <thead><tr><th>Heure & salle</th><th>Patient & réf.</th><th>Catégorie & type de soin</th><th>Infirmier(ère)</th><th>Statut</th><th><span className="sr-only">Actions</span></th></tr></thead>
 <tbody>{treatments.map(treatment => {
 const patient = patients.find(p => p.id === treatment.patientId);
 const nurse = nurses.find(n => n.id === treatment.planning?.nurseId);
 return <tr key={treatment.id} data-selected={selectedId === treatment.id} onClick={() => onSelect(treatment)}>
 <td><strong>{treatment.planning?.time ?? "—"}</strong><small>{treatment.planning?.room ?? "À affecter"}</small></td>
 <td><button className={styles.patientButton} aria-pressed={selectedId === treatment.id} onClick={event => { event.stopPropagation(); onSelect(treatment); }} aria-label={`Voir le soin ${treatment.id} de ${patient?.name}`}>{patient?.name ?? "Patient"}</button><small><span className={styles.teal}>#{treatment.patientId}</span> · {patient?.age ?? "—"} ans</small></td>
 <td>{treatment.type}<small>Catégorie : {categories.find(c => c.id === treatment.categoryId)?.name ?? "—"}</small></td>
 <td><span className={styles.nurse}><i>{nurse?.initials ?? "—"}</i>{nurse?.name ?? "Non assigné"}</span></td>
 <td><span className={styles.status} data-status={treatment.status}>{treatment.status}</span>{treatment.planning?.alert && <small className={styles.alertLabel}>{treatment.planning.alert}</small>}</td>
 <td><button className={styles.iconButton} aria-label={`Ouvrir la fiche ${treatment.id}`} onClick={event => { event.stopPropagation(); onSelect(treatment); }}><Icon name="chevron-right" size={13}/></button></td>
 </tr>;
 })}</tbody></table>
 {!treatments.length && <p className={styles.empty}>Aucun soin ne correspond à cette date et à ces filtres.</p>}
 </div>;
}
