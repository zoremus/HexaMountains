export function resolveAssetUrl(path) {
  const baseUrl = String(import.meta.env.BASE_URL ?? "/");
  const normalizedPath = String(path).replace(/^\/+/, "");
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return `${normalizedBase}${normalizedPath}`;
}
