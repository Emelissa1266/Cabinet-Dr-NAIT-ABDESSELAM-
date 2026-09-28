import type { ClinicalPhoto } from "../types";
export const mockPhotos: ClinicalPhoto[] = [
 { id:"PHOTO-01",patientId:"P-00254",date:"2026-08-13",phase:"Avant",intervention:"Rhinoplastie ultrasonique",category:"Face",notes:"Cliché préopératoire J-15. Image de démonstration issue de la maquette.",image:{src:"/images/sarah-before.png",alt:"Cliché de démonstration avant intervention",width:229,height:128}},
 { id:"PHOTO-02",patientId:"P-00254",date:"2026-09-09",phase:"Après",intervention:"Rhinoplastie ultrasonique",category:"Profil",notes:"Cliché postopératoire J+12. Image de démonstration issue de la maquette.",image:{src:"/images/sarah-after.png",alt:"Cliché de démonstration après intervention",width:235,height:128}}
];
