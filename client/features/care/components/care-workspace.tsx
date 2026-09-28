"use client";
import {useClinic} from "@/features/clinic/components/clinic-provider";
import { useState } from "react";
import { Icon } from "@/components/shared/icon";
import { DetailDialog } from "@/components/ui/detail-dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import type { Patient } from "@/features/patients/types";
import { formatDate } from "@/lib/clinical-format";
import type { CareData, CareTreatment, TreatmentDraft, CareProtocol } from "../types";
import { careService } from "../services/care-service";
import { TreatmentForm } from "./treatment-form";
import { CategoryManager } from "./category-manager";
import { CarePlanningTable } from "./care-planning-table";
import { CareDetailPanel } from "./care-detail-panel";
import { ProtocolManager } from "./protocol-manager";
import styles from "./care-workspace.module.css";

const pageSize = 6;
function shiftDate(date: string, days: number) {
 const value = new Date(date + "T12:00:00Z");
 value.setUTCDate(value.getUTCDate() + days);
 return value.toISOString().slice(0, 10);
}
export function CareWorkspace({ initialData, patients }: { initialData: CareData; patients: Patient[] }) {
 const {medicalCare:data,setMedicalCare:setData}=useClinic();
 const [tab, setTab] = useState<"planning" | "protocols">("planning");
 const [protocolEditor, setProtocolEditor] = useState<CareProtocol | "new" | null>(null);
 const [date, setDate] = useState(initialData.planningDate);
 const [query, setQuery] = useState("");
 const [category, setCategory] = useState("");
 const [nurse, setNurse] = useState("");
 const [status, setStatus] = useState("");
 const [assigned, setAssigned] = useState(false);
 const [page, setPage] = useState(1);
 const [selectedId, setSelectedId] = useState<string | undefined>(initialData.treatments[0]?.id);
 const [mobileDetails, setMobileDetails] = useState(false);
 const [editor, setEditor] = useState<CareTreatment | "new" | null>(null);
 const [categoriesOpen, setCategoriesOpen] = useState(false);
 const [message, setMessage] = useState("");
 const patientName = (id: string) => patients.find(p => p.id === id)?.name ?? "Patient";
 const dayTreatments = data.treatments.filter(t => (t.planning?.date ?? t.startDate) === date);
 const filtered = dayTreatments.filter(t =>
  (!category || t.categoryId === category) && (!nurse || t.planning?.nurseId === nurse) &&
  (!status || t.status === status) && (!assigned || t.planning?.doctor === "Dr. Gaya") &&
  `${patientName(t.patientId)} ${t.patientId} ${t.type}`.toLocaleLowerCase("fr").includes(query.toLocaleLowerCase("fr"))
 ).sort((a, b) => (a.planning?.time ?? "").localeCompare(b.planning?.time ?? ""));
 const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
 const currentPage = Math.min(page, pages);
 const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
 const selected = visible.find(t => t.id === selectedId);
 function select(treatment: CareTreatment) { setSelectedId(treatment.id); setMobileDetails(window.matchMedia("(max-width: 1199px)").matches); }
 function resetFilters() { setQuery(""); setCategory(""); setNurse(""); setStatus(""); setAssigned(false); setPage(1); setDate(initialData.planningDate); }
 function updateTreatment(result: CareTreatment) {
  setData(current => ({ ...current, treatments: current.treatments.some(t => t.id === result.id) ? current.treatments.map(t => t.id === result.id ? result : t) : [...current.treatments, result] }));
 }
 async function save(draft: TreatmentDraft) {
  const result = await careService.prepareTreatment(draft, editor && editor !== "new" ? editor : undefined);
  updateTreatment(result); setEditor(null); setDate(result.planning?.date ?? result.startDate);
  const resultDate = result.planning?.date ?? result.startDate;
  const ordered = [...data.treatments.filter(t => t.id !== result.id), result].filter(t => (t.planning?.date ?? t.startDate) === resultDate).sort((a, b) => (a.planning?.time ?? "").localeCompare(b.planning?.time ?? ""));
  setQuery(""); setCategory(""); setNurse(""); setStatus(""); setAssigned(false); setPage(Math.floor(ordered.findIndex(t => t.id === result.id) / pageSize) + 1); setSelectedId(result.id);
  setMessage("Soin enregistré dans cette démonstration. Les modifications sont réinitialisées au rechargement.");
 }
 const detail = selected && <CareDetailPanel key={selected.id} treatment={selected} patient={patients.find(p => p.id === selected.patientId)} category={data.categories.find(c => c.id === selected.categoryId)} nurses={data.nurses}
  onClose={() => { setSelectedId(undefined); setMobileDetails(false); }}
  onEdit={() => { setMobileDetails(false); setEditor(selected); }}
  onDraft={async notes => { updateTreatment(await careService.prepareTreatment({ ...selected, notes }, selected)); }}/>;
 return <div className={styles.page}>
 <header className={styles.heading}><div><div className={styles.titleLine}><h1>Soins</h1><StatusBadge tone="neutral">Actif</StatusBadge></div><p>Planification, suivi et catalogue des soins médico-esthétiques</p></div>
 <div className={styles.headingControls}><div className={styles.viewControls} aria-label="Vue professionnelle"><span><Icon name="care"/> Vue Praticien (Dr. Gaya)</span><button disabled title="L’interface infirmière sera disponible ultérieurement"><Icon name="patients"/> Vue Infirmier(ère)</button></div><button className={styles.secondaryButton} onClick={() => { setTab("protocols"); setProtocolEditor("new"); }}><Icon name="prescriptions"/> + Nouveau type</button><button className={styles.primaryButton} onClick={() => setEditor("new")}><Icon name="add" size={13}/> Nouveau soin</button></div></header>
 <div className={styles.tabsRow}><div className={styles.tabs} role="tablist" aria-label="Sections des soins">{([{ id: "planning", label: "Planning des soins", icon: "agenda" }, { id: "protocols", label: "Types de soins & Protocoles", icon: "care" }] as const).map((item, index) => <button key={item.id} id={`care-tab-${item.id}`} role="tab" aria-selected={tab === item.id} aria-controls={`care-${item.id}`} tabIndex={tab === item.id ? 0 : -1} onClick={() => setTab(item.id)} onKeyDown={event => { if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); const next = index === 0 ? "protocols" : "planning"; setTab(next); document.getElementById(`care-tab-${next}`)?.focus(); } }}><Icon name={item.icon}/>{item.label}<span>{item.id === "planning" ? `${dayTreatments.length} soins` : `${data.protocols.length} protocoles`}</span></button>)}</div><p><Icon name="availability" size={13}/> Catalogue sous gouvernance médicale</p></div>
 {message && <p role="status" className={styles.feedback}>{message}</p>}
 {tab === "planning" ? <section id="care-planning" role="tabpanel" aria-labelledby="care-tab-planning">
 <div className={styles.stats}>
 <div><span><i/>À la date choisie</span><strong>{dayTreatments.length} soins</strong></div>
 <div><span><i/>En cours</span><strong>{dayTreatments.filter(t => t.status === "En cours").length} en cours</strong></div>
 <div><span><i/>Effectués</span><strong>{dayTreatments.filter(t => t.status === "Terminé").length} terminés</strong></div>
 <div><span><i/>À venir</span><strong>{dayTreatments.filter(t => t.status === "Planifié").length} planifiés</strong></div>
 <div className={styles.alertStat}><span><i/>Alertes</span><strong>{dayTreatments.filter(t => t.planning?.alert).length} à vérifier</strong></div>
 </div>
 <div className={styles.filters}>
 <div className={styles.searchDate}><label className={styles.search}><Icon name="search"/><span className="sr-only">Rechercher un programme</span><input placeholder="Rechercher un patient, acte…" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }}/></label><div className={styles.dateControls}><button aria-label="Jour précédent" onClick={() => { setDate(shiftDate(date, -1)); setPage(1); }}>‹</button><label><Icon name="calendar" size={13}/><span className="sr-only">Date du planning</span><input aria-label="Date du planning" type="date" value={date} onChange={e => { if (e.target.value) { setDate(e.target.value); setPage(1); } }}/></label><button aria-label="Jour suivant" onClick={() => { setDate(shiftDate(date, 1)); setPage(1); }}>›</button></div></div>
 <div className={styles.assignmentFilter}><button aria-pressed={assigned} onClick={() => { setAssigned(!assigned); setPage(1); }}><Icon name="care" size={13}/> Mes soins assignés</button><button className={styles.today} onClick={() => { const now = new Date(); setDate(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`); setPage(1); }}>Aujourd’hui</button></div>
 <div className={styles.selectFilters}><label><span className="sr-only">Catégorie</span><select aria-label="Catégorie" value={category} onChange={e => { setCategory(e.target.value); setPage(1); }}><option value="">Catégorie : Toutes</option>{data.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label><span className="sr-only">Infirmier(ère)</span><select aria-label="Infirmier(ère)" value={nurse} onChange={e => { setNurse(e.target.value); setPage(1); }}><option value="">Infirmier(ère) : Tous</option>{data.nurses.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}</select></label><label><span className="sr-only">Statut</span><select aria-label="Statut" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="">Statut : Tous</option>{["Planifié", "En cours", "Suspendu", "Terminé"].map(s => <option key={s}>{s}</option>)}</select></label><button className={styles.iconButton} onClick={resetFilters} aria-label="Réinitialiser les filtres">↻</button></div>
 </div>
 <div className={styles.content} data-detail={Boolean(selected)}><section className={styles.tableCard} aria-label="Planning des soins">
 <CarePlanningTable treatments={visible} patients={patients} categories={data.categories} nurses={data.nurses} selectedId={selected?.id} onSelect={select}/>
 <footer className={styles.tableFooter}><span>{filtered.length ? `Affichage de ${(currentPage - 1) * pageSize + 1} à ${Math.min(currentPage * pageSize, filtered.length)} sur ${filtered.length} soins` : "0 soin"} · {formatDate(date)}</span><nav aria-label="Pagination des soins">{Array.from({ length: pages }, (_, index) => <button key={index} aria-label={`Page ${index + 1}`} aria-current={currentPage === index + 1 ? "page" : undefined} onClick={() => setPage(index + 1)}>{index + 1}</button>)}</nav></footer></section>
 {selected && <aside className={styles.desktopDetail}>{!mobileDetails && detail}</aside>}</div>
 </section> : <div id="care-protocols" role="tabpanel" aria-labelledby="care-tab-protocols"><ProtocolManager editor={protocolEditor} setEditor={setProtocolEditor} protocols={data.protocols} categories={data.categories} onCategories={() => setCategoriesOpen(true)} onChange={protocol => setData(current => ({ ...current, protocols: current.protocols.some(p => p.id === protocol.id) ? current.protocols.map(p => p.id === protocol.id ? protocol : p) : [...current.protocols, protocol] }))}/></div>}
 <DetailDialog title="Fiche de Soin" open={mobileDetails && Boolean(selected)} onClose={() => setMobileDetails(false)}>{mobileDetails && detail}</DetailDialog>
 <DetailDialog title={editor === "new" ? "Nouveau soin" : "Modifier le programme"} open={Boolean(editor)} onClose={() => setEditor(null)}>{editor && <TreatmentForm key={editor === "new" ? "new" : editor.id} patients={patients} categories={data.categories} nurses={data.nurses} protocols={data.protocols} planningDate={date} treatment={editor === "new" ? undefined : editor} onSave={save}/>}</DetailDialog>
 <DetailDialog title="Catégories de soins" open={categoriesOpen} onClose={() => setCategoriesOpen(false)}>{categoriesOpen && <CategoryManager categories={data.categories} onChange={category => setData(current => ({ ...current, categories: current.categories.some(c => c.id === category.id) ? current.categories.map(c => c.id === category.id ? category : c) : [...current.categories, category] }))}/>}</DetailDialog>
 </div>;
}
