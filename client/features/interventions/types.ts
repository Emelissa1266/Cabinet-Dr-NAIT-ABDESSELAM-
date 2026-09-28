export interface InterventionType { id: string; label: string }
export interface Intervention { id: string; patient: string; patientId: string; date: string; time: string; typeId: string; duration: string; surgeon: string; anesthesia: string; status: string; room: string; checklist: { label: string; checked: boolean; warning?: boolean }[] }
export interface InterventionData { types: InterventionType[]; interventions: Intervention[] }
