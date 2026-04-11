'use strict';

// ============================================================
// Pitland – Service Worker (Web Share Target pro nahrávky)
// ============================================================

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

// Zachyť POST request od Web Share Target (sdílení z Diktafonu)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'POST') return;

  const url = new URL(event.request.url);
  if (!url.pathname.endsWith('/nahravky.html')) return;

  event.respondWith(handleShareTarget(event.request));
});

async function handleShareTarget(request) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('file');

    if (audioFile && audioFile.size > 0) {
      await ulozSdilenySoubor(audioFile);
    }
  } catch (err) {
    console.error('[SW] Chyba při zpracování sdíleného souboru:', err);
  }

  // Přesměruj zpět na stránku – query param ?shared=1 říká stránce,
  // aby si přečetla soubor z IndexedDB a předvyplnila formulář
  const redirectUrl = new URL(request.url);
  redirectUrl.search = '?shared=1';
  return Response.redirect(redirectUrl.href, 303);
}

function ulozSdilenySoubor(file) {
  return new Promise((resolve, reject) => {
    const dbReq = indexedDB.open('pitland-share', 1);

    dbReq.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('soubory')) {
        db.createObjectStore('soubory');
      }
    };

    dbReq.onsuccess = (e) => {
      const db = e.target.result;
      const tx = db.transaction('soubory', 'readwrite');
      tx.objectStore('soubory').put(file, 'cekajici');
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = (err) => { db.close(); reject(err); };
    };

    dbReq.onerror = reject;
  });
}
