import { apiRequest } from "@/lib/api-client";
import type {
  BackendPatient,
  CreatePatientPayload,
  PaginatedResponse,
  Patient,
  PatientListParams,
  UpdatePatientPayload,
} from "../types";

function queryString(params: PatientListParams = {}) {
  const query = new URLSearchParams();
  if (params.page && params.page > 1) query.set("page", String(params.page));
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.ordering) query.set("ordering", params.ordering);
  if (params.gender) query.set("gender", params.gender);
  if (params.isActive !== "" && params.isActive !== undefined) query.set("is_active", String(params.isActive));
  const text = query.toString();
  return text ? `?${text}` : "";
}

function calculateAge(dateOfBirth: string | null) {
  if (!dateOfBirth) return null;
  const today = new Date();
  const [year, month, day] = dateOfBirth.split("-").map(Number);
  if (!year || !month || !day) return null;
  let age = today.getFullYear() - year;
  const beforeBirthday = today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day);
  if (beforeBirthday) age -= 1;
  return age;
}

function initials(firstName: string, lastName: string) {
  const value = `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
  return value || "P";
}

export function mapPatient(patient: BackendPatient): Patient {
  const name = `${patient.first_name} ${patient.last_name}`.trim();
  return {
    id: String(patient.id),
    apiId: patient.id,
    patientReference: patient.patient_reference,
    firstName: patient.first_name,
    lastName: patient.last_name,
    name: name || patient.patient_reference,
    initials: initials(patient.first_name, patient.last_name),
    age: calculateAge(patient.date_of_birth),
    dateOfBirth: patient.date_of_birth,
    gender: patient.gender,
    phone: patient.phone,
    email: patient.email,
    address: patient.address,
    city: patient.city,
    emergencyContact: patient.emergency_contact,
    emergencyPhone: patient.emergency_phone,
    profession: patient.profession,
    notes: patient.notes,
    isActive: patient.is_active,
    status: patient.is_active ? "Actif" : "Inactif",
    category: patient.is_active ? "active" : "inactive",
    medicalInformation: patient.medical_information,
    createdAt: patient.created_at,
    updatedAt: patient.updated_at,
  };
}

async function resolvePatientId(idOrReference: string) {
  if (/^\d+$/.test(idOrReference)) return idOrReference;
  const page = await listPatients({ search: idOrReference });
  const match = page.results.find((patient) => patient.patientReference === idOrReference);
  return match?.id ?? idOrReference;
}

export async function listPatients(params?: PatientListParams): Promise<PaginatedResponse<Patient>> {
  const response = await apiRequest<PaginatedResponse<BackendPatient>>(`patients/${queryString(params)}`);
  return { ...response, results: response.results.map(mapPatient) };
}

export async function getPatient(idOrReference: string): Promise<Patient> {
  const id = await resolvePatientId(idOrReference);
  return mapPatient(await apiRequest<BackendPatient>(`patients/${id}/`));
}

export async function createPatient(payload: CreatePatientPayload): Promise<Patient> {
  return mapPatient(await apiRequest<BackendPatient>("patients/", { method: "POST", body: payload }));
}

export async function updatePatient(id: string | number, payload: UpdatePatientPayload): Promise<Patient> {
  return mapPatient(await apiRequest<BackendPatient>(`patients/${id}/`, { method: "PATCH", body: payload }));
}

export async function deletePatient(id: string | number): Promise<void> {
  await apiRequest<void>(`patients/${id}/`, { method: "DELETE" });
}

export const patientService = {
  list: listPatients,
  get: getPatient,
  create: createPatient,
  update: updatePatient,
  delete: deletePatient,
};
