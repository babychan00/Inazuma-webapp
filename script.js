/* script.js - アイコンを枠に合わせてアスペクト比を保ったまま描画（cover）する版（全文） */

const STORAGE_KEY = "players_v2";
const PAGES_KEY = "pages_v2";
const CUR_PAGE_KEY = "current_page_v2";
const MAX_PAGES = 10;

/* 初期データ（最初だけ） */
if (!localStorage.getItem(STORAGE_KEY)) {
  const now = Date.now();
  const defaultPlayers = [
    {
      id: now,
      name: "えんどう",
      position: "FW",
      gender: "男",
      attribute: "山",
      pageId: null,
      icon: "",
      baseStats: { GP: 191, TP: 184, Kick: 72, Body: 72, Control: 70, Guard: 77, Speed: 68, Stamina: 69, Guts: 79, Free: 35 },
      trainedStats: { GP: 241, TP: 234, Kick: 122, Body: 122, Control: 1, Guard: 127, Speed: 118, Stamina: 1, Guts: 51 },
      skills: ["ゴッドハンド", "マジン・ザ・ハンド", "せいぎのてっけん", "ジ・アース"],
      extraSkills: ["超技", "ボディシールド"],
      memo: "FW育成。\nスピード強化予定。",
      images: []
    },
    {
      id: now + 1,
      name: "ごうえんじ",
      position: "FW",
      gender: "男",
      attribute: "火",
      pageId: null,
      icon: "",
      baseStats: { GP: 200, TP: 176, Kick: 79, Body: 66, Control: 76, Guard: 64, Speed: 72, Stamina: 68, Guts: 60, Free: 20 },
      trainedStats: { GP: 241, TP: 234, Kick: 122, Body: 122, Control: 1, Guard: 127, Speed: 118, Stamina: 1, Guts: 51 },
      skills: ["ファイアトルネード", "ヒートタックル", "イナズマおとし", "ばくねつストーム"],
      extraSkills: ["超技", "マッドエクスプレス"],
      memo: "ボディ強化予定。",
      images: []
    }
  ];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultPlayers));
}

/* DOM */
const playerList = document.getElementById("player-list");
const modal = document.getElementById("modal");
const modalTitle = document.getElementById("modal-title");
const closeModalBtn = document.getElementById("close-modal");
const addBtn = document.getElementById("add-player-btn");
const addPageBtn = document.getElementById("add-page-btn");
const pagesContainer = document.getElementById("pages-container");
const editForm = document.getElementById("edit-form");
const deleteBtn = document.getElementById("delete-btn");
const imagesInput = document.getElementById("edit-images-input");
const imagesPreview = document.getElementById("edit-images-preview");
const iconInput = document.getElementById("edit-icon-input");
const iconPreview = document.getElementById("edit-icon-preview");
const exportBtn = document.getElementById("export-image-btn");

/* Lightbox */
const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightbox-img");
const lightboxClose = document.getElementById("lightbox-close");

/* modal totals and category elements */
const baseTotalEl = () => document.getElementById("base-total");
const trainedTotalEl = () => document.getElementById("trained-total");
const catAEl = () => document.getElementById("cat-a");
const catBEl = () => document.getElementById("cat-b");
const catCEl = () => document.getElementById("cat-c");

/* in-memory images */
let currentImages = [];
let currentIcon = ""; // DataURL or empty

/* drag state */
let draggedId = null;

/* ---------- pages handling ---------- */
function getPagesRaw() {
  try { return JSON.parse(localStorage.getItem(PAGES_KEY)) || []; }
  catch (e) { console.error(e); return []; }
}
function savePages(arr) { localStorage.setItem(PAGES_KEY, JSON.stringify(arr)); }

/* ensure at least one page exists; create default if none */
function ensurePagesExist() {
  let pages = getPagesRaw();
  if (!pages || pages.length === 0) {
    const defaultPage = { id: Date.now(), name: "Page 1" };
    pages = [defaultPage];
    savePages(pages);
    localStorage.setItem(CUR_PAGE_KEY, String(defaultPage.id));
  } else {
    const cur = localStorage.getItem(CUR_PAGE_KEY);
    if (!cur || !pages.some(p => String(p.id) === String(cur))) {
      localStorage.setItem(CUR_PAGE_KEY, String(pages[0].id));
    }
  }
  return getPagesRaw();
}

function getCurrentPageId() {
  ensurePagesExist();
  return String(localStorage.getItem(CUR_PAGE_KEY) || (getPagesRaw()[0] && String(getPagesRaw()[0].id)));
}

function setCurrentPageId(id) {
  localStorage.setItem(CUR_PAGE_KEY, String(id));
  renderPages();
  renderPlayers();
}

/* create a new page (name provided) */
function createPage(name) {
  const pages = getPagesRaw();
  if (pages.length >= MAX_PAGES) return false;
  const newPage = { id: Date.now(), name: name || (`Page ${pages.length + 1}`) };
  pages.push(newPage);
  savePages(pages);
  setCurrentPageId(newPage.id);
  return true;
}

/* rename page */
function renamePage(id, newName) {
  const pages = getPagesRaw();
  const idx = pages.findIndex(p => String(p.id) === String(id));
  if (idx === -1) return false;
  pages[idx].name = newName || pages[idx].name;
  savePages(pages);
  renderPages();
  return true;
}

/* delete page: move players to first remaining page */
function deletePage(id) {
  let pages = getPagesRaw();
  if (pages.length <= 1) return false;
  const idx = pages.findIndex(p => String(p.id) === String(id));
  if (idx === -1) return false;

  pages.splice(idx, 1);
  savePages(pages);

  const targetPageId = pages[0].id;
  const players = getPlayersRaw();
  let changed = false;
  players.forEach(pl => {
    if (String(pl.pageId) === String(id)) {
      pl.pageId = targetPageId;
      changed = true;
    }
  });
  if (changed) savePlayers(players);

  const cur = getCurrentPageId();
  if (String(cur) === String(id)) {
    setCurrentPageId(targetPageId);
  } else {
    renderPages();
    renderPlayers();
  }
  return true;
}

