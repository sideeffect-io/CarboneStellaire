export function normalizeImageFilename(filename) {
  const source = String(filename ?? "").trim();
  const extensionIndex = source.lastIndexOf(".");
  const rawStem = extensionIndex > 0 ? source.slice(0, extensionIndex) : source;
  const extension = extensionIndex > 0 ? source.slice(extensionIndex + 1).toLowerCase() : "";
  const stem = rawStem
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^[._-]+|[._-]+$/g, "");

  return `${stem || "image"}${extension ? `.${extension}` : ""}`;
}

export function uniqueImageFilename(filename, filenames) {
  const normalized = normalizeImageFilename(filename);
  if (!filenames.has(normalized)) return normalized;

  const extensionIndex = normalized.lastIndexOf(".");
  const stem = extensionIndex > 0 ? normalized.slice(0, extensionIndex) : normalized;
  const extension = extensionIndex > 0 ? normalized.slice(extensionIndex) : "";
  let suffix = 2;
  let candidate = `${stem}-${suffix}${extension}`;
  while (filenames.has(candidate)) {
    suffix += 1;
    candidate = `${stem}-${suffix}${extension}`;
  }
  return candidate;
}
