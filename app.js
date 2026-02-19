alert("app.js loaded");

// ===== LocalStorage версия (стабильно для iPhone) =====

const STORAGE_KEY = "ru_tr_words";

function loadWords() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
}

function saveWords(words) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(words));
}

function addWord(ru, tr) {
    ru = ru.trim();
    tr = tr.trim();
    if (!ru || !tr) return;

    const words = loadWords();
    words.push({
        id: Date.now(),
        ru,
        tr
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
        text.textContent = w.ru + " — " + w.tr;

        const btn = document.createElement("button");
        btn.className = "btn-small";
        btn.textContent = "Удалить";
        btn.onclick = () => deleteWord(w.id);

        row.appendChild(text);
        row.appendChild(btn);
        list.appendChild(row);
    });
}

window.onload = function () {
    const ru = document.getElementById("ru");
    const tr = document.getElementById("tr");
    const add = document.getElementById("add");

    add.onclick = () => {
        addWord(ru.value, tr.value);
        ru.value = "";
        tr.value = "";
        ru.focus();
    };

    render();
};
