"use client";
import Link from "next/link";
import {useState} from "react";
import {DetailDialog} from "@/components/ui/detail-dialog";
import type {Patient} from "@/features/patients/types";
import {createLeave} from "../services/work-leave-api";
import {WorkLeaveEditor} from "./work-leave-editor";
import ui from "@/components/ui/clinical.module.css";
export function CreateWorkLeaveButton({patient, consultation}: {patient: Patient; consultation: number}) {
  const [open,setOpen]=useState(false);
  const [message,setMessage]=useState("");
  return <><div className={ui.actions}><button className={ui.action} onClick={()=>setOpen(true)}>Créer un arrêt de travail</button><Link className={ui.action} href={`/work-leaves?consultation=${consultation}&patient=${patient.apiId}`}>Arrêts de cette consultation</Link></div>{message && <p role="status">{message}</p>}
    <DetailDialog wide title="Arrêt de travail lié à la consultation" open={open} onClose={()=>setOpen(false)}>{open && <WorkLeaveEditor patients={[patient]} patient={patient} consultation={consultation} onSave={async payload=>{await createLeave(payload);setOpen(false);setMessage("Brouillon enregistré dans le dossier patient. Retrouvez-le dans Arrêts de travail pour le valider et l'émettre.");window.dispatchEvent(new Event("work-leaves-changed"));}}/>}</DetailDialog>
  </>;
}
