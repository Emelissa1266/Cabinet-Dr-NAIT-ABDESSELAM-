import type { NursingSession } from "../types";
/** Connected overlap groups, with a readable column for each concurrent appointment. */
export function agendaGroups(sessions: NursingSession[]): NursingSession[][] {
    const groups: NursingSession[][] = [];
    let latestEnd = "";
    for (const session of [...sessions].sort((a, b) => a.start.localeCompare(b.start))) {
        if (!groups.length || session.start >= latestEnd) {
            groups.push([session]);
            latestEnd = session.end;
        }
        else {
            groups[groups.length - 1].push(session);
            if (session.end > latestEnd)
                latestEnd = session.end;
        }
    }
    return groups;
}
