export function toSentenceList(items = []) {
  return items.filter(Boolean).map((item) => `- ${item}`).join("\n");
}

export function truncate(value, maxLength = 1900) {
  if (!value) return "";
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}