/* render page tabs */
function renderPages() {
  ensurePagesExist();
  const pages = getPagesRaw();
  const cur = getCurrentPageId();
  pagesContainer.innerHTML = "";
  pages.forEach(p => {
    const btn = document.createElement("button");
    btn.className = "page-tab" + (String(p.id) === String(cur) ? " active" : "");
    btn.dataset.id = p.id;
    btn.title = p.name;
    btn.innerHTML = `<span class="page-name">${escapeHtml(p.name)}</span>
      <span class="page-actions">
        <button class="page-edit-btn" data-id="${p.id}" title="名前変更">✎</button>
        <button class="page-del-btn" data-id="${p.id}" title="削除">🗑</button>
      </span>`;
    btn.addEventListener("click", (e) => {
      if (e.target.closest(".page-actions")) return;
      setCurrentPageId(p.id);
    });
    pagesContainer.appendChild(btn);
  });

  pagesContainer.querySelectorAll(".page-edit-btn").forEach(b => {
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = b.dataset.id;
      const pages = getPagesRaw();
      const pg = pages.find(x => String(x.id) === String(id));
      const newName = prompt("ページ名を入力してください。", pg ? pg.name : "");
      if (newName === null) return;
      if (newName.trim() === "") {
        alert("ページ名は空にできません。");
        return;
      }
      renamePage(id, newName.trim());
    });
  });
  pagesContainer.querySelectorAll(".page-del-btn").forEach(b => {
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = b.dataset.id;
      const pages = getPagesRaw();
      if (pages.length <= 1) { alert("ページは最低1つ必要です。"); return; }
      if (!confirm("このページを削除しますか？（該当選手は先頭ページに移動されます）")) return;
      deletePage(id);
    });
  });

  const pagesCount = pages.length;
  if (addPageBtn) addPageBtn.disabled = (pagesCount >= MAX_PAGES);
}

/* ---------- players handling ---------- */
function getPlayersRaw() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch (e) { console.error(e); return []; }
}
function savePlayers(arr) { localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); }

function normalizePlayers() {
  const arr = getPlayersRaw();
  let changed = false;
  const pages = getPagesRaw();
  const defaultPageId = pages && pages[0] ? pages[0].id : null;

  const normalized = arr.map(p => {
    if (typeof p.gender !== "string") { p.gender = ""; changed = true; }
    if (typeof p.attribute !== "string") { p.attribute = ""; changed = true; }
    if (typeof p.icon !== "string") { p.icon = ""; changed = true; }

    if (typeof p.pageId === "undefined" || p.pageId === null) { p.pageId = defaultPageId; changed = true; }

    if (!p.baseStats || typeof p.baseStats !== "object") {
      p.baseStats = p.stats && typeof p.stats === "object"
        ? { GP: p.stats.GP||0, TP: p.stats.TP||0, Kick: p.stats.Kick||0, Body: p.stats.Body||0, Control: p.stats.Control||0, Guard: p.stats.Guard||0, Speed: p.stats.Speed||0, Stamina: p.stats.Stamina||0, Guts: p.stats.Guts||0, Free: p.stats.Free||0 }
        : { GP:0, TP:0, Kick:0, Body:0, Control:0, Guard:0, Speed:0, Stamina:0, Guts:0, Free:0 };
      changed = true;
    }
    if (!p.trainedStats || typeof p.trainedStats !== "object") {
      p.trainedStats = { GP:0, TP:0, Kick:0, Body:0, Control:0, Guard:0, Speed:0, Stamina:0, Guts:0 };
      changed = true;
    }
    if (!Array.isArray(p.skills)) { p.skills = ["","","",""]; changed = true; }
    else { p.skills = p.skills.slice(0,4); while (p.skills.length < 4) p.skills.push(""); }
    if (!Array.isArray(p.extraSkills)) { p.extraSkills = ["",""]; changed = true; }
    else { p.extraSkills = p.extraSkills.slice(0,2); while (p.extraSkills.length < 2) p.extraSkills.push(""); }
    if (typeof p.memo !== "string") { p.memo = ""; changed = true; }
    if (!Array.isArray(p.images)) { p.images = []; changed = true; }
    if (typeof p.position !== "string") { p.position = ""; changed = true; }
    return p;
  });
  if (changed) savePlayers(normalized);
  return normalized;
}
function getPlayers() { ensurePagesExist(); return normalizePlayers(); }

/* utility sums */
function sumStatsExcludeGP_TP(obj, includeFree = false) {
  if (!obj || typeof obj !== "object") return 0;
  const keys = ["Kick","Body","Control","Guard","Speed","Stamina","Guts"];
  if (includeFree) keys.push("Free");
  return keys.reduce((a,k)=>a + (parseInt(obj[k])||0), 0);
}
function sumCategoryTrained(trained) {
  const t = trained || {};
  const A = (parseInt(t.Kick)||0) + (parseInt(t.Control)||0);
  const B = (parseInt(t.Body)||0) + (parseInt(t.Guard)||0) + (parseInt(t.Guts)||0);
  const C = (parseInt(t.Speed)||0) + (parseInt(t.Stamina)||0);
  return { A, B, C };
}

