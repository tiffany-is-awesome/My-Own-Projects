/* ---------- Boot ---------- */
load();
const h0 = location.hash.slice(1);
setTab(h0 === "cookbooks" ? "saved" : (h0 === "studio" ? "cook" : (h0 === "pantry" ? "kitchen" : h0)));
renderAccount(); if (CLOUD_OK) Cloud.restore();
renderAiStatus();
const aiDone = () => { S.aiChecking = false; renderAiStatus(); if (S.tab === "cook") renderIdeas(); };
AI.init().then(aiDone, aiDone);
setTimeout(aiDone, 10000);
window.addEventListener("online", renderAiStatus); window.addEventListener("offline", renderAiStatus);
