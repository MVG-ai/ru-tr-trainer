// RU-TR Trainer — база слов (IndexedDB) + список слов (минимальный MVP)
alert("app.js loaded");

const DB_NAME = "ru_tr_trainer";
const DB_VERSION = 1;
const STORE = "words";

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const st = db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
        st.createIndex("ru_lc", "ru_lc", { unique: false });
        st.createIndex("tr_lc", "tr_lc", { unique: false });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function norm(s) { return (s ?? "").trim(); }
function lc(s) { return norm(s).toLowerCase(); }

async function addWord(db, ru, tr) {
  ru = norm(ru); tr = norm(tr);
  if (!ru || !tr) return;

  const tx = db.transaction(STORE, "readwrite");
  const st = tx.objectStore(STORE);

  await new Promise((resolve, reject) => {
    const req = st.add({ ru, tr, ru_lc: lc(ru), tr_lc: lc(tr), hard: false, weight: 0 });
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

async function getAll(db) {
  const tx = db.transaction(STORE, "readonly");
  const st = tx.objectStore(STORE);
  return await new Promise((resolve, reject) => {
    const req = st.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function delWord(db, id) {
  const tx = db.transaction(STORE, "readwrite");
  const st = tx.objectStore(STORE);
  await new Promise((resolve, reject) => {
    const req = st.delete(id);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

// UI
let db = null;

function renderList(words) {
  const list = document.getElementById("list");
  list.innerHTML = "";

  for (const w of words) {
    const row = document.createElement("div");
    row.className = "row";

    const txt = document.createElement("div");
    txt.className = "row-text";
    txt.textContent = `${w.ru} — ${w.tr}`;

    const del = document.createElement("button");
    del.className = "btn-small";
    del.textContent = "Удалить";
    del.onclick = async () => {
      await delWord(db, w.id);
      refresh();
    };

    row.appendChild(txt);
    row.appendChild(del);
    list.appendChild(row);
  }
}

async function refresh() {
  const words = await getAll(db);
  renderList(words);
  document.getElementById("count").textContent = words.length;
}

async function main() {
  db = await openDb();

  const ru = document.getElementById("ru");
  const tr = document.getElementById("tr");
  const add = document.getElementById("add");

  add.onclick = async () => {
    await addWord(db, ru.value, tr.value);
    ru.value = "";
    tr.value = "";
    ru.focus();
    refresh();
  };

  refresh();
}

main().catch(() => alert("Ошибка IndexedDB (попробуй обновить страницу)"));
