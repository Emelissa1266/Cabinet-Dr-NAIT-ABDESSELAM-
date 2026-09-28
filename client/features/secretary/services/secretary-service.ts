import {mockSecretary} from "../data/mock-secretary";
import type {SecretaryData} from "../types";
export interface SecretaryService {getOverview():Promise<SecretaryData>}
export const secretaryService:SecretaryService={async getOverview(){return structuredClone(mockSecretary);}};

