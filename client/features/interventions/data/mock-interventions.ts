import type { InterventionData } from "../types";
export const mockInterventions: InterventionData = {
 types: [{id:"rhinoplasty",label:"Rhinoplastie ultrasonique"},{id:"blepharoplasty",label:"Blépharoplastie supérieure"},{id:"lifting",label:"Lifting cervico-facial"},{id:"otoplasty",label:"Otoplastie bilatérale"}],
 interventions: [
 {id:"i1",patient:"Sarah Benali",patientId:"P-00254",date:"2026-09-20",time:"09:00",typeId:"rhinoplasty",duration:"2 h 30",surgeon:"Dr. Gaya",anesthesia:"Générale · Dr. Zerrouk",status:"Préopératoire",room:"Bloc A · Salle 01",checklist:[{label:"Consultation chirurgicale préopératoire validée",checked:true},{label:"Bilan biologique & hémostase conforme",checked:true},{label:"Consultation pré-anesthésique",checked:true},{label:"Allergies vérifiées : pénicilline",checked:true,warning:true},{label:"Consentement éclairé signé",checked:false},{label:"Dossier d’admission complet",checked:false}]},
 {id:"i2",patient:"Lina Haddad",patientId:"P-00255",date:"2026-09-20",time:"14:00",typeId:"blepharoplasty",duration:"1 h 45",surgeon:"Dr. Gaya",anesthesia:"Locale assistée",status:"Programmée",room:"Bloc A",checklist:[]},
 {id:"i3",patient:"Amel Khellil",patientId:"P-00248",date:"2026-09-21",time:"08:30",typeId:"lifting",duration:"3 h 30",surgeon:"Dr. Gaya",anesthesia:"Générale",status:"Programmée",room:"Bloc A",checklist:[]},
 {id:"i4",patient:"Karim Benaissa",patientId:"P-00239",date:"2026-09-18",time:"11:15",typeId:"otoplasty",duration:"1 h 15",surgeon:"Dr. Gaya",anesthesia:"Locale sédation",status:"Terminée",room:"Bloc A",checklist:[]}
 ] };
