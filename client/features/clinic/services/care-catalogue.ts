import type {CareData} from "@/features/care/types";
import type {NurseData} from "@/features/nurse/types";
export function medicalCatalogue(data:CareData,nurse:NurseData):CareData{
 return {...structuredClone(data),categories:[...data.categories,...(nurse.categories??[]).filter(c=>!data.categories.some(x=>x.id===c.id))],protocols:[...data.protocols,...(nurse.careTypes??[]).map(t=>({id:t.id,name:t.name,categoryId:t.categoryId,instructions:t.protocol,description:t.description,durationMinutes:t.defaultDuration,defaultSessions:t.defaultSessions,defaultPricePerSession:t.defaultPricePerSession,requiredParameters:t.requiredParameters,active:t.active}))]};
}
export function nurseCatalogue(nurse:NurseData,data:CareData):NurseData{
 return {...nurse,categories:data.categories,careTypes:data.protocols.map(p=>({id:p.id,name:p.name,description:p.description??p.name,categoryId:p.categoryId,protocol:p.instructions,defaultDuration:p.durationMinutes,defaultSessions:p.defaultSessions??1,defaultPricePerSession:p.defaultPricePerSession??0,requiredParameters:p.requiredParameters??[],active:p.active&&Boolean(data.categories.find(c=>c.id===p.categoryId)?.active)}))};
}