/* render players for current page only */
function renderPlayers() {
  const players = getPlayers();
  const curPageId = getCurrentPageId();
  playerList.innerHTML = "";

  const filtered = players.filter(p => String(p.pageId) === String(curPageId));
  filtered.forEach((p) => {
    const card = document.createElement("div");
    card.className = "player-card";
    card.dataset.id = p.id;
    card.setAttribute("draggable", "true");

    const trained = p.trainedStats || {};

    // show trained values only
    const show = {};
    ["GP","TP","Kick","Body","Control","Guard","Speed","Stamina","Guts"].forEach(k => {
      show[k] = parseInt(trained[k]) || 0;
    });

    const initials = (p.name || "").slice(0, 2);

    const statOrder = [
      {key: "GP", label: "GP", cls: "stat-black"},
      {key: "TP", label: "TP", cls: "stat-black"},
      {key: "Kick", label: "キック", cls: "stat-red"},
      {key: "Body", label: "ボディ", cls: "stat-blue"},
      {key: "Control", label: "コントロール", cls: "stat-red"},
      {key: "Guard", label: "ガード", cls: "stat-blue"},
      {key: "Speed", label: "スピード", cls: "stat-green"},
      {key: "Stamina", label: "スタミナ", cls: "stat-green"},
      {key: "Guts", label: "ガッツ", cls: "stat-blue"},
    ];
    const statsHtml = statOrder.map(s => `<div class="stat"><span class="label ${s.cls}">${s.label}</span><span class="value">${escapeHtml(String(show[s.key]||0))}</span></div>`).join("");

    // trained sum (exclude GP/TP)
    const displayTotal = sumStatsExcludeGP_TP(trained, false);

    // extraSkills only
    const extraBadges = (p.extraSkills || []).filter(s => s).slice(0,2).map(s => `<span class="badge">${escapeHtml(s)}</span>`).join("");

    // silhouette / icon
    const iconHtml = p.icon ? `<div class="silhouette" aria-hidden="true"><img src="${p.icon}" alt="icon"></div>` : `<div class="silhouette" aria-hidden="true">${escapeHtml(initials)}</div>`;

    card.innerHTML = `
      <div class="card-header">
        ${iconHtml}
      </div>
      <div>
        <p class="player-name">${escapeHtml(p.name || "無名")}</p>
        <p class="player-sub">${escapeHtml(p.position || "")}</p>
      </div>

      <div class="card-trained-stats">
        ${statsHtml}
      </div>

      <div class="card-total">
        <div>合計（GP/TP除く）</div>
        <div>${displayTotal}</div>
      </div>

      <div class="skill-badges">${extraBadges}</div>
    `;

    /* drag handlers */
    card.addEventListener("dragstart", (ev) => {
      draggedId = p.id;
      ev.dataTransfer.effectAllowed = "move";
      try { ev.dataTransfer.setData("text/plain", String(p.id)); } catch (e) {}
      card.classList.add("dragging");
    });
    card.addEventListener("dragend", () => {
      draggedId = null;
      card.classList.remove("dragging");
      document.querySelectorAll(".player-card.drag-over").forEach(el => el.classList.remove("drag-over"));
    });
    card.addEventListener("dragover", (ev) => {
      ev.preventDefault();
      ev.dataTransfer.dropEffect = "move";
      if (!card.classList.contains("drag-over")) {
        document.querySelectorAll(".player-card.drag-over").forEach(el => el.classList.remove("drag-over"));
        card.classList.add("drag-over");
      }
    });
    card.addEventListener("dragleave", () => card.classList.remove("drag-over"));
    card.addEventListener("drop", (ev) => {
      ev.preventDefault();
      card.classList.remove("drag-over");
      const sourceId = String(draggedId ?? ev.dataTransfer.getData("text/plain"));
      const targetId = String(p.id);
      if (!sourceId || sourceId === targetId) return;

      const rect = card.getBoundingClientRect();
      const insertAfter = ev.clientX > (rect.left + rect.width / 2);

      reorderPlayersWithinPage(Number(sourceId), Number(targetId), curPageId, insertAfter);
    });

    /* click open modal (avoid click when dragging) */
    let clickSuppressed = false;
    card.addEventListener("mousedown", () => { clickSuppressed = false; });
    card.addEventListener("dragstart", () => { clickSuppressed = true; });
    card.addEventListener("click", (e) => {
      if (clickSuppressed) { clickSuppressed = false; return; }
      openModalForEdit(p.id);
    });

    playerList.appendChild(card);
  });

  /* allow drop to empty space to move to end */
  playerList.addEventListener("dragover", (ev) => ev.preventDefault());
  playerList.addEventListener("drop", (ev) => {
    ev.preventDefault();
    const sourceId = String(draggedId ?? ev.dataTransfer.getData("text/plain"));
    if (!sourceId) return;
    const elemAtPoint = document.elementFromPoint(ev.clientX, ev.clientY);
    const cardEl = elemAtPoint && elemAtPoint.closest && elemAtPoint.closest(".player-card");
    if (!cardEl) {
      movePlayerToEndWithinPage(Number(sourceId), getCurrentPageId());
    }
  });
}

/* reorder within page — insertAfter を受け取る */
function reorderPlayersWithinPage(sourceId, targetId, pageId, insertAfter = false) {
  if (sourceId === targetId) return;
  let players = getPlayers();

  const srcIdx = players.findIndex(p => p.id == sourceId);
  const tgtIdx = players.findIndex(p => p.id == targetId);
  if (srcIdx === -1 || tgtIdx === -1) return;

  const desiredOriginal = insertAfter ? (tgtIdx + 1) : tgtIdx;

  const [item] = players.splice(srcIdx, 1);

  const insertIdx = srcIdx < desiredOriginal ? (desiredOriginal - 1) : desiredOriginal;
  const safeInsertIdx = Math.max(0, Math.min(players.length, insertIdx));

  players.splice(safeInsertIdx, 0, item);

  savePlayers(players);
  renderPlayers();
}

function movePlayerToEndWithinPage(sourceId, pageId) {
  let players = getPlayers();
  const srcIdx = players.findIndex(p => p.id == sourceId);
  if (srcIdx === -1) return;
  const [item] = players.splice(srcIdx,1);
  let lastIdx = -1;
  for (let i=0;i<players.length;i++) if (String(players[i].pageId) === String(pageId)) lastIdx = i;
  const insertIdx = lastIdx === -1 ? players.length : lastIdx + 1;
  players.splice(insertIdx,0,item);
  savePlayers(players);
  renderPlayers();
}

