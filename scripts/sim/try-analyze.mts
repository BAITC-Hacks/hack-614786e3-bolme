// Manual smoke test: npx tsx scripts/sim/try-analyze.ts  (uses OPENAI_API_KEY from env / .env.local)
import { readFileSync } from "node:fs";
try {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {}
const { POST } = await import("../../src/app/api/analyze/" + "route.ts");
const plan = [
  { measureId: "M7", districtId: "nura" }, { measureId: "M8", districtId: "nura" }, { measureId: "M10", districtId: "nura" },
  { measureId: "M12", districtId: null }, { measureId: "M5", districtId: "saryarka" },
];
const t = Date.now();
const res = await POST(new Request("http://x/api/analyze", { method: "POST", body: JSON.stringify({ plan, mods: { emergencies: true, anger: true, promises: true }, responses: { "heating-almaty": "bypass" }, promiseIds: ["schools-nura", "heat-almaty"] }) }));
const body = await res.json();
console.log("status", res.status, "ms", Date.now() - t, "source", body.source, body.model ?? "", body.note ?? "");
console.log(JSON.stringify({ summary: body.summary, strengths: body.strengths, risks: body.risks, tradeoffs: body.tradeoffs, recommendations: body.recommendations }, null, 1).slice(0, 3500));
