// STASE — service worker (repris de ZESTE et ASCEN) : l'app s'ouvre instantanément, avec ou sans réseau.
// Stratégie « cache d'abord, mise à jour en arrière-plan » : la page s'ouvre depuis la copie locale,
// puis la dernière version est téléchargée discrètement. Si elle a changé, la page est prévenue
// (« Nouvelle version prête ») ; hors réseau, le téléchargement échoue en silence et rien ne casse.
// Les données (localStorage) ne passent jamais par ici : une mise à jour ne les touche pas.
const CACHE = "stase-v1";
const CORE = ["./", "./index.html"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// empreinte d'une réponse : ETag, sinon date de modification, sinon taille
const tag = r => r && (r.headers.get("etag") || r.headers.get("last-modified") || r.headers.get("content-length"));
// télécharge et met en cache ; prévient les pages ouvertes si le contenu a changé
async function refresh(req, key) {
  const cache = await caches.open(CACHE);
  const res = await fetch(req, { cache: "no-cache" });
  if (!res || !res.ok) return res;
  const old = await cache.match(key);
  const oldTag = tag(old), newTag = tag(res);
  await cache.put(key, res.clone());
  if (old && oldTag && newTag && oldTag !== newTag) {
    const clients = await self.clients.matchAll({ type: "window" });
    clients.forEach(c => c.postMessage({ type: "stase-updated" }));
  }
  return res;
}
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  const nav = req.mode === "navigate";
  const key = nav ? "./index.html" : req;
  e.respondWith((async () => {
    const hit = await caches.match(key, { ignoreSearch: nav });
    const update = refresh(req, key).catch(() => null);
    if (hit) { e.waitUntil(update); return hit; }
    // premier lancement : réseau, avec la copie en cache en dernier recours
    const res = await update;
    return res || (await caches.match("./index.html")) || Response.error();
  })());
});
// la page demande une vérification (ouverture, retour au premier plan) : on revérifie la page principale
self.addEventListener("message", e => {
  if (e.data && e.data.type === "stase-check") e.waitUntil(refresh(new Request("./index.html"), "./index.html").catch(() => null));
});