/* escape helper */
function escapeHtml(str) { return (""+str).replace(/[&<>"']/g,(m)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

/* image helpers */
function readFilesAsDataURLs(files) {
  const readers = Array.from(files).map(file => new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = ()=> res(fr.result);
    fr.onerror = ()=> rej(new Error("File read error"));
    fr.readAsDataURL(file);
  }));
  return Promise.all(readers);
}
function renderImagePreview() {
  imagesPreview.innerHTML = "";
  currentImages.forEach((dataUrl, idx) => {
    const div = document.createElement("div");
    div.className = "thumb";
    div.innerHTML = `<img src="${dataUrl}" alt="ref-${idx}" data-idx="${idx}" data-type="ref" /><button type="button" class="remove" data-idx="${idx}">×</button>`;
    imagesPreview.appendChild(div);
  });
}
function renderIconPreview() {
  iconPreview.innerHTML = "";
  if (currentIcon) {
    const div = document.createElement("div");
    div.className = "icon-thumb";
    div.innerHTML = `<img src="${currentIcon}" alt="icon-preview" data-type="icon" /><button type="button" class="icon-remove" title="削除アイコン">×</button>`;
    iconPreview.appendChild(div);
  }
}

/* compute modal totals and category elements */
function computeModalTotals() {
  const baseObj = {
    Kick: parseInt(document.getElementById("edit-base-kick").value) || 0,
    Body: parseInt(document.getElementById("edit-base-body").value) || 0,
    Control: parseInt(document.getElementById("edit-base-control").value) || 0,
    Guard: parseInt(document.getElementById("edit-base-guard").value) || 0,
    Speed: parseInt(document.getElementById("edit-base-speed").value) || 0,
    Stamina: parseInt(document.getElementById("edit-base-stamina").value) || 0,
    Guts: parseInt(document.getElementById("edit-base-guts").value) || 0,
    Free: parseInt(document.getElementById("edit-base-free").value) || 0
  };
  if (baseTotalEl()) baseTotalEl().textContent = sumStatsExcludeGP_TP(baseObj, true);

  const trainedObj = {
    Kick: parseInt(document.getElementById("edit-trained-kick").value) || 0,
    Body: parseInt(document.getElementById("edit-trained-body").value) || 0,
    Control: parseInt(document.getElementById("edit-trained-control").value) || 0,
    Guard: parseInt(document.getElementById("edit-trained-guard").value) || 0,
    Speed: parseInt(document.getElementById("edit-trained-speed").value) || 0,
    Stamina: parseInt(document.getElementById("edit-trained-stamina").value) || 0,
    Guts: parseInt(document.getElementById("edit-trained-guts").value) || 0
  };
  if (trainedTotalEl()) trainedTotalEl().textContent = sumStatsExcludeGP_TP(trainedObj, false);

  const cats = sumCategoryTrained(trainedObj);
  if (catAEl()) catAEl().textContent = cats.A;
  if (catBEl()) catBEl().textContent = cats.B;
  if (catCEl()) catCEl().textContent = cats.C;
}

/* open modal for new player */
function openModalForNew(){
  modalTitle.textContent = "選手を追加";
  document.getElementById("edit-id").value = "";
  document.getElementById("edit-name").value = "";
  document.getElementById("edit-gender-male").checked = false;
  document.getElementById("edit-gender-female").checked = false;
  document.getElementById("edit-attribute").value = "";
  document.getElementById("edit-position").value = "";

  ["gp","tp","kick","body","control","guard","speed","stamina","guts","free"].forEach(k=>document.getElementById(`edit-base-${k}`).value="");
  ["gp","tp","kick","body","control","guard","speed","stamina","guts"].forEach(k=>document.getElementById(`edit-trained-${k}`).value="");

  [1,2,3,4].forEach(n=>document.getElementById(`edit-skill-${n}`).value="");
  [1,2].forEach(n=>document.getElementById(`edit-extra-${n}`).value="");
  document.getElementById("edit-memo").value = "";
  currentImages = []; currentIcon = "";
  renderImagePreview(); renderIconPreview();
  imagesInput.value = ""; iconInput.value = "";
  deleteBtn.style.display = "none";
  showModal();
  computeModalTotals();
}

/* open modal for edit */
function openModalForEdit(id) {
  const players = getPlayers();
  const p = players.find(x=>x.id == id);
  if (!p) return;
  modalTitle.textContent = "選手編集";
  document.getElementById("edit-id").value = p.id;
  document.getElementById("edit-name").value = p.name || "";

  // gender
  document.getElementById("edit-gender-male").checked = (p.gender === "男");
  document.getElementById("edit-gender-female").checked = (p.gender === "女");
  // attribute
  document.getElementById("edit-attribute").value = p.attribute || "";
  // position
  document.getElementById("edit-position").value = p.position || "";

  const b = p.baseStats || {};
  const t = p.trainedStats || {};
  document.getElementById("edit-base-gp").value = b.GP ?? "";
  document.getElementById("edit-base-tp").value = b.TP ?? "";
  document.getElementById("edit-base-kick").value = b.Kick ?? "";
  document.getElementById("edit-base-body").value = b.Body ?? "";
  document.getElementById("edit-base-control").value = b.Control ?? "";
  document.getElementById("edit-base-guard").value = b.Guard ?? "";
  document.getElementById("edit-base-speed").value = b.Speed ?? "";
  document.getElementById("edit-base-stamina").value = b.Stamina ?? "";
  document.getElementById("edit-base-guts").value = b.Guts ?? "";
  document.getElementById("edit-base-free").value = b.Free ?? "";

  document.getElementById("edit-trained-gp").value = t.GP ?? "";
  document.getElementById("edit-trained-tp").value = t.TP ?? "";
  document.getElementById("edit-trained-kick").value = t.Kick ?? "";
  document.getElementById("edit-trained-body").value = t.Body ?? "";
  document.getElementById("edit-trained-control").value = t.Control ?? "";
  document.getElementById("edit-trained-guard").value = t.Guard ?? "";
  document.getElementById("edit-trained-speed").value = t.Speed ?? "";
  document.getElementById("edit-trained-stamina").value = t.Stamina ?? "";
  document.getElementById("edit-trained-guts").value = t.Guts ?? "";

  const skl = p.skills || ["","","",""];
  for (let i=1;i<=4;i++) document.getElementById(`edit-skill-${i}`).value = skl[i-1]||"";
  const ex = p.extraSkills || ["",""];
  for (let i=1;i<=2;i++) document.getElementById(`edit-extra-${i}`).value = ex[i-1]||"";

  document.getElementById("edit-memo").value = p.memo || "";

  currentImages = Array.isArray(p.images) ? p.images.slice() : [];
  currentIcon = p.icon || "";
  renderImagePreview();
  renderIconPreview();
  imagesInput.value = ""; iconInput.value = "";

  deleteBtn.style.display = "inline-block";
  showModal();
  computeModalTotals();
}

/* show/close modal */
function showModal(){ modal.setAttribute("aria-hidden","false"); setTimeout(()=>document.getElementById("edit-name").focus(),50); }
function closeModal(){ modal.setAttribute("aria-hidden","true"); }

/* delete player */
function deleteCurrent(){
  const id = document.getElementById("edit-id").value;
  if (!id) return;
  if (!confirm("本当にこの選手を削除しますか？")) return;
  let players = getPlayers();
  players = players.filter(p=>p.id != id);
  savePlayers(players);
  renderPlayers();
  closeModal();
}

/* global click handler */
document.addEventListener("click", (e) => {
  const btn = e.target.closest && e.target.closest("button");
  if (btn && btn.classList.contains("remove")) {
    const idx = parseInt(btn.dataset.idx);
    if (!Number.isNaN(idx)) { currentImages.splice(idx,1); renderImagePreview(); }
    return;
  }

  if (btn && btn.classList.contains("icon-remove")) {
    currentIcon = "";
    renderIconPreview();
    return;
  }

  if (btn && btn.id === "lightbox-close") { closeLightbox(); return; }
});

/* input listener for totals */
editForm.addEventListener("input",(e)=>{
  const t = e.target;
  if (!t) return;
  if (/^edit-(base|trained)-/.test(t.id)) computeModalTotals();
});

/* thumbnails -> lightbox (both ref images and icon) */
document.addEventListener("click", (e) => {
  const img = e.target.closest && e.target.closest("img");
  if (!img) return;
  const type = img.dataset && img.dataset.type;
  if (type === "ref" || type === "icon") {
    openLightbox(img.src);
  }
});
function openLightbox(src){ lightboxImg.src = src; lightbox.setAttribute("aria-hidden","false"); }
function closeLightbox(){ lightbox.setAttribute("aria-hidden","true"); lightboxImg.src = ""; }
lightbox.addEventListener("click",(e)=>{ if (e.target === lightbox || e.target === lightboxImg) closeLightbox(); });
window.addEventListener("keydown",(e)=>{ if (e.key === "Escape") { if (lightbox.getAttribute("aria-hidden")==="false") closeLightbox(); else if (modal.getAttribute("aria-hidden")==="false") closeModal(); } });

/* image input handler (reference images) */
imagesInput.addEventListener("change",(e)=>{
  const files = e.target.files;
  if (!files || files.length === 0) return;
  readFilesAsDataURLs(files).then(dataUrls=>{
    currentImages = currentImages.concat(dataUrls);
    renderImagePreview();
    imagesInput.value = "";
  }).catch(err=>{ console.error(err); alert("画像読み込みに失敗しました。"); });
});

/* icon input handler (single) */
iconInput.addEventListener("change", (e) => {
  const files = e.target.files;
  if (!files || files.length === 0) return;
  const file = files[0];
  readFilesAsDataURLs([file]).then(([dataUrl])=>{
    currentIcon = dataUrl;
    renderIconPreview();
    iconInput.value = "";
  }).catch(err=> { console.error(err); alert("アイコン読み込みに失敗しました。"); });
});

/* submit (create/update player) */
editForm.addEventListener("submit",(e)=>{
  e.preventDefault();
  const idVal = document.getElementById("edit-id").value;
  const name = document.getElementById("edit-name").value.trim();

  const gender = document.getElementById("edit-gender-male").checked ? "男" : (document.getElementById("edit-gender-female").checked ? "女" : "");
  const attribute = document.getElementById("edit-attribute").value || "";
  const position = document.getElementById("edit-position").value || "";

  const baseStats = {
    GP: parseInt(document.getElementById("edit-base-gp").value) || 0,
    TP: parseInt(document.getElementById("edit-base-tp").value) || 0,
    Kick: parseInt(document.getElementById("edit-base-kick").value) || 0,
    Body: parseInt(document.getElementById("edit-base-body").value) || 0,
    Control: parseInt(document.getElementById("edit-base-control").value) || 0,
    Guard: parseInt(document.getElementById("edit-base-guard").value) || 0,
    Speed: parseInt(document.getElementById("edit-base-speed").value) || 0,
    Stamina: parseInt(document.getElementById("edit-base-stamina").value) || 0,
    Guts: parseInt(document.getElementById("edit-base-guts").value) || 0,
    Free: parseInt(document.getElementById("edit-base-free").value) || 0
  };

  const trainedStats = {
    GP: parseInt(document.getElementById("edit-trained-gp").value) || 0,
    TP: parseInt(document.getElementById("edit-trained-tp").value) || 0,
    Kick: parseInt(document.getElementById("edit-trained-kick").value) || 0,
    Body: parseInt(document.getElementById("edit-trained-body").value) || 0,
    Control: parseInt(document.getElementById("edit-trained-control").value) || 0,
    Guard: parseInt(document.getElementById("edit-trained-guard").value) || 0,
    Speed: parseInt(document.getElementById("edit-trained-speed").value) || 0,
    Stamina: parseInt(document.getElementById("edit-trained-stamina").value) || 0,
    Guts: parseInt(document.getElementById("edit-trained-guts").value) || 0
  };

  const skills = [];
  for (let i=1;i<=4;i++) skills.push(document.getElementById(`edit-skill-${i}`).value.trim());
  while (skills.length<4) skills.push("");

  const extraSkills = [];
  for (let i=1;i<=2;i++) extraSkills.push(document.getElementById(`edit-extra-${i}`).value.trim());
  while (extraSkills.length<2) extraSkills.push("");

  const memoText = document.getElementById("edit-memo").value;

  let players = getPlayers();

  if (!name) { alert("名前は必須です。"); return; }

  const curPageId = getCurrentPageId();

  if (idVal) {
    const idx = players.findIndex(p=>p.id == idVal);
    if (idx === -1) return;
    players[idx] = { ...players[idx], name, gender, attribute, position, baseStats, trainedStats, skills, extraSkills, memo: memoText, images: currentImages.slice(), icon: currentIcon || "" };
  } else {
    const newId = Date.now();
    players.push({ id: newId, name, gender, attribute, position, pageId: curPageId, baseStats, trainedStats, skills, extraSkills, memo: memoText, images: currentImages.slice(), icon: currentIcon || "" });
  }

  savePlayers(players);
  renderPlayers();
  closeModal();
});

/* page buttons */
addPageBtn.addEventListener("click", () => {
  const pages = getPagesRaw();
  if (pages.length >= MAX_PAGES) { alert(`ページは最大 ${MAX_PAGES} 個までです。`); return; }
  const name = prompt("新しいページ名を入力してください。", `Page ${pages.length + 1}`);
  if (name === null) return;
  if (name.trim() === "") { alert("ページ名は空にできません。"); return; }
  createPage(name.trim());
});

/* top-level events */
addBtn.addEventListener("click", openModalForNew);
closeModalBtn.addEventListener("click", closeModal);
window.addEventListener("click",(e)=>{ if (e.target === modal) closeModal(); });
deleteBtn.addEventListener("click", deleteCurrent);

/* ---------- 画像出力機能（1200x800） ---------- */

function getPlayerFromForm() {
  const idVal = document.getElementById("edit-id").value;
  const name = document.getElementById("edit-name").value.trim() || "無名";
  const gender = document.getElementById("edit-gender-male").checked ? "男" : (document.getElementById("edit-gender-female").checked ? "女" : "");
  const attribute = document.getElementById("edit-attribute").value || "";
  const position = document.getElementById("edit-position").value || "";

  const baseStats = {
    GP: parseInt(document.getElementById("edit-base-gp").value) || 0,
    TP: parseInt(document.getElementById("edit-base-tp").value) || 0,
    Kick: parseInt(document.getElementById("edit-base-kick").value) || 0,
    Body: parseInt(document.getElementById("edit-base-body").value) || 0,
    Control: parseInt(document.getElementById("edit-base-control").value) || 0,
    Guard: parseInt(document.getElementById("edit-base-guard").value) || 0,
    Speed: parseInt(document.getElementById("edit-base-speed").value) || 0,
    Stamina: parseInt(document.getElementById("edit-base-stamina").value) || 0,
    Guts: parseInt(document.getElementById("edit-base-guts").value) || 0,
    Free: parseInt(document.getElementById("edit-base-free").value) || 0
  };

  const trainedStats = {
    GP: parseInt(document.getElementById("edit-trained-gp").value) || 0,
    TP: parseInt(document.getElementById("edit-trained-tp").value) || 0,
    Kick: parseInt(document.getElementById("edit-trained-kick").value) || 0,
    Body: parseInt(document.getElementById("edit-trained-body").value) || 0,
    Control: parseInt(document.getElementById("edit-trained-control").value) || 0,
    Guard: parseInt(document.getElementById("edit-trained-guard").value) || 0,
    Speed: parseInt(document.getElementById("edit-trained-speed").value) || 0,
    Stamina: parseInt(document.getElementById("edit-trained-stamina").value) || 0,
    Guts: parseInt(document.getElementById("edit-trained-guts").value) || 0
  };

  const skills = [];
  for (let i=1;i<=4;i++) skills.push(document.getElementById(`edit-skill-${i}`).value.trim());
  while (skills.length<4) skills.push("");

  const extraSkills = [];
  for (let i=1;i<=2;i++) extraSkills.push(document.getElementById(`edit-extra-${i}`).value.trim());
  while (extraSkills.length<2) extraSkills.push("");

  const memoText = document.getElementById("edit-memo").value;

  const id = idVal || null;
  let storedIcon = "";
  if (id) {
    const players = getPlayers();
    const p = players.find(x=>String(x.id) === String(id));
    if (p && p.icon) storedIcon = p.icon;
  }
  const icon = currentIcon || storedIcon || "";

  return {
    id,
    name,
    gender,
    attribute,
    position,
    baseStats,
    trainedStats,
    skills,
    extraSkills,
    memo: memoText,
    icon
  };
}

/* 画像生成（アイコンは cover で描画） */
function generatePlayerImage(player) {
  return new Promise((resolve, reject) => {
    const W = 1200, H = 800;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");

    // background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0,0,W,H);

    // header strip
    ctx.fillStyle = "#f4f8ff";
    ctx.fillRect(0,0,W,110);

    // title: name
    ctx.fillStyle = "#111";
    ctx.font = "bold 42px 'Segoe UI', sans-serif";
    ctx.textBaseline = "top";
    ctx.fillText(player.name || "無名", 180, 18);

    // sub: position / gender / attribute
    ctx.font = "16px 'Segoe UI', sans-serif";
    const sub = `${player.position || ""}  ${player.gender || ""}  ${player.attribute || ""}`.trim();
    ctx.fillStyle = "#333";
    ctx.fillText(sub, 180, 70);

    // icon load and continue
    const iconDrawAndContinue = (drawBodyCallback) => {
      if (player.icon) {
        const img = new Image();
        img.onload = () => drawBodyCallback(img);
        img.onerror = () => drawBodyCallback(null);
        img.src = player.icon;
      } else {
        drawBodyCallback(null);
      }
    };

    iconDrawAndContinue((loadedImg) => {
      drawBodyContents(ctx, player, W, H, loadedImg);
      resolve(canvas);
    });
  });
}

/* 補助: 角丸塗りつぶし */
function roundRect(ctx, x, y, w, h, r, fillStyle) {
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y, x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x, y+h, r);
  ctx.arcTo(x, y+h, x, y, r);
  ctx.arcTo(x, y, x+w, y, r);
  ctx.closePath();
  if (fillStyle) { ctx.fillStyle = fillStyle; ctx.fill(); }
}

