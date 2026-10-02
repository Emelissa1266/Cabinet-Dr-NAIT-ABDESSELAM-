export function dashboardErrorMessage(cause: unknown) {
  void cause;
  return "Impossible de charger le tableau de bord.";
}

export function dateTime(value: string | null | undefined) {
  if (!value) return "Non renseigné";
  return new Intl.DateTimeFormat("fr-DZ", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function money(value: string | null | undefined) {
  if (!value) return "0,00 DZD";
  const [major, minor = "00"] = value.split(".");
  return `${major.replace(/\B(?=(\d{3})+(?!\d))/g, " ")},${minor.slice(0, 2).padEnd(2, "0")} DZD`;
}
