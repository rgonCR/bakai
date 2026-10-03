export function stripStatusEllipsis(label: string): string {
  return label.replace(/(?:[.\u2026\s])+$/u, "").trimEnd();
}