/* 補助: 角丸クリップ */
function roundClip(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y, x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x, y+h, r);
  ctx.arcTo(x, y+h, x, y, r);
  ctx.arcTo(x, y, x+w, y, r);
  ctx.closePath();
  ctx.clip();
}

/* 本文部分を描画（アイコンは cover 方式で描画） */
function drawBodyContents(ctx, player, W, H, loadedImg) {
  // body background area
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0,110,W,H-110);

  const padding = 40;
  const colGap = 24;
  const contentW = W - padding*2;
  const leftW = Math.floor(contentW * 0.62);
  const rightW = contentW - leftW - colGap;
  const leftX = padding;
  const rightX = padding + leftW + colGap;
  const topY = 140;

  // compute rows first (we'll draw left box after determining its height)
  const b = player.baseStats || {};
  const t = player.trainedStats || {};

  const rowsBase = [
    ["GP", b.GP || 0],
    ["TP", b.TP || 0],
    ["キック", b.Kick || 0],
    ["ボディ", b.Body || 0],
    ["コントロール", b.Control || 0],
    ["ガード", b.Guard || 0],
    ["スピード", b.Speed || 0],
    ["スタミナ", b.Stamina || 0],
    ["ガッツ", b.Guts || 0],
    ["Free", b.Free || 0]
  ];

  const rowsTrained = [
    ["GP", t.GP || 0],
    ["TP", t.TP || 0],
    ["キック", t.Kick || 0],
    ["ボディ", t.Body || 0],
    ["コントロール", t.Control || 0],
    ["ガード", t.Guard || 0],
    ["スピード", t.Speed || 0],
    ["スタミナ", t.Stamina || 0],
    ["ガッツ", t.Guts || 0]
  ];

  // layout metrics
  const leftInnerX = leftX + 18;
  const leftMid = leftX + Math.floor(leftW / 2);
  const baseTableX = leftInnerX;
  const trainedTableX = leftMid + 18;
  const labelW = 120;
  const valueOffset = 10;
  const rowHeight = 34;
  const startY = topY + 46;

  ctx.textBaseline = "top";

  // compute max rows and tableBottomY
  const maxRows = Math.max(rowsBase.length, rowsTrained.length);
  const tableBottomY = startY + maxRows * rowHeight + 12;

  // Determine available vertical space below topY
  const availableHeight = H - topY - 40; // keep 40px bottom margin

  // decide left box height: at least cover tableBottomY - topY + margin, but leave space for memo area
  const desiredLeftMin = Math.max(300, (tableBottomY - topY) + 120);
  const leftBoxHeight = Math.max(280, Math.min(480, Math.floor(Math.min(availableHeight - 160, desiredLeftMin))));

  // draw left box background
  roundRect(ctx, leftX, topY, leftW, leftBoxHeight, 12, "#fbfdff");

  // draw icon inside left area (if loaded) USING COVER (枠いっぱいに切り取り表示)
  const ix = 40, iy = 14, iw = 120, ih = 82;
  if (loadedImg && loadedImg.width && loadedImg.height) {
    // cover logic: ソース領域 (sx, sy, sw, sh)
    const imgW = loadedImg.width;
    const imgH = loadedImg.height;
    const boxW = iw;
    const boxH = ih;
    // scale to cover
    const scale = Math.max(boxW / imgW, boxH / imgH);
    const sw = boxW / scale;
    const sh = boxH / scale;
    const sx = Math.max(0, (imgW - sw) / 2);
    const sy = Math.max(0, (imgH - sh) / 2);
    // draw rounded background
    roundRect(ctx, ix-2, iy-2, iw+4, ih+4, 12, "#e9f2ff");
    // clip to rounded rect and drawImage with source rect -> destination rect
    ctx.save();
    roundClip(ctx, ix, iy, iw, ih, 10);
    ctx.drawImage(loadedImg, sx, sy, sw, sh, ix, iy, iw, ih);
    ctx.restore();
  } else {
    // placeholder box
    roundRect(ctx, ix, iy, 120, 82, 10, "#efefef");
    ctx.fillStyle = "#888";
    ctx.font = "bold 32px 'Segoe UI', sans-serif";
    ctx.fillText((player.name||"無名").slice(0,2), ix + 28, iy + 24);
  }

  // titles for left halves
  ctx.fillStyle = "#0b3b66";
  ctx.font = "bold 18px 'Segoe UI', sans-serif";
  ctx.fillText("基礎（レベル99）", leftX + 18, topY + 14);
  ctx.fillText("育成後（Freeなし）", leftX + leftW/2 + 18, topY + 14);

  // draw rows
  ctx.font = "14px 'Segoe UI', sans-serif";
  for (let i=0;i<maxRows;i++) {
    const y = startY + i * rowHeight;

    if (i < rowsBase.length) {
      const [lab, val] = rowsBase[i];
      ctx.fillStyle = "#666";
      ctx.fillText(lab, baseTableX, y);
      ctx.font = "bold 14px 'Segoe UI', sans-serif";
      ctx.fillStyle = (lab === "キック" || lab === "コントロール") ? "#b71c1c" : (lab === "ボディ" || lab === "ガード" || lab === "ガッツ" ? "#0b47a1" : (lab === "スピード" || lab === "スタミナ" ? "#2e7d32" : "#111"));
      ctx.fillText(String(val), baseTableX + labelW + valueOffset, y);
      ctx.font = "14px 'Segoe UI', sans-serif";
    }

    if (i < rowsTrained.length) {
      const [lab, val] = rowsTrained[i];
      ctx.fillStyle = "#666";
      ctx.fillText(lab, trainedTableX, y);
      ctx.font = "bold 14px 'Segoe UI', sans-serif";
      ctx.fillStyle = (lab === "キック" || lab === "コントロール") ? "#b71c1c" : (lab === "ボディ" || lab === "ガード" || lab === "ガッツ" ? "#0b47a1" : (lab === "スピード" || lab === "スタミナ" ? "#2e7d32" : "#111"));
      ctx.fillText(String(val), trainedTableX + labelW + valueOffset, y);
      ctx.font = "14px 'Segoe UI', sans-serif";
    }
  }

  // totals under tables
  ctx.font = "bold 16px 'Segoe UI', sans-serif";
  ctx.fillStyle = "#111";
  const baseTotal = sumStatsExcludeGP_TP(b, true);
  const trainedTotal = sumStatsExcludeGP_TP(t, false);
  ctx.fillText(`基礎合計: ${baseTotal}`, baseTableX, tableBottomY);
  ctx.fillText(`育成後合計: ${trainedTotal}`, trainedTableX, tableBottomY);

  // A/B/C
  const cats = sumCategoryTrained(t);
  ctx.font = "16px 'Segoe UI', sans-serif";
  ctx.fillStyle = "#111";
  const catY = tableBottomY + 36;
  const catXStart = leftX + 18;
  const catGap = 150;
  ctx.fillText(`Aカテ : ${cats.A}`, catXStart, catY);
  ctx.fillText(`Bカテ : ${cats.B}`, catXStart + catGap, catY);
  ctx.fillText(`Cカテ : ${cats.C}`, catXStart + catGap*2, catY);

  // RIGHT COLUMN: skills and memo
  const rx = rightX + 18;
  let ry = topY + 16;
  ctx.fillStyle = "#0b3b66";
  ctx.font = "bold 18px 'Segoe UI', sans-serif";
  ctx.fillText("習得技（レベル）", rx, ry);
  ry += 30;
  ctx.font = "15px 'Segoe UI', sans-serif";
  for (let i=0;i<4;i++) {
    const tskill = (player.skills && player.skills[i]) ? player.skills[i] : "";
    ctx.fillStyle = "#333";
    ctx.fillText(`・ ${tskill || "（なし）"}`, rx, ry);
    ry += 26;
  }

  ry += 8;
  ctx.fillStyle = "#0b3b66";
  ctx.font = "bold 18px 'Segoe UI', sans-serif";
  ctx.fillText("秘伝書（後付）", rx, ry);
  ry += 30;
  ctx.font = "15px 'Segoe UI', sans-serif";
  for (let i=0;i<2;i++) {
    const ex = (player.extraSkills && player.extraSkills[i]) ? player.extraSkills[i] : "";
    ctx.fillStyle = "#333";
    ctx.fillText(`・ ${ex || "（なし）"}`, rx, ry);
    ry += 26;
  }

  // Now decide memo title and box position so they do not get cut off
  const leftBoxBottom = topY + leftBoxHeight;
  const minimalMemoStart = Math.max(tableBottomY + 24, leftBoxBottom + 12);
  if (ry < minimalMemoStart) ry = minimalMemoStart;

  // ensure memo box fits in canvas: compute titleY and memoBoxY and adjust memoH if needed
  const titleY = ry;
  const memoBoxY = titleY + 26;
  // default memo height
  let memoH = 200;
  // compute available below memoBoxY
  const availBelow = H - memoBoxY - 40; // keep bottom margin
  if (availBelow < memoH) {
    memoH = Math.max(80, availBelow); // ensure at least 80px for memo
  }

  if (memoH < 80) {
    const newTitleY = Math.max(tableBottomY + 20, topY + 20);
    const maxPossibleMemoTop = H - 80 - 40 - 26;
    const finalTitleY = Math.min(newTitleY, maxPossibleMemoTop);
    ctx.fillStyle = "#0b3b66";
    ctx.font = "bold 18px 'Segoe UI', sans-serif";
    ctx.fillText("育成メモ", rx, finalTitleY);
    const finalMemoBoxY = finalTitleY + 26;
    roundRect(ctx, rx - 6, finalMemoBoxY - 6, rightW - 36 + 12, 80 + 12, 8, "#fafafa");
    ctx.fillStyle = "#444";
    ctx.font = "14px 'Segoe UI', sans-serif";
    wrapTextPreserveNewlines(ctx, player.memo || "（メモなし）", rx, finalMemoBoxY + 6, rightW - 36 - 6, 18);
  } else {
    ctx.fillStyle = "#0b3b66";
    ctx.font = "bold 18px 'Segoe UI', sans-serif";
    ctx.fillText("育成メモ", rx, titleY);

    const memoBoxX = rx;
    roundRect(ctx, memoBoxX - 6, memoBoxY - 6, rightW - 36 + 12, memoH + 12, 8, "#fafafa");
    ctx.fillStyle = "#444";
    ctx.font = "14px 'Segoe UI', sans-serif";
    wrapTextPreserveNewlines(ctx, player.memo || "（メモなし）", memoBoxX, memoBoxY + 6, rightW - 36 - 6, 18);
  }

  // footer note
  ctx.fillStyle = "#999";
  ctx.font = "12px 'Segoe UI', sans-serif";
  ctx.fillText("出力: イナズマ選手図鑑 - 1200×800", W - 260, H - 26);
}

