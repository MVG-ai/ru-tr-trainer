// ===== LocalStorage версия (стабильно для iPhone) =====
const STORAGE_KEY = "ru_tr_words";
const DIRECTION_KEY = "ru_tr_direction";

// Параметры весов (зафиксировали)
const HARD_BOOST = 2.5;
const W_MIN = 1;
const W_MAX = 10;
const BAD_STEP = 1.0;
const OK_STEP = 0.25;

// UI feedback
const FEEDBACK_MS = 500;

// Нормализация для сравнения (Дом = дом)
function norm(s) {
  try {
    return (s ?? "")
      .toString()
      .trim()
      .toLowerCase()
      .normalize("NFKC");
  } catch {
    return (s ?? "").toString().trim().toLowerCase();
  }
}

// ===== Мягкая миграция/нормализация записи слова =====
function ensureWord(raw) {
  if (!raw || typeof raw !== "object") return null;

  const ru = (raw.ru ?? raw.Ru ?? raw.RU ?? raw.r ?? raw.R ?? "").toString();
  const tr = (raw.tr ?? raw.Tr ?? raw.TR ?? raw.t ?? raw.T ?? "").toString();

  const w = Number.isFinite(+raw.w) ? +raw.w : W_MIN;
  const bad = Number.isFinite(+raw.bad) ? +raw.bad : 0;
  const ok = Number.isFinite(+raw.ok) ? +raw.ok : 0;

  const hard =
    raw.hard === true ||
    raw.hard === 1 ||
    raw.hard === "1" ||
    raw.Hard === 1 ||
    raw.Hard === "1" ||
    raw.HARD === 1 ||
    raw.HARD === "1";

  const id = (raw.id ?? raw._id ?? "").toString().trim() || cryptoId();

  const clean = {
    id,
    ru: ru.trim(),
    tr: tr.trim(),
    hard,
    w: clamp(w, W_MIN, W_MAX),
    bad: Math.max(0, Math.floor(bad)),
    ok: Math.max(0, Math.floor(ok)),
  };

  if (!clean.ru || !clean.tr) return null;
  return clean;
}

function cryptoId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "id_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
}

function clamp(x, a, b) {
  return Math.max(a, Math.min(b, x));
}

// ===== Storage =====
function loadWords() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    const out = [];
    for (const item of arr) {
      const w = ensureWord(item);
      if (w) out.push(w);
    }
    saveWords(out); // мягкая миграция
    return out;
  } catch {
    return [];
  }
}

function saveWords(words) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(words));
}

function getDirection() {
  const d = localStorage.getItem(DIRECTION_KEY);
  return d === "tr-ru" ? "tr-ru" : "ru-tr";
}

function setDirection(d) {
  localStorage.setItem(DIRECTION_KEY, d === "tr-ru" ? "tr-ru" : "ru-tr");
}

// ===== Dictionary ops =====
function addWord(ru, tr, hard) {
  const words = loadWords();

  const newRec = ensureWord({
    id: cryptoId(),
    ru,
    tr,
    hard: !!hard,
    w: W_MIN,
    bad: 0,
    ok: 0,
  });
  if (!newRec) return { ok: false, reason: "empty" };

  const keyNew = norm(newRec.ru) + "||" + norm(newRec.tr);
  for (const w of words) {
    const keyOld = norm(w.ru) + "||" + norm(w.tr);
    if (keyOld === keyNew) return { ok: false, reason: "dup" };
  }

  words.unshift(newRec);
  saveWords(words);
  return { ok: true };
}

function deleteWordById(id) {
  const words = loadWords().filter(w => w.id !== id);
  saveWords(words);
}

function toggleHardById(id) {
  const words = loadWords();
  const w = words.find(x => x.id === id);
  if (!w) return;
  w.hard = !w.hard;
  saveWords(words);
}

function resetPriorityMemory() {
  const words = loadWords();
  for (const w of words) {
    w.w = W_MIN;
    w.bad = 0;
    w.ok = 0;
  }
  saveWords(words);
}

// ===== CSV EXPORT (Ru,Tr,Hard) =====
function csvEscape(v) {
  const s = (v ?? "").toString();
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function exportWordsCsv() {
  const words = loadWords();

  let csv = "\uFEFFRu,Tr,Hard\n";
  for (const w of words) {
    const hard = w.hard ? "1" : "0";
    csv += `${csvEscape(w.ru)},${csvEscape(w.tr)},${hard}\n`;
  }

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const filename = `ru-tr-words_${yyyy}-${mm}-${dd}.csv`;

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

// ===== CSV IMPORT (Ru,Tr,Hard) =====
function detectDelimiter(headerLine) {
  const commas = (headerLine.match(/,/g) || []).length;
  const semis = (headerLine.match(/;/g) || []).length;
  return semis > commas ? ";" : ",";
}

function parseCSV(text, delimiter) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') { cur += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cur += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === delimiter) { row.push(cur); cur = ""; }
      else if (ch === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
      else if (ch === "\r") { /* ignore */ }
      else cur += ch;
    }
  }
  row.push(cur);
  rows.push(row);

  return rows.filter(r => r.some(cell => (cell ?? "").toString().trim() !== ""));
}

