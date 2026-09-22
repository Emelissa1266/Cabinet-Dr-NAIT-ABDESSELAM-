import type { PositionedAppointment } from "../lib/calendar-layout";
import styles from "./calendar.module.css";
export function CalendarEvent({ item, onSelect }: { item: PositionedAppointment; onSelect: () => void }) {
  const { appointment, start, end, column, columns } = item;
  const height = (end - start) * 1.6 - 3;
  return <button className={styles.event} data-category={appointment.category} data-calendar-event={appointment.id}
    style={{ top: (start - 480) * 1.6, height, left: `calc(${column / columns * 100}% + 4px)`, width: `calc(${100 / columns}% - 8px)` }}
    aria-label={`${appointment.patient}, ${appointment.type}, ${appointment.start} – ${appointment.end}, ${appointment.status}`}
    title={`${appointment.patient} · ${appointment.type} · ${appointment.start} – ${appointment.end}`} onClick={onSelect}>
    <strong>{appointment.patient}</strong>
    {height >= 65 && <span>{appointment.type}</span>}
    {height >= 40 && <time>{appointment.start} – {appointment.end}</time>}
    {height >= 85 && <span className={styles.status}><i aria-hidden="true" />{appointment.status}</span>}
  </button>;
}