/* 改行を保持して折り返し描画する関数 */
function wrapTextPreserveNewlines(ctx, text, x, y, maxWidth, lineHeight) {
  if (typeof text !== "string") text = String(text || "");
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const paragraphs = text.split("\n");

  ctx.textBaseline = "top";
  for (let p = 0; p < paragraphs.length; p++) {
    const para = paragraphs[p];
    if (para.trim() === "") {
      y += lineHeight;
      continue;
    }

    const words = para.split(/\s+/);
    let line = "";
    for (let n = 0; n < words.length; n++) {
      const testLine = line ? (line + " " + words[n]) : words[n];
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && line) {
        ctx.fillText(line, x, y);
        line = words[n];
        y += lineHeight;
      } else {
        line = testLine;
      }
    }
    if (line) {
      ctx.fillText(line, x, y);
      y += lineHeight;
    }
  }
}

/* download helper */
function downloadCanvasAsPng(canvas, filename) {
  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, "image/png");
}

/* export button */
if (exportBtn) {
  exportBtn.addEventListener("click", () => {
    const player = getPlayerFromForm();
    exportBtn.disabled = true;
    exportBtn.textContent = "生成中…";
    generatePlayerImage(player).then(canvas => {
      const filenameSafe = (player.name || "player").replace(/[^\w\-_\. ]/g,"_");
      downloadCanvasAsPng(canvas, `${filenameSafe}.png`);
    }).catch(err=>{
      console.error(err);
      alert("画像生成でエラーが発生しました。コンソールを確認してください。");
    }).finally(()=>{
      exportBtn.disabled = false;
      exportBtn.textContent = "画像出力";
    });
  });
}

/* ---------- end of 画像出力機能 ---------- */

/* initial setup & render */
ensurePagesExist();
renderPages();
renderPlayers();
