const base = "http://localhost:3000";
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
  let json = null;
  try { json = JSON.parse(text); } catch {}
  console.log(path, response.status);
  console.log(text.slice(0, 1500));
  return { status: response.status, json };
}

await call("/api/auth/register", {
  method: "POST",
  body: JSON.stringify({
    email: `series_${Date.now()}@cinemaverse.local`,
    password: "smoke-test-123",
    displayName: "Dizi Test",
  }),
});
const search = await call("/api/search?q=breaking%20bad&kind=series");
const first = search.json?.results?.[0];
console.log("\nFIRST:", first?.originalTitle, first?.provider, first?.providerId);
if (first) {
  await call("/api/catalog/import", {
    method: "POST",
    body: JSON.stringify({ provider: first.provider, providerId: first.providerId }),
  });
}
