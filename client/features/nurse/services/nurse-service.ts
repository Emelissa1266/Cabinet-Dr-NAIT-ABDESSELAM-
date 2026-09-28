import { mockNurse } from "../data/mock-nurse";
import type { NurseData } from "../types";
export interface NurseService {
    getOverview(): Promise<NurseData>;
}
/** Demo fixtures only. A future API must enforce nurse assignment and patient/media authorization. */
export const nurseService: NurseService = { async getOverview() { return structuredClone(mockNurse); } };
