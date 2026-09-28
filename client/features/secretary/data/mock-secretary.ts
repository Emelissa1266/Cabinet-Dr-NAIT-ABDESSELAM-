import type {SecretaryData,AdminPatient} from "../types";
export const secretaryProfile={name:"Sonia Benali",title:"Secrétaire administrative"};
const patient=(id:string,firstName:string,lastName:string,birthDate:string,phone:string):AdminPatient=>({id,firstName,lastName,birthDate,phone,email:firstName.toLowerCase()+"@example.test",gender:"Femme",address:"12 rue des Glycines",city:"Alger",insurance:"Paiement personnel",emergencyName:"",emergencyPhone:"",doctorId:"DR-1",status:"Actif",history:[{date:"2026-09-01",label:"Dossier administratif ouvert"}]});
export const mockSecretary:SecretaryData={
 date:"2026-09-21",
 doctors:[{id:"DR-1",name:"Dr. Yacine Ahmed",specialty:"Consultation"},{id:"DR-2",name:"Dr. Gaya",specialty:"Chirurgie & suivi"},{id:"DR-3",name:"Dr. Meziane",specialty:"Soins médico-esthétiques"}],
 rooms:["Cabinet 1","Cabinet 2","Cabine Laser 2","Salle de soins 1"],
 types:[{id:"AT-1",label:"Consultation de suivi",duration:30,price:6000},{id:"AT-2",label:"Séance laser",duration:45,price:15000},{id:"AT-3",label:"Consultation initiale",duration:45,price:8000},{id:"AT-4",label:"Soin programmé",duration:30,price:7000}],
 patients:[patient("P-00254","Sarah","Benali","1994-04-12","+213 550 12 34 56"),patient("P-00255","Lina","Haddad","1998-06-20","+213 661 89 92 10"),patient("P-00248","Amel","Kaci","1985-02-03","+213 770 45 67 89"),{...patient("P-00239","Karim","Bensaid","1989-07-15","+213 555 90 12 34"),gender:"Homme"},patient("P-00311","Sara","Touati","1991-03-19","+213 560 11 22 33"),patient("P-00260","Yasmine","Tlemçani","1997-01-08","+213 660 12 12 12"),{...patient("P-00320","Mehdi","Zerhouni","1990-08-05","+213 555 47 77 89"),gender:"Homme",email:"",address:"",status:"À compléter"}],
 appointments:[
 {id:"RDV-101",patientId:"P-00254",doctorId:"DR-1",typeId:"AT-1",date:"2026-09-21",start:"09:00",duration:30,room:"Cabinet 1",reason:"Contrôle programmé",notes:"Accueil effectué. Coordonnées vérifiées.",status:"Arrivé"},
 {id:"RDV-102",patientId:"P-00255",doctorId:"DR-3",typeId:"AT-2",date:"2026-09-21",start:"09:30",duration:45,room:"Cabine Laser 2",reason:"Séance programmée",notes:"",status:"En consultation"},
 {id:"RDV-103",patientId:"P-00248",doctorId:"DR-1",typeId:"AT-1",date:"2026-09-21",start:"10:00",duration:30,room:"Cabinet 1",reason:"Rendez-vous de suivi",notes:"",status:"Confirmé"},
 {id:"RDV-104",patientId:"P-00239",doctorId:"DR-2",typeId:"AT-4",date:"2026-09-21",start:"10:00",duration:45,room:"Salle de soins 1",reason:"Soin programmé",notes:"",status:"Confirmé"},
 {id:"RDV-105",patientId:"P-00311",doctorId:"DR-3",typeId:"AT-4",date:"2026-09-21",start:"11:15",duration:30,room:"Cabine Laser 2",reason:"Accueil à confirmer",notes:"",status:"À confirmer"},
 {id:"RDV-106",patientId:"P-00260",doctorId:"DR-2",typeId:"AT-1",date:"2026-09-21",start:"11:45",duration:15,room:"Cabinet 2",reason:"Suivi prévu",notes:"",status:"Confirmé"},
 {id:"RDV-107",patientId:"P-00320",doctorId:"DR-1",typeId:"AT-3",date:"2026-09-22",start:"09:00",duration:45,room:"Cabinet 1",reason:"Première visite",notes:"Compléter la fiche administrative.",status:"À confirmer"}],
 invoices:[
 {id:"FAC-2026-0050",patientId:"P-00254",doctorId:"DR-1",appointmentId:"RDV-101",date:"2026-09-21",dueDate:"2026-09-25",description:"Forfait séances laser",quantity:1,unitPrice:60000},
 {id:"FAC-2026-0049",patientId:"P-00255",doctorId:"DR-3",appointmentId:"RDV-102",date:"2026-09-21",dueDate:"2026-09-21",description:"Séance laser",quantity:1,unitPrice:15000},
 {id:"FAC-2026-0048",patientId:"P-00239",doctorId:"DR-2",date:"2026-09-18",dueDate:"2026-09-19",description:"Soin programmé",quantity:1,unitPrice:8000},
 {id:"FAC-2026-0047",patientId:"P-00248",doctorId:"DR-1",date:"2026-09-18",dueDate:"2026-09-20",description:"Consultation de suivi",quantity:1,unitPrice:6000}],
 payments:[{id:"REG-001",invoiceId:"FAC-2026-0050",amount:30000,method:"Carte",date:"2026-09-21",reference:"DEMO-945210",notes:"Acompte de démonstration"},{id:"REG-002",invoiceId:"FAC-2026-0049",amount:15000,method:"Espèces",date:"2026-09-21",reference:"",notes:""}]
};

