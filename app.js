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
    hardBtn.onclick = function () { toggleHard(w.id); };

    const delBtn = document.createElement("button");
    delBtn.className = "btn-small";
    delBtn.textContent = "Удалить";
    delBtn.onclick = function () { deleteWord(w.id); };

    row.appendChild(text);
    row.appendChild(hardBtn);
    row.appendChild(delBtn);
    list.appendChild(row);
  });
}

// Обновление одного слова в storage (по id)
function updateWordInStorage(updatedWord) {
  const all = loadWords();
  const next = all.map(w => (w.id === updatedWord.id ? updatedWord : w));
  saveWords(next);
}

function renderGame() {
  const gameArea = document.getElementById("gameArea");
  if (!gameArea) return;

  const direction = loadDirection();
  const words = getRoundWords(10);

  gameArea.innerHTML = "";

  const container = document.createElement("div");
  container.style.display = "flex";
  container.style.gap = "10px";

  const leftCol = document.createElement("div");
  leftCol.style.flex = "1";

  const rightCol = document.createElement("div");
  rightCol.style.flex = "1";

  // Быстрый доступ к словам по id (это те 10, что в раунде)
  const wordsMap = {};
  words.forEach(w => { wordsMap[w.id] = w; });

  const leftItems = [];
  const rightItems = [];

  words.forEach(w => {
    if (direction === "ru-tr") {
      leftItems.push({ text: w.ru, id: w.id });
      rightItems.push({ text: w.tr, id: w.id });
    } else {
      leftItems.push({ text: w.tr, id: w.id });
      rightItems.push({ text: w.ru, id: w.id });
    }
  });

  rightItems.sort(function () { return Math.random() - 0.5; });

  let selectedLeft = null;
  let selectedRight = null;

  function setCardBaseStyle(el) {
    el.style.background = "#f0f0f0";
  }

  function setCardSelectedStyle(el) {
    el.style.background = "#bbdefb";
  }

  function setCardErrorStyle(el) {
    el.style.background = "#ffcdd2";
  }

  function updateWordStats(word, isCorrect) {
    if (!word) return;

    if (isCorrect) {
      word.ok += 1;
      // ВАЖНО: уменьшаем вес только если он уже увеличен
      if (word.w > W_MIN) {
        word.w = Math.max(W_MIN, word.w - OK_STEP);
      }
    } else {
      word.bad += 1;
      word.w = Math.min(W_MAX, word.w + BAD_STEP);
    }

    updateWordInStorage(word);
  }

  function resetSelection() {
    selectedLeft = null;
    selectedRight = null;
  }

  function checkMatchIfReady() {
    if (!selectedLeft || !selectedRight) return;

    const isCorrect = selectedLeft.id === selectedRight.id;

    if (isCorrect) {
      const word = wordsMap[selectedLeft.id];
      updateWordStats(word, true);

      // удаляем с экрана обе карточки
      selectedLeft.el.remove();
      selectedRight.el.remove();

      resetSelection();

      // если всё решено — автоматически грузим следующий раунд
      // (можно отключить, если пока не надо)
      const leftRemain = leftCol.querySelectorAll("div[data-side='left']").length;
      const rightRemain = rightCol.querySelectorAll("div[data-side='right']").length;
      if (leftRemain === 0 && rightRemain === 0) {
        setTimeout(() => renderGame(), 300);
      }

      return;
    }

    // Ошибка: считаем ошибку по выбранному ЛЕВОМУ слову
    const word = wordsMap[selectedLeft.id];
    updateWordStats(word, false);

    setCardErrorStyle(selectedLeft.el);
    setCardErrorStyle(selectedRight.el);

    setTimeout(function () {
      // сбрасываем стиль обратно, если элементы ещё существуют
      if (selectedLeft && selectedLeft.el && document.body.contains(selectedLeft.el)) {
        setCardBaseStyle(selectedLeft.el);
      }
      if (selectedRight && selectedRight.el && document.body.contains(selectedRight.el)) {
        setCardBaseStyle(selectedRight.el);
      }
      resetSelection();
    }, 500);
  }

  function createCard(item, side) {
    const div = document.createElement("div");
    div.textContent = item.text;
    div.dataset.side = side;
    div.dataset.id = String(item.id);

    div.style.padding = "8px";
    div.style.marginBottom = "6px";
    div.style.background = "#f0f0f0";
    div.style.borderRadius = "8px";
    div.style.cursor = "pointer";
    div.style.userSelect = "none";

    div.onclick = function () {
      // сбрасываем подсветку в своей колонке (чтобы выделение было одно)
      const col = (side === "left") ? leftCol : rightCol;
      Array.from(col.children).forEach(function (el) {
        if (el && el.style) setCardBaseStyle(el);
      });

      setCardSelectedStyle(div);

      if (side === "left") {
        selectedLeft = { id: item.id, el: div };
      } else {
        selectedRight = { id: item.id, el: div };
      }

      checkMatchIfReady();
    };

    return div;
  }

  leftItems.forEach(function (item) {
    leftCol.appendChild(createCard(item, "left"));
  });

  rightItems.forEach(function (item) {
    rightCol.appendChild(createCard(item, "right"));
  });

  container.appendChild(leftCol);
  container.appendChild(rightCol);
  gameArea.appendChild(container);
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
    direction.onchange = function () {
      saveDirection(direction.value);
      // если сейчас на экране игра — перерендерим
      const screenGame = document.getElementById("screenGame");
      if (screenGame && screenGame.style.display !== "none") {
        renderGame();
      }
    };
  }

  // Вкладки
  const tabDict = document.getElementById("tabDict");
  const tabGame = document.getElementById("tabGame");
  if (tabDict) tabDict.onclick = function () { setActiveTab("dict"); };
  if (tabGame) tabGame.onclick = function () { setActiveTab("game"); };

  // Добавление
  if (add && ru && tr) {
    add.onclick = function () {
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