function normalizeHeader(h) {
  return (h ?? "").toString().trim().toLowerCase();
}

function hardToBool(v) {
  const s = (v ?? "").toString().trim();
  if (!s) return false;
  return s === "1";
}

function importWordsFromCsvText(csvText, mode /* "merge" | "replace" */) {
  const text = (csvText ?? "").toString().replace(/^\uFEFF/, "");
  const firstLine = text.split(/\r?\n/).find(l => l.trim() !== "") ?? "";
  const delimiter = detectDelimiter(firstLine);

  const rows = parseCSV(text, delimiter);
  if (!rows.length) return { ok: false, reason: "empty_file" };

  const header = rows[0].map(normalizeHeader);

  const idxRu = header.findIndex(h => h === "ru");
  const idxTr = header.findIndex(h => h === "tr");
  const idxHard = header.findIndex(h => h === "hard");

  if (idxRu === -1 || idxTr === -1) return { ok: false, reason: "bad_header" };

  const imported = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const ru = (r[idxRu] ?? "").toString().trim();
    const tr = (r[idxTr] ?? "").toString().trim();
    if (!ru || !tr) continue;

    const hard = idxHard === -1 ? false : hardToBool(r[idxHard]);

    const w = ensureWord({
      id: cryptoId(),
      ru,
      tr,
      hard,
      w: W_MIN,
      bad: 0,
      ok: 0,
    });
    if (w) imported.push(w);
  }

  const seen = new Set();
  const importedUniq = [];
  for (const w of imported) {
    const key = norm(w.ru) + "||" + norm(w.tr);
    if (seen.has(key)) continue;
    seen.add(key);
    importedUniq.push(w);
  }

  if (mode === "replace") {
    saveWords(importedUniq);
    return { ok: true, added: importedUniq.length, mode: "replace" };
  }

  const current = loadWords();
  const currentKeys = new Set(current.map(w => norm(w.ru) + "||" + norm(w.tr)));

  const toAdd = [];
  for (const w of importedUniq) {
    const key = norm(w.ru) + "||" + norm(w.tr);
    if (currentKeys.has(key)) continue;
    toAdd.push(w);
  }

  saveWords([...toAdd, ...current]);
  return { ok: true, added: toAdd.length, mode: "merge" };
}

async function handleImportCsvFile(file) {
  if (!file) return;

  const text = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read_error"));
    reader.onload = () => resolve(reader.result);
    reader.readAsText(file);
  }).catch(() => null);

  if (typeof text !== "string") {
    alert("Не удалось прочитать файл CSV.");
    return;
  }

  const replace = confirm(
    "Заменить текущую базу полностью?\n\nOK = заменить\nОтмена = добавить к текущей (без дублей)"
  );

  const res = importWordsFromCsvText(text, replace ? "replace" : "merge");
  if (!res.ok) {
    if (res.reason === "bad_header") {
      alert('CSV не распознан. Нужны заголовки: Ru, Tr (Hard опционально). Регистр не важен.');
    } else if (res.reason === "empty_file") {
      alert("CSV файл пустой.");
    } else {
      alert("Ошибка импорта CSV.");
    }
    return;
  }

  renderDict();
  const screenGame = document.getElementById("screenGame");
  if (screenGame && screenGame.style.display !== "none") startRound();

  alert(`Импорт завершён. Добавлено: ${res.added}. Режим: ${res.mode === "replace" ? "замена" : "добавление"}.`);
}

// ===== UI: render dictionary =====
function renderDict() {
  const listEl = document.getElementById("list");
  const countEl = document.getElementById("count");
  if (!listEl || !countEl) return;

  const words = loadWords();
  countEl.textContent = String(words.length);
  listEl.innerHTML = "";

  if (!words.length) {
    listEl.innerHTML = `<div style="opacity:.7;">Пока пусто. Добавь слова.</div>`;
    return;
  }

  for (const w of words) {
    const row = document.createElement("div");
    row.className = "row";

    const hardMark = w.hard ? "✅" : "⬜️";

    // ТЕХНИЧЕСКУЮ СТРОКУ (w/bad/ok) УБРАЛИ
    row.innerHTML = `
      <div style="display:flex; gap:10px; align-items:center; justify-content:space-between;">
        <div style="flex:1;">
          <div><b>${escapeHtml(w.ru)}</b> — ${escapeHtml(w.tr)}</div>
        </div>

        <button data-act="hard" data-id="${w.id}" title="hard">${hardMark}</button>
        <button data-act="del" data-id="${w.id}" title="delete">🗑️</button>
      </div>
    `;

    listEl.appendChild(row);
  }

  listEl.querySelectorAll("button[data-act]").forEach(btn => {
    btn.addEventListener("click", () => {
      const act = btn.getAttribute("data-act");
      const id = btn.getAttribute("data-id");
      if (!id) return;
      if (act === "del") deleteWordById(id);
      if (act === "hard") toggleHardById(id);
      renderDict();
    });
  });
}

