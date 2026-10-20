const base = process.argv[2] ?? "http://localhost:3000";
const jar = new Map();
function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}
function storeCookies(response) {
  const raw = response.headers.getSetCookie?.() ?? [];
  for (const cookie of raw) {
    const [pair] = cookie.split(";");
    const index = pair.indexOf("=");
    if (index > 0) jar.set(pair.slice(0, index), pair.slice(index + 1));
  }
}
async function call(path, options = {}) {
  const response = await fetch(base + path, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(jar.size ? { Cookie: cookieHeader() } : {}),
    },
  });
  storeCookies(response);
  const text = await response.text();
  console.log(path, response.status);
  console.log(text.slice(0, 2000));
  return { status: response.status, text };
}
const email = `dbg_${Date.now()}@cinemaverse.local`;
await call("/api/auth/register", {
  method: "POST",
  body: JSON.stringify({ email, password: "smoke-test-123", displayName: "Dbg" }),
});
await call("/api/catalog/import", {
  method: "POST",
  body: JSON.stringify({ provider: "wikidata", providerId: "Q25188" }),
});
