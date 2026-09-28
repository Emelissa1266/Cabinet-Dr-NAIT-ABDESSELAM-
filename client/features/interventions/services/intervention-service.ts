import { mockInterventions } from "../data/mock-interventions";
import type { InterventionData } from "../types";
interface InterventionService { getProgram(): Promise<InterventionData> }
export const interventionService: InterventionService = { async getProgram() { return structuredClone(mockInterventions); } };
