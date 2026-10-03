const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function isLocalRequest(request: Request, mutation = false) {
  const host = request.headers.get("host");
  if (!host) return false;
  let url: URL;
  try {
    url = new URL(`${new URL(request.url).protocol}//${host}`);
  } catch {
    return false;
  }
  if (!LOOPBACK_HOSTS.has(url.hostname)) return false;
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  return mutation ? origin === url.origin : !origin || origin === url.origin;
}
