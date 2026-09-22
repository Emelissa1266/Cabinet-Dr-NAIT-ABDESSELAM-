export interface Patient {
  id: string;
  name: string;
  initials: string;
  age: number;
  phone: string;
  email: string;
  lastVisit: string;
  nextVisit: string;
  nextTime: string;
  status: string;
  category: "follow-up" | "preop" | "intervention" | "other";
}
