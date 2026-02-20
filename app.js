// ===== LocalStorage версия (стабильно для iPhone) =====

const STORAGE_KEY = "ru_tr_words";
const DIRECTION_KEY = "ru_tr_direction";

// Параметры весов (зафиксировали)
const HARD_BOOST = 2.5;
const W_MIN = 1;
const W_MAX = 10;
const BAD_STEP = 1.0;
const OK_STEP = 0.25;

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

// Мягкая миграция старых записей в новый формат
function ensureWordShape(w) {
  const id = (w && w.id != null) ? w.id : (Date.now() + Math.floor(Math.random() * 1000));
  const ru = (w && w.ru != null) ? w.ru : "";
  const tr = (w && w.tr != null) ? w.tr : "";

  return {
    id,
    ru: ru.toString(),
    tr: tr.toString(),
    hard: !!(w && w.hard),
    w: (w && typeof w.w === "number") ? w.w : 1,
    ok: (w && typeof w.ok === "number") ? w.ok : 0,
    bad: (w && typeof w.bad === "number") ? w.bad : 0,
  };
}

function saveWords(words) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(words));
}

function loadWords() {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return [];

  let arr;
  try {
    arr = JSON.parse(data);
  } catch (e) {
    console.warn("Bad JSON in storage, resetting words storage:", e);
    localStorage.removeItem(STORAGE_KEY);
    return [];
  }

  if (!Array.isArray(arr)) return [];

  const migrated = arr.map(ensureWordShape);
  // сохраняем миграцию обратно, чтобы структура была стабильной
  saveWords(migrated);

  return migrated;
}

// Направление RU→TR / TR→RU
function loadDirection() {
  return localStorage.getItem(DIRECTION_KEY) || "ru-tr";
}

function saveDirection(val) {
  localStorage.setItem(DIRECTION_KEY, val);
}

function addWord(ru, tr, hardFlag) {
  ru = (ru ?? "").toString().trim();
  tr = (tr ?? "").toString().trim();
  if (!ru || !tr) return;

  const nru = norm(ru);
  const ntr = norm(tr);

  const words = loadWords();

  // дедуп: не добавляем, если уже есть точно такая пара (case-insensitive)
  const exists = words.some(w => norm(w.ru) === nru && norm(w.tr) === ntr);
  if (exists) {
    alert("Такая пара уже есть (Дом=дом).");
    return;
  }

  words.push({
    id: Date.now(),
    ru,
    tr,
    hard: !!hardFlag,
    w: 1,
    ok: 0,
    bad: 0
  });

  saveWords(words);
  render();
}

function deleteWord(id) {
  let words = loadWords();
  words = words.filter(w => w.id !== id);
  saveWords(words);
  render();
}

function toggleHard(id) {
  const words = loadWords();
  const w = words.find(x => x.id === id);
  if (!w) return;
  w.hard = !w.hard;
  saveWords(words);
  render();
}

function resetPriorityMemory() {
  const words = loadWords();
  words.forEach(w => {
    w.w = 1;
    w.ok = 0;
    w.bad = 0;
  });
  saveWords(words);
  alert("Память приоритета слов обнулена.");
  render();
}

// Выбор N слов с учётом веса и hardBoost, без повторов
function getRoundWords(count = 10) {
  const words = loadWords();
  if (words.length <= count) return [...words];

  const pool = [...words];
  const result = [];

  while (result.length < count && pool.length > 0) {
    const totalWeight = pool.reduce((sum, w) => {
      const ww = (typeof w.w === "number" ? w.w : 1);
      const effective = ww * (w.hard ? HARD_BOOST : 1);
      return sum + effective;
    }, 0);

    let r = Math.random() * totalWeight;

    for (let i = 0; i < pool.length; i++) {
      const ww = (typeof pool[i].w === "number" ? pool[i].w : 1);
      const effective = ww * (pool[i].hard ? HARD_BOOST : 1);
      r -= effective;

      if (r <= 0) {
        result.push(pool[i]);
        pool.splice(i, 1);
        break;
      }
    }
  }

  return result;
}

function render() {
  const list = document.getElementById("list");
  const count = document.getElementById("count");
  if (!list || !count) return;

  const words = loadWords();
  list.innerHTML = "";
  count.textContent = words.length;

  words.forEach(w => {
    const row = document.createElement("div");
    row.className = "row";

    const text = document.createElement("div");
    text.className = "row-text";

    const hardMark = w.hard ? " ★" : "";
    text.textContent = `${w.ru} — ${w.tr}${hardMark}`;

    const hardBtn = document.createElement("button");
    hardBtn.className = "btn-small";
    hardBtn.textContent = w.hard ? "Не сложно" : "Плохо запоминается";
    hardBtn.onclick = () => toggleHard(w.id);

    const delBtn = document.createElement("button");
    delBtn.className = "btn-small";
    delBtn.textContent = "Удалить";
    delBtn.onclick = () => deleteWord(w.id);

    row.appendChild(text);
    row.appendChild(hardBtn);
    row.appendChild(delBtn);
    list.appendChild(row);
  });
}

function renderGame() {
  const gameArea = document.getElementById("gameArea");
  if (!gameArea) return;

  const direction = loadDirection();
  const words = getRoundWords(10);

  gameArea.innerHTML = "";

  words.forEach(w => {
    const row = document.createElement("div");
    row.style.padding = "8px";
    row.style.borderBottom = "1px solid #ddd";

    if (direction === "ru-tr") {
      row.textContent = `${w.ru} — ${w.tr}`;
    } else {
      row.textContent = `${w.tr} — ${w.ru}`;
    }

    gameArea.appendChild(row);
  });
}

// Переключение экранов Словарь/Игра
function setActiveTab(tab) {
  const screenDict = document.getElementById("screenDict");
  const screenGame = document.getElementById("screenGame");
  const tabDict = document.getElementById("tabDict");
  const tabGame = document.getElementById("tabGame");

  if (screenDict && screenGame) {
    const isDict = tab === "dict";
    screenDict.style.display = isDict ? "" : "none";
    screenGame.style.display = isDict ? "none" : "";
  }

  if (tabDict && tabGame) {
    tabDict.classList.toggle("active", tab === "dict");
    tabGame.classList.toggle("active", tab === "game");
  }

  if (tab === "dict") render();
  if (tab === "game") renderGame();
}

window.onload = function () {
  const ru = document.getElementById("ru");
  const tr = document.getElementById("tr");
  const add = document.getElementById("add");
  const hard = document.getElementById("hard");
  const reset = document.getElementById("reset");

  // Направление
  const direction = document.getElementById("direction");
  if (direction) {
    direction.value = loadDirection();
    direction.onchange = () => saveDirection(direction.value);
  }

  // Вкладки
  const tabDict = document.getElementById("tabDict");
  const tabGame = document.getElementById("tabGame");

  if (tabDict) tabDict.onclick = () => setActiveTab("dict");
  if (tabGame) tabGame.onclick = () => setActiveTab("game");

  // Добавление
  if (add && ru && tr) {
    add.onclick = () => {
      addWord(ru.value, tr.value, hard ? hard.checked : false);
      ru.value = "";
      tr.value = "";
      if (hard) hard.checked = false;
      ru.focus();
    };
  }

  // Сброс памяти приоритета
  if (reset) reset.onclick = resetPriorityMemory;

  // По умолчанию словарь
  setActiveTab("dict");
};
