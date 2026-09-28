import type { Patient } from "../types";
// Fictional Figma fixtures; contact emails deliberately use example.com.
export const mockPatients: Patient[] = [
  { id: "P-00254", name: "Sarah Benali", initials: "SB", age: 32, phone: "+213 550 12 34 56", email: "sarah.benali@example.com", lastVisit: "02 Sept. 2026", nextVisit: "15 Sept.", nextTime: "10:30", status: "Suivi postopératoire", category: "follow-up" },
  { id: "P-00255", name: "Lina Haddad", initials: "LH", age: 28, phone: "+213 661 45 67 89", email: "lina.haddad@example.com", lastVisit: "10 Août 2026", nextVisit: "15 Sept.", nextTime: "14:00", status: "Préopératoire", category: "preop" },
  { id: "P-00248", name: "Amel Khellil", initials: "AK", age: 41, phone: "+213 770 98 76 54", email: "amel.khellil@example.com", lastVisit: "28 Août 2026", nextVisit: "16 Sept.", nextTime: "09:00", status: "Intervention programmée", category: "intervention" },
  { id: "P-00239", name: "Karim Benaissa", initials: "KB", age: 37, phone: "+213 555 89 12 34", email: "karim.benaissa@example.com", lastVisit: "01 Sept. 2026", nextVisit: "17 Sept.", nextTime: "11:00", status: "Contrôle J+15", category: "follow-up" },
  { id: "P-00260", name: "Yasmine Tlemçani", initials: "YT", age: 29, phone: "+213 662 33 44 55", email: "yasmine.tlemcani@example.com", lastVisit: "12 Sept. 2026", nextVisit: "18 Sept.", nextTime: "16:30", status: "Consultation initiale", category: "other" },
  { id: "P-00215", name: "Malek Zouaoui", initials: "MZ", age: 45, phone: "+213 551 77 88 99", email: "malek.zouaoui@example.com", lastVisit: "15 Juil. 2026", nextVisit: "22 Sept.", nextTime: "10:00", status: "Bilan annuel", category: "other" },
];
