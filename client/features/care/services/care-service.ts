import { mockCare } from "../data/mock-care";
import type { CareData, CareTreatment, TreatmentDraft, CareCategory, CareProtocol } from "../types";
export interface CareService {
 getOverview(): Promise<CareData>;
 prepareTreatment(draft: TreatmentDraft, existing?: CareTreatment): Promise<CareTreatment>;
 prepareCategory(draft: Omit<CareCategory, "id">, id?: string): Promise<CareCategory>;
 prepareProtocol(draft: Omit<CareProtocol, "id">, id?: string): Promise<CareProtocol>;
}
/** Demo adapter: returned changes live only in component state; no persistence. */
export const careService: CareService = {
 async getOverview() { return structuredClone(mockCare); },
 async prepareTreatment(draft, existing) { return { ...draft, id: existing?.id ?? crypto.randomUUID(), sessions: existing?.sessions ?? [] }; },
 async prepareCategory(draft, id) { return { ...draft, id: id ?? crypto.randomUUID() }; },
 async prepareProtocol(draft, id) { return { ...draft, id: id ?? crypto.randomUUID() }; }
};
