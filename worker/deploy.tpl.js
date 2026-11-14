async () => {
const code = __CODE__;
const lab = __LAB__;
const inner = __INNER__;
const army = __ARMY__;
const browse = __BROWSE__;
const workshop = __WORKSHOP__;
const codemap = __CODEMAP__;
const sources = __SOURCES__;
const metadata = { main_module: "worker.mjs", compatibility_date: "2025-09-01", bindings: [{ type: "d1", name: "DB", id: "__DB__" }, { type: "ai", name: "AI" }], keep_bindings: [] };
const form = new FormData();
form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
form.append("worker.mjs", new Blob([code], { type: "application/javascript+module" }), "worker.mjs");
form.append("lab.js", new Blob([lab], { type: "application/javascript+module" }), "lab.js");
form.append("inner.js", new Blob([inner], { type: "application/javascript+module" }), "inner.js");
form.append("army.js", new Blob([army], { type: "application/javascript+module" }), "army.js");
form.append("browse.js", new Blob([browse], { type: "application/javascript+module" }), "browse.js");
form.append("workshop.js", new Blob([workshop], { type: "application/javascript+module" }), "workshop.js");
form.append("codemap.js", new Blob([codemap], { type: "application/javascript+module" }), "codemap.js");
form.append("sources.js", new Blob([sources], { type: "application/javascript+module" }), "sources.js");
const up = await cloudflare.request({ method: "PUT", path: `/accounts/${accountId}/workers/scripts/grokky-habitat-mind`, body: form });
const sch = await cloudflare.request({ method: "PUT", path: `/accounts/${accountId}/workers/scripts/grokky-habitat-mind/schedules`, body: [{ cron: "__CRON__" }] });
const sub = await cloudflare.request({ method: "POST", path: `/accounts/${accountId}/workers/scripts/grokky-habitat-mind/subdomain`, body: { enabled: true, previews_enabled: false } });
return { up: up.success, res: up.result && { id: up.result.id, etag: up.result.etag, modified_on: up.result.modified_on, deployment_id: up.result.deployment_id }, size: code.length, sch: sch.result.schedules.map(s => s.cron), sub: sub.result };
}
