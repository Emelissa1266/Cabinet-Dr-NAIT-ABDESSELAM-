export const clinicTimeZone = "Africa/Algiers";
export const clinicIsoOffset = "+01:00";

const dateParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: clinicTimeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const timeParts = new Intl.DateTimeFormat("fr-DZ", {
  timeZone: clinicTimeZone,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function clinicDateKey(value: string | Date) {
  const parts = dateParts.formatToParts(typeof value === "string" ? new Date(value) : value);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function clinicTime(value: string | Date) {
  return timeParts.format(typeof value === "string" ? new Date(value) : value);
}

export function labelClinicDate(date: string, options: Intl.DateTimeFormatOptions) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("fr-DZ", { ...options, timeZone: "UTC" });
}

export function shiftClinicDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function localAppointmentIso(date: string, time: string) {
  return `${date}T${time.length === 5 ? `${time}:00` : time}${clinicIsoOffset}`;
}
