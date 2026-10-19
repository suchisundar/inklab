// Persistence: app state in localStorage, photos in IndexedDB (they're too
// big for localStorage). Everything stays on this device.

window.InkStore = (function () {
  const KEY = "inklab:v1";

  const empty = () => ({
    profile: { level: "starting", focus: "linework", minutes: 30 },
    attempts: [],
    questions: [],
    session: null,
    settings: { apiKey: "" },
  });

  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return empty();
      return Object.assign(empty(), JSON.parse(raw));
    } catch (e) {
      return empty();
    }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      console.warn("InkLab: could not save", e);
    }
    pushRemote();
  }

  // --- sync (only when published as a claude.ai Artifact) --------------------
  // Each viewer's journal lives in their own private document, so it follows
  // them across devices. Photos stay in this browser's IndexedDB.
  let remote = null;
  let pushing = Promise.resolve();
  let dirty = false;
  const forRemote = () => JSON.stringify({ ...state, settings: { ...state.settings, apiKey: "" } });

  function pushRemote() {
    if (!remote) return;
    if (dirty) return; // a push is already queued; it will send the latest state
    dirty = true;
    pushing = pushing.then(async () => {
      dirty = false;
      try {
        await remote.set({ json: forRemote(), updated: new Date().toISOString() });
      } catch (e) {
        console.warn("InkLab: sync failed", e);
        if (onSyncError) onSyncError(e);
      }
    });
  }

  let onSyncError = null;
  async function connect(onRemoteLoaded, onError) {
    onSyncError = onError;
    if (!window.claude || !window.claude.use) return false;
    try {
      const [db, user] = await Promise.all([window.claude.use("db"), window.claude.use("user")]);
      const id = user && (await user.id());
      if (!db || !id) return false;
      const ref = db.doc("data/users/" + id + "/inklab");
      const snap = await ref.get();
      remote = ref;
      if (snap.exists && snap.data().json) {
        const key = state.settings.apiKey;
        state = Object.assign(empty(), JSON.parse(snap.data().json));
        state.settings.apiKey = key;
        try {
          localStorage.setItem(KEY, JSON.stringify(state));
        } catch (e) {
          /* ignore */
        }
        onRemoteLoaded();
      } else if (state.attempts.length || state.questions.length) {
        pushRemote();
      }
      return true;
    } catch (e) {
      console.warn("InkLab: sync unavailable", e);
      return false;
    }
  }

  function get() {
    return state;
  }

  function update(fn) {
    fn(state);
    save();
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function reset() {
    state = empty();
    save();
  }

  function replace(next) {
    state = Object.assign(empty(), next);
    save();
  }

  // --- photos (IndexedDB) ---------------------------------------------------
  let dbPromise = null;
  function db() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open("inklab-photos", 1);
        req.onupgradeneeded = () => req.result.createObjectStore("photos");
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbPromise;
  }

  async function putPhoto(id, dataUrl) {
    const d = await db();
    return new Promise((resolve, reject) => {
      const tx = d.transaction("photos", "readwrite");
      tx.objectStore("photos").put(dataUrl, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getPhoto(id) {
    try {
      const d = await db();
      return await new Promise((resolve, reject) => {
        const req = d.transaction("photos").objectStore("photos").get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      return null;
    }
  }

  async function deletePhoto(id) {
    try {
      const d = await db();
      d.transaction("photos", "readwrite").objectStore("photos").delete(id);
    } catch (e) {
      /* ignore */
    }
  }

  // Downscale an uploaded image so it's small enough to store and to send.
  function shrinkImage(file, maxSide = 1280, quality = 0.8) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("Could not read that image."));
        img.onload = () => {
          const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  return { get, update, uid, reset, replace, connect, putPhoto, getPhoto, deletePhoto, shrinkImage };
})();
