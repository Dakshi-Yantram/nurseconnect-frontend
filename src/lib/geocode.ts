// Resolve a typed address to coordinates in the browser, so a manual address
// books without the customer ever pressing "Use current location".
// 1) OpenStreetMap Nominatim (progressively looser queries), then
// 2) an approximate city-centre / pincode-prefix fallback if that is unreachable.

export type AddressParts = {
  line1?: string | null; line2?: string | null; landmark?: string | null;
  city?: string | null; state?: string | null; pincode?: string | null;
};

const CITY: Record<string, [number, number]> = {
  hyderabad: [17.385, 78.4867], secunderabad: [17.4399, 78.4983],
  delhi: [28.6139, 77.209], "new delhi": [28.6139, 77.209],
  gurgaon: [28.4595, 77.0266], gurugram: [28.4595, 77.0266],
  noida: [28.5355, 77.391], ghaziabad: [28.6692, 77.4538],
  mumbai: [19.076, 72.8777], thane: [19.2183, 72.9781], "navi mumbai": [19.033, 73.0297],
  pune: [18.5204, 73.8567], bengaluru: [12.9716, 77.5946], bangalore: [12.9716, 77.5946],
  chennai: [13.0827, 80.2707], kolkata: [22.5726, 88.3639], ahmedabad: [23.0225, 72.5714],
  jaipur: [26.9124, 75.7873], lucknow: [26.8467, 80.9462], chandigarh: [30.7333, 76.7794],
  indore: [22.7196, 75.8577], bhopal: [23.2599, 77.4126], patna: [25.5941, 85.1376],
  kochi: [9.9312, 76.2673], visakhapatnam: [17.6868, 83.2185], vijayawada: [16.5062, 80.648],
  nagpur: [21.1458, 79.0882], surat: [21.1702, 72.8311], coimbatore: [11.0168, 76.9558],
  bhubaneswar: [20.2961, 85.8245],
};
const PIN3: Record<string, string> = {
  "110": "delhi", "122": "gurgaon", "201": "noida", "400": "mumbai", "401": "thane",
  "411": "pune", "560": "bengaluru", "600": "chennai", "700": "kolkata", "380": "ahmedabad",
  "302": "jaipur", "226": "lucknow", "160": "chandigarh", "452": "indore", "462": "bhopal",
  "800": "patna", "682": "kochi", "530": "visakhapatnam", "520": "vijayawada",
  "440": "nagpur", "395": "surat", "641": "coimbatore", "751": "bhubaneswar",
  ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`50${i}`, "hyderabad"])),
};

function approx(a: AddressParts): [number, number] | null {
  const blob = [a.city, a.state, a.line2, a.line1, a.landmark].filter(Boolean).join(" ").toLowerCase();
  const names = Object.keys(CITY).sort((x, y) => y.length - x.length);
  let key = names.find((n) => new RegExp(`\\b${n}\\b`).test(blob));
  if (!key && a.pincode) key = PIN3[String(a.pincode).trim().slice(0, 3)];
  return key ? CITY[key] : null;
}

const join = (...p: (string | null | undefined)[]) => p.map((x) => (x ?? "").trim()).filter(Boolean).join(", ");

async function nominatim(q: string): Promise<[number, number] | null> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 6000);
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=${encodeURIComponent(q)}`,
      { headers: { "Accept-Language": "en" }, signal: ctl.signal },
    );
    if (!r.ok) return null;
    const j = await r.json();
    return j?.[0] ? [Number(j[0].lat), Number(j[0].lon)] : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function forwardGeocode(a: AddressParts): Promise<{ latitude: number; longitude: number } | null> {
  const queries = [
    join(a.line1, a.line2, a.landmark, a.city, a.state, a.pincode),
    join(a.line2, a.city, a.state, a.pincode),
    join(a.city, a.state, a.pincode),
    join(a.pincode),
  ];
  const seen = new Set<string>();
  for (const q of queries) {
    if (!q || seen.has(q)) continue;
    seen.add(q);
    const hit = await nominatim(q);
    if (hit) return { latitude: hit[0], longitude: hit[1] };
  }
  const f = approx(a);
  return f ? { latitude: f[0], longitude: f[1] } : null;
}
