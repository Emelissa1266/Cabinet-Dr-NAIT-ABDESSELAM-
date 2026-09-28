import type { Prescription } from "../types";
export const mockPrescriptions: Prescription[] = [
 {id:"ORD-2026-014",patientId:"P-00254",date:"2026-09-12",doctor:"Dr. Gaya",status:"Enregistrée",notes:"Exemple de dossier fictif — prescription de démonstration.",medications:[{id:"m1",name:"Sérum physiologique",dosage:"Solution 0,9 %",frequency:"Selon protocole prescrit",duration:"7 jours",instructions:"Usage local suivant les consignes du praticien."}]},
 {id:"ORD-2026-013",patientId:"P-00239",date:"2026-09-10",doctor:"Dr. Gaya",status:"Brouillon",notes:"À compléter lors de la consultation.",medications:[{id:"m2",name:"Soin cicatriciel",dosage:"À préciser",frequency:"À préciser",duration:"À préciser",instructions:"Brouillon de démonstration non validé."}]}
];
