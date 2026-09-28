"use client";
import { useState } from "react";
import type { CareCategory } from "../types";
import { careService } from "../services/care-service";
import { StatusBadge } from "@/components/ui/status-badge";
import ui from "@/components/ui/clinical.module.css";
import styles from "@/components/ui/module-workspace.module.css";
export function CategoryManager({ categories, onChange }: { categories: CareCategory[]; onChange:(category:CareCategory)=>void }) {
 const [editing,setEditing]=useState<CareCategory|null>(null);
 const [version,setVersion]=useState(0);
 const [message,setMessage]=useState("");
 const [busy,setBusy]=useState(false);
 return <div className={styles.stack}><p className={styles.notice}>Catégories de démonstration configurables. Les modifications ne sont pas persistées.</p>
 <ul className={styles.list}>{categories.map(c=><li key={c.id}><div className={ui.actions}><strong>{c.name}</strong><StatusBadge tone={c.active?"teal":"neutral"}>{c.active?"Active":"Inactive"}</StatusBadge><button className={ui.action} onClick={()=>{setEditing(c);setVersion(v=>v+1);setMessage("");}} aria-label={`Modifier la catégorie ${c.name}`}>Modifier</button></div><small>{c.description}</small></li>)}</ul>
 <form key={version} className={ui.form} onSubmit={async e=>{e.preventDefault();const data=new FormData(e.currentTarget);const name=String(data.get("name")).trim();if(!name){setMessage("Le nom est obligatoire.");return;}if(categories.some(c=>c.id!==editing?.id&&c.name.toLocaleLowerCase("fr")===name.toLocaleLowerCase("fr"))){setMessage("Cette catégorie existe déjà.");return;}setBusy(true);try{onChange(await careService.prepareCategory({name,description:String(data.get("description")).trim(),active:data.get("active")==="yes"},editing?.id));setEditing(null);setVersion(v=>v+1);setMessage("Catégorie enregistrée dans cette démonstration.");}catch{setMessage("Impossible d’enregistrer la catégorie.");}finally{setBusy(false);}}}>
 <h3>{editing?"Modifier la catégorie":"Nouvelle catégorie"}</h3><label>Nom de la catégorie<input name="name" required maxLength={80} defaultValue={editing?.name}/></label><label>Description<textarea name="description" maxLength={500} defaultValue={editing?.description}/></label><label>Disponibilité<select name="active" defaultValue={editing?.active===false?"no":"yes"}><option value="yes">Active</option><option value="no">Inactive</option></select></label>
 <div className={ui.actions}><button type="submit" className={`${ui.action} ${ui.primary}`} disabled={busy}>Enregistrer la catégorie</button>{editing&&<button type="button" className={ui.action} onClick={()=>{setEditing(null);setVersion(v=>v+1);}}>Annuler</button>}</div>
 </form><p role="status">{message}</p></div>;
}
