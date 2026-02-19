// ===== LocalStorage версия (стабильно для iPhone) =====

const STORAGE_KEY = "ru_tr_words";

// Нормализация для сравнения (Дом = дом)
function norm(s) {
  return (s ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFKC");
}

// Мягкая миграция старых записей в новый формат
function ensureWordShape(w) {
  return {
    id: w.id ?? Date.now() + Math.floor(Math.random() * 1000),
    ru: (w.ru ?? "").toString(),
    tr: (w.tr ?? "").toString(),
    hard: !!w.hard,          // "плохо запоминается"
    w: typeof w.w === "number" ? w.w : 1,   // вес/приоритет
    ok: typeof w.ok === "number" ? w.ok : 0,
    bad: typeof w.bad === "number" ? w.bad : 0,
  };
}

function loadWords() {
  const data = localStorage.getItem(STORAGE_KEY);
  let arr = data ? JSON.parse(data) : [];
  if (!Array.isArray(arr)) arr = [];

  // миграция/нормализация структуры
  const migrated = arr.map(ensureWordShape);

  // Если миграция реально что-то поменяла — сохраним обратно (чтобы дальше всё было однородно)
  // Простая проверка: есть ли у кого-то undefined поля hard/w/ok/bad
  const needsSave = migrated.some(w => w.hard === undefined || w.w === undefined || w.ok === undefined || w.bad === undefined);
  if (needsSave) saveWords(migrated);

  return migrated;
}

function saveWords(words) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(words));
}

function addWord(ru, tr, hardFlag) {
  ru = ru.trim();
  tr = tr.trim();
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

function render() {
  const list = document.getElementById("list");
  const count = document.getElementById("count");

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

const HARD_BOOST = 2.5;

function getRoundWords(count = 10) {
  const words = loadWords();
  if (words.length <= count) return [...words];

  const pool = [...words];
  const result = [];

  while (result.length < count && pool.length > 0) {

    // считаем общий вес
    const totalWeight = pool.reduce((sum, w) => {
      const effective = w.w * (w.hard ? HARD_BOOST : 1);
      return sum + effective;
    }, 0);

    let r = Math.random() * totalWeight;

    for (let i = 0; i < pool.length; i++) {
      const effective = pool[i].w * (pool[i].hard ? HARD_BOOST : 1);
      r -= effective;
      if (r <= 0) {
        result.push(pool[i]);
        pool.splice(i, 1); // без повторов
        break;
      }
    }
  }

  return result;
}

window.onload = function () {
  const ru = document.getElementById("ru");
  const tr = document.getElementById("tr");
  const add = document.getElementById("add");

  // ожидаем чекбокс в HTML: <input type="checkbox" id="hard">
  const hard = document.getElementById("hard");

  // ожидаем кнопку в HTML: <button id="reset">обнулить память приоритета слов</button>
  const reset = document.getElementById("reset");

  add.onclick = () => {
    addWord(ru.value, tr.value, hard ? hard.checked : false);
    ru.value = "";
    tr.value = "";
    if (hard) hard.checked = false;
    ru.focus();
  };

  if (reset) reset.onclick = resetPriorityMemory;

  render();
};
