export function searchText(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function searchDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function customerNameFields(name: string) {
  return { name, searchName: searchText(name) };
}
