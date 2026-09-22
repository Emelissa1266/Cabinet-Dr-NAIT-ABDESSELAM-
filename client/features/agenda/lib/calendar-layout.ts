import type { Appointment } from "../types";
export const toMinutes = (time: string) => { const [hour, minute] = time.split(":").map(Number); return hour * 60 + minute; };
export interface PositionedAppointment { appointment: Appointment; start: number; end: number; column: number; columns: number }
/** Partition each connected overlap group into lanes. Touching endpoints do not collide. */
export function layoutAppointments(appointments: Appointment[]): PositionedAppointment[] {
  const sorted = appointments.map((appointment) => ({ appointment, start: toMinutes(appointment.start), end: toMinutes(appointment.end), column: 0, columns: 1 }))
    .filter((item) => item.end > item.start).sort((a, b) => a.start - b.start || b.end - a.end || a.appointment.id.localeCompare(b.appointment.id));
  const result: PositionedAppointment[] = [];
  let group: PositionedAppointment[] = [];
  let laneEnds: number[] = [];
  let groupEnd = -Infinity;
  const flush = () => { for (const item of group) result.push({ ...item, columns: laneEnds.length }); group = []; laneEnds = []; };
  for (const item of sorted) {
    if (item.start >= groupEnd) flush();
    let column = laneEnds.findIndex((end) => end <= item.start);
    if (column === -1) column = laneEnds.length;
    laneEnds[column] = item.end;
    group.push({ ...item, column });
    groupEnd = group.length === 1 ? item.end : Math.max(groupEnd, item.end);
  }
  flush();
  return result;
}
