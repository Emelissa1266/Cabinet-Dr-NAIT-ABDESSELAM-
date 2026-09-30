type QueryObject = object;
type QueryValue = string | number | boolean | null | undefined;

export function queryString(params: QueryObject) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params) as [string, QueryValue][]) {
    if (value === undefined || value === null || value === "") continue;
    query.set(key, String(value));
  }
  const text = query.toString();
  return text ? `?${text}` : "";
}
