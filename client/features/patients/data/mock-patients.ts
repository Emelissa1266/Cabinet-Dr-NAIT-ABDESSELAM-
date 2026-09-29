import type { Patient } from "../types";

const timestamp = "2026-09-01T09:00:00Z";

function mockPatient({
  id,
  firstName,
  lastName,
  age,
  dateOfBirth,
  phone,
  email,
  city = "Alger",
  status = "Actif",
}: {
  id: string;
  firstName: string;
  lastName: string;
  age: number;
  dateOfBirth: string;
  phone: string;
  email: string;
  city?: string;
  status?: string;
}): Patient {
  return {
    id,
    apiId: Number(id.replace(/\D/g, "")),
    patientReference: id,
    firstName,
    lastName,
    name: `${firstName} ${lastName}`,
    initials: `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase(),
    age,
    dateOfBirth,
    gender: "UNKNOWN",
    phone,
    email,
    address: "",
    city,
    emergencyContact: "",
    emergencyPhone: "",
    profession: "",
    notes: "",
    isActive: true,
    status,
    category: "active",
    medicalInformation: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

// Fictional fixtures retained for future-domain demos that still reference P-xxxxx ids.
export const mockPatients: Patient[] = [
  mockPatient({ id: "P-00254", firstName: "Sarah", lastName: "Benali", age: 32, dateOfBirth: "1994-05-12", phone: "+213 550 12 34 56", email: "sarah.benali@example.com", status: "Suivi postopératoire" }),
  mockPatient({ id: "P-00255", firstName: "Lina", lastName: "Haddad", age: 28, dateOfBirth: "1998-03-08", phone: "+213 661 45 67 89", email: "lina.haddad@example.com", status: "Préopératoire" }),
  mockPatient({ id: "P-00248", firstName: "Amel", lastName: "Khellil", age: 41, dateOfBirth: "1985-02-20", phone: "+213 770 98 76 54", email: "amel.khellil@example.com", status: "Intervention programmée" }),
  mockPatient({ id: "P-00239", firstName: "Karim", lastName: "Benaissa", age: 37, dateOfBirth: "1989-06-14", phone: "+213 555 89 12 34", email: "karim.benaissa@example.com", status: "Contrôle J+15" }),
  mockPatient({ id: "P-00260", firstName: "Yasmine", lastName: "Tlemçani", age: 29, dateOfBirth: "1997-04-10", phone: "+213 662 33 44 55", email: "yasmine.tlemcani@example.com", status: "Consultation initiale" }),
  mockPatient({ id: "P-00215", firstName: "Malek", lastName: "Zouaoui", age: 45, dateOfBirth: "1981-01-18", phone: "+213 551 77 88 99", email: "malek.zouaoui@example.com", status: "Bilan annuel" }),
];