function escapeHtml(s) {
  return (s ?? "")
    .toString()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ===== GAME (плитки + подсветка 0.5s) =====
let roundPairs = [];
let leftPool = [];
let rightPool = [];
let pickedLeft = null;
let pickedRight = null;

let feedback = null; // { type: "ok"|"bad", leftId, rightId }
let inputLocked = false;

function effectiveWeight(w) {
  const base = Number.isFinite(+w.w) ? +w.w : W_MIN;
  return base * (w.hard ? HARD_BOOST : 1);
}

function weightedSampleWithoutReplacement(items, k) {
  const pool = items.slice();
  const picked = [];

  while (pool.length && picked.length < k) {
    let total = 0;
    for (const x of pool) total += effectiveWeight(x);

    if (total <= 0) {
      picked.push(pool.shift());
      continue;
    }

    let r = Math.random() * total;
    let idx = 0;
    for (; idx < pool.length; idx++) {
      r -= effectiveWeight(pool[idx]);
      if (r <= 0) break;
    }
    if (idx >= pool.length) idx = pool.length - 1;

    picked.push(pool[idx]);
    pool.splice(idx, 1);
  }

  return picked;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function startRound() {
  const words = loadWords();
  const gameArea = document.getElementById("gameArea");
  if (!gameArea) return;

  pickedLeft = null;
  pickedRight = null;
  feedback = null;
  inputLocked = false;

  if (words.length < 2) {
    gameArea.innerHTML = `<div style="opacity:.7;">Нужно хотя бы 2 слова в базе.</div>`;
    return;
  }

  const d = getDirection();
  const n = Math.min(10, words.length);
  const chosen = weightedSampleWithoutReplacement(words, n);

  roundPairs = chosen.map(w => {
    if (d === "ru-tr") return { id: w.id, left: w.ru, right: w.tr };
    return { id: w.id, left: w.tr, right: w.ru };
  });

  leftPool = roundPairs.map(p => ({ id: p.id, text: p.left }));
  rightPool = roundPairs.map(p => ({ id: p.id, text: p.right }));

  shuffle(leftPool);
  shuffle(rightPool);

  renderGame();
}

function tileStyle(state) {
  const base =
    "user-select:none; -webkit-user-select:none; " +
    "padding:12px 12px; border-radius:12px; " +
    "border:1px solid rgba(0,0,0,0.12); " +
    "background:#ffffff; " +
    "margin:10px 0; " +
    "box-shadow:0 1px 2px rgba(0,0,0,0.06); " +
    "cursor:pointer; " +
    "transition:background 120ms ease, transform 80ms ease, border-color 120ms ease; " +
    "font-size:18px; line-height:1.2;";

  if (state === "active") {
    return base + "border-color: rgba(21,101,192,0.8); transform: scale(0.99);";
  }
  if (state === "ok") {
    return base + "background: rgba(46,125,50,0.18); border-color: rgba(46,125,50,0.55);";
  }
  if (state === "bad") {
    return base + "background: rgba(229,57,53,0.18); border-color: rgba(229,57,53,0.55);";
  }
  return base;
}

function renderGame() {
  const gameArea = document.getElementById("gameArea");
  if (!gameArea) return;

  const colsStyle = "display:flex; gap:14px; align-items:flex-start;";
  const colStyle = "flex:1;";

  const leftHtml = leftPool.map(x => {
    let state = "normal";
    if (pickedLeft?.id === x.id) state = "active";
    if (feedback && feedback.leftId === x.id) state = feedback.type === "ok" ? "ok" : "bad";
    return `<div style="${tileStyle(state)}" data-side="L" data-id="${x.id}">${escapeHtml(x.text)}</div>`;
  }).join("");

  const rightHtml = rightPool.map(x => {
    let state = "normal";
    if (pickedRight?.id === x.id) state = "active";
    if (feedback && feedback.rightId === x.id) state = feedback.type === "ok" ? "ok" : "bad";
    return `<div style="${tileStyle(state)}" data-side="R" data-id="${x.id}">${escapeHtml(x.text)}</div>`;
  }).join("");

  gameArea.innerHTML = `
    <div style="${colsStyle}">
      <div style="${colStyle}">${leftHtml}</div>
      <div style="${colStyle}">${rightHtml}</div>
    </div>
  `;

  gameArea.querySelectorAll("[data-side][data-id]").forEach(el => {
    el.addEventListener("click", () => onPick(el));
  });
}

function onPick(el) {
  if (inputLocked) return;

  const side = el.getAttribute("data-side");
  const id = el.getAttribute("data-id");
  if (!id) return;

  if (feedback) return;

  if (side === "L") pickedLeft = leftPool.find(x => x.id === id) || null;
  if (side === "R") pickedRight = rightPool.find(x => x.id === id) || null;

  renderGame();

  if (pickedLeft && pickedRight) {
    inputLocked = true;

    if (pickedLeft.id === pickedRight.id) {
      applyOk(pickedLeft.id);

      feedback = { type: "ok", leftId: pickedLeft.id, rightId: pickedRight.id };
      renderGame();

      const pairId = pickedLeft.id;
      setTimeout(() => {
        leftPool = leftPool.filter(x => x.id !== pairId);
        rightPool = rightPool.filter(x => x.id !== pairId);

        pickedLeft = null;
        pickedRight = null;
        feedback = null;
        inputLocked = false;

        renderGame();

        if (leftPool.length === 0) startRound();
      }, FEEDBACK_MS);

    } else {
      applyBad(pickedLeft.id);
      applyBad(pickedRight.id);

      feedback = { type: "bad", leftId: pickedLeft.id, rightId: pickedRight.id };
      renderGame();

      setTimeout(() => {
        pickedLeft = null;
        pickedRight = null;
        feedback = null;
        inputLocked = false;
        renderGame();
      }, FEEDBACK_MS);
    }
  }
}

function applyBad(id) {
  const words = loadWords();
  const w = words.find(x => x.id === id);
  if (!w) return;

  w.bad = (w.bad ?? 0) + 1;
  w.w = clamp((w.w ?? W_MIN) + BAD_STEP, W_MIN, W_MAX);

  saveWords(words);
}

function applyOk(id) {
  const words = loadWords();
  const w = words.find(x => x.id === id);
  if (!w) return;

  w.ok = (w.ok ?? 0) + 1;

  if ((w.w ?? W_MIN) > W_MIN) {
    w.w = clamp((w.w ?? W_MIN) - OK_STEP, W_MIN, W_MAX);
  }

  saveWords(words);
}

// ===== Tabs =====
function showScreen(name) {
  const screenDict = document.getElementById("screenDict");
  const screenGame = document.getElementById("screenGame");
  const tabDict = document.getElementById("tabDict");
  const tabGame = document.getElementById("tabGame");

  if (!screenDict || !screenGame || !tabDict || !tabGame) return;

  if (name === "dict") {
    screenDict.style.display = "";
    screenGame.style.display = "none";
    tabDict.classList.add("active");
    tabGame.classList.remove("active");
    renderDict();
  } else {
    screenDict.style.display = "none";
    screenGame.style.display = "";
    tabDict.classList.remove("active");
    tabGame.classList.add("active");
    startRound();
  }
}

// ===== init =====
window.addEventListener("load", () => {
  const dirSel = document.getElementById("direction");
  if (dirSel) {
    dirSel.value = getDirection();
    dirSel.addEventListener("change", () => {
      setDirection(dirSel.value);
      const screenGame = document.getElementById("screenGame");
      if (screenGame && screenGame.style.display !== "none") startRound();
    });
  }

  document.getElementById("tabDict")?.addEventListener("click", () => showScreen("dict"));
  document.getElementById("tabGame")?.addEventListener("click", () => showScreen("game"));

  document.getElementById("add")?.addEventListener("click", () => {
    const ru = document.getElementById("ru")?.value ?? "";
    const tr = document.getElementById("tr")?.value ?? "";
    const hard = !!document.getElementById("hard")?.checked;

    const res = addWord(ru, tr, hard);
    if (res.ok) {
      document.getElementById("ru").value = "";
      document.getElementById("tr").value = "";
      document.getElementById("hard").checked = false;
    }
    renderDict();
  });

  document.getElementById("reset")?.addEventListener("click", () => {
    resetPriorityMemory();
    renderDict();
  });

  document.getElementById("exportCsv")?.addEventListener("click", () => {
    exportWordsCsv();
  });

  const importBtn = document.getElementById("importCsv");
  const importInput = document.getElementById("importCsvInput");
  if (importBtn && importInput) {
    importBtn.addEventListener("click", () => {
      importInput.value = "";
      importInput.click();
    });
    importInput.addEventListener("change", async () => {
      const file = importInput.files && importInput.files[0];
      if (!file) return;
      await handleImportCsvFile(file);
      importInput.value = "";
    });
  }

  document.getElementById("nextRound")?.addEventListener("click", () => {
    startRound();
  });

  renderDict();
  showScreen("dict");
});
