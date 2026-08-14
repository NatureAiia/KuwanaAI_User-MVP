export function formatDate(date: Date): string {
  return date.toLocaleDateString();
}

export function formatDateTime(date: Date): string {
  return date.toISOString().replace("T", " ").slice(0, 19);
}
