// === CONSTANTES GLOBALES ===

const LINES = [
  "Râpé", "T2", "RT", "OMORI", "T1",
  "Sticks", "Emballage", "Dés", "Filets", "Prédécoupés"
];

let currentLine = "Râpé";

let productionState = {};          // état courant des champs par ligne
let historyProduction = [];
let historyArrets = [];
let historyConsignes = [];
let historyPersonnel = [];

let atelierChart = null;

// === INIT ===
document.addEventListener("DOMContentLoaded", () => {
  initHeaderDate();
  setInterval(initHeaderDate, 30 * 1000);

  initFromStorage();
  initNav();
  initLineButtons();
  initHeureSelects();
  bindProduction();
  bindArrets();
  bindOrganisation();
  bindPersonnel();
  bindExport();
  bindCalculator();

  selectLine("Râpé");
  refreshAllUI();

  // PWA
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }
});

// === HEADER ===

function initHeaderDate() {
  const el = document.getElementById("header-datetime");
  const now = new Date();
  const jours = ["dim.","lun.","mar.","mer.","jeu.","ven.","sam."];
  const mois = ["janv.","févr.","mars","avr.","mai","juin","juil.","août","sept.","oct.","nov.","déc."];

  const jSemaine = jours[now.getDay()];
  const j = String(now.getDate()).padStart(2, "0");
  const m = mois[now.getMonth()];
  const h = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const semaine = getISOWeek(now);
  const equipe = getEquipe(now.getHours());

  el.textContent = `${jSemaine} ${j} ${m} ${now.getFullYear()} – ${h}:${min} | S${semaine} | Équipe ${equipe}`;
}

function getEquipe(hour) {
  if (hour >= 5 && hour < 13) return "M";
  if (hour >= 13 && hour < 21) return "A";
  return "N";
}

function getISOWeek(date) {
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(),0,1));
  const weekNo = Math.ceil(((tmp - yearStart) / 86400000 + 1)/7);
  return weekNo;
}

// === LOCAL STORAGE ===

function initFromStorage() {
  try {
    historyProduction = JSON.parse(localStorage.getItem("historyProduction") || "[]");
    historyArrets = JSON.parse(localStorage.getItem("historyArrets") || "[]");
    historyConsignes = JSON.parse(localStorage.getItem("historyConsignes") || "[]");
    historyPersonnel = JSON.parse(localStorage.getItem("historyPersonnel") || "[]");
  } catch (e) {
    historyProduction = [];
    historyArrets = [];
    historyConsignes = [];
    historyPersonnel = [];
  }
}

function saveAll() {
  localStorage.setItem("historyProduction", JSON.stringify(historyProduction));
  localStorage.setItem("historyArrets", JSON.stringify(historyArrets));
  localStorage.setItem("historyConsignes", JSON.stringify(historyConsignes));
  localStorage.setItem("historyPersonnel", JSON.stringify(historyPersonnel));
}

// === NAVIGATION ===

function initNav() {
  const buttons = document.querySelectorAll(".nav-btn");
  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      const page = btn.dataset.page;
      if (!page) return;
      document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".page").forEach(sec => sec.classList.remove("active"));
      document.getElementById(`page-${page}`).classList.add("active");
      if (page === "atelier") {
        updateAtelierChart();
        updateGlobalHistory();
      }
    });
  });
}

// === LIGNES / PRODUCTION ===

function initLineButtons() {
  const container = document.querySelector(".line-selector");
  container.innerHTML = "";
  LINES.forEach(line => {
    const btn = document.createElement("button");
    btn.className = "line-btn";
    btn.textContent = line;
    btn.addEventListener("click", () => selectLine(line));
    container.appendChild(btn);
  });
}

function selectLine(line) {
  currentLine = line;
  document.querySelectorAll(".line-btn").forEach(b => {
    b.classList.toggle("active", b.textContent === line);
  });
  document.getElementById("production-line-title").textContent = `Ligne ${line}`;

  const state = productionState[line] || {};
  document.getElementById("heureDebut").value = state.heureDebut || "";
  document.getElementById("heureFin").value = state.heureFin || "";
  document.getElementById("quantiteProduite").value = state.quantiteProduite || "";
  document.getElementById("quantiteRestante").value = state.quantiteRestante || "";
  document.getElementById("cadenceManuelle").value = state.cadenceManuelle || "";
  document.getElementById("cadenceMoyenne").textContent = "0";
  document.getElementById("tempsRestant").textContent = "--:--";

  updateProductionHistoryForLine();
}

function initHeureSelects() {
  const debut = document.getElementById("heureDebut");
  const fin = document.getElementById("heureFin");
  debut.innerHTML = `<option value="">--:--</option>`;
  fin.innerHTML = `<option value="">--:--</option>`;
  for (let h=0; h<24; h++) {
    for (let m=0; m<60; m+=15) {
      const label = `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
      const opt1 = document.createElement("option");
      opt1.value = label;
      opt1.textContent = label;
      debut.appendChild(opt1);

      const opt2 = document.createElement("option");
      opt2.value = label;
      opt2.textContent = label;
      fin.appendChild(opt2);
    }
  }

  ["heureDebut","heureFin","quantiteProduite","quantiteRestante","cadenceManuelle"]
    .forEach(id => {
      document.getElementById(id).addEventListener("input", onProductionFieldChange);
    });

  document.getElementById("btnEnregistrerProd").addEventListener("click", saveProduction);
  document.getElementById("btnResetProd").addEventListener("click", resetCurrentLine);
}

function onProductionFieldChange() {
  const state = productionState[currentLine] || {};
  state.heureDebut = document.getElementById("heureDebut").value;
  state.heureFin = document.getElementById("heureFin").value;
  state.quantiteProduite = document.getElementById("quantiteProduite").value;
  state.quantiteRestante = document.getElementById("quantiteRestante").value;
  state.cadenceManuelle = document.getElementById("cadenceManuelle").value;
  productionState[currentLine] = state;

  computeCadenceEtTemps();
}

function computeCadenceEtTemps() {
  const qProd = Number(document.getElementById("quantiteProduite").value || 0);
  const qRest = Number(document.getElementById("quantiteRestante").value || 0);
  const cadMan = Number(document.getElementById("cadenceManuelle").value || 0);
  const hDeb = document.getElementById("heureDebut").value;
  const hFin = document.getElementById("heureFin").value;

  let cadenceAuto = 0;
  if (hDeb && hFin && qProd > 0) {
    const dur = diffHeures(hDeb, hFin);
    if (dur > 0) cadenceAuto = qProd / dur;
  }

  const cadence = cadMan > 0 ? cadMan : cadenceAuto;
  document.getElementById("cadenceMoyenne").textContent = cadence.toFixed(1);

  if (cadence > 0 && qRest > 0) {
    const heuresRest = qRest / cadence;
    const minutes = Math.round(heuresRest * 60);
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    document.getElementById("tempsRestant").textContent =
      `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
  } else {
    document.getElementById("tempsRestant").textContent = "--:--";
  }
}

function diffHeures(h1, h2) {
  const [h1h,h1m] = h1.split(":").map(Number);
  const [h2h,h2m] = h2.split(":").map(Number);
  let t1 = h1h * 60 + h1m;
  let t2 = h2h * 60 + h2m;
  if (t2 < t1) t2 += 24*60; // passage minuit
  return (t2 - t1) / 60;
}

function saveProduction() {
  const state = productionState[currentLine] || {};
  const qProd = Number(state.quantiteProduite || 0);
  const qRest = Number(state.quantiteRestante || 0);
  const hDeb = state.heureDebut || "";
  const hFin = state.heureFin || "";
  const cadMan = Number(state.cadenceManuelle || 0);

  if (!qProd && !qRest) {
    alert("Renseigner au moins une quantité (produite ou restante).");
    return;
  }

  const now = new Date();
  const cadenceAuto = (hDeb && hFin && qProd>0) ? (qProd / diffHeures(hDeb, hFin)) : 0;
  const cadence = cadMan > 0 ? cadMan : cadenceAuto;
  const equipe = getEquipe(now.getHours());

  const entry = {
    line: currentLine,
    dateISO: now.toISOString(),
    heureDebut: hDeb,
    heureFin: hFin,
    quantiteProduite: qProd,
    quantiteRestante: qRest,
    cadence: Number.isFinite(cadence) ? Number(cadence.toFixed(1)) : 0,
    equipe
  };
  historyProduction.push(entry);
  saveAll();

  // reset uniquement cette ligne
  productionState[currentLine] = {};
  document.getElementById("heureDebut").value = "";
  document.getElementById("heureFin").value = "";
  document.getElementById("quantiteProduite").value = "";
  document.getElementById("quantiteRestante").value = "";
  document.getElementById("cadenceManuelle").value = "";
  document.getElementById("cadenceMoyenne").textContent = "0";
  document.getElementById("tempsRestant").textContent = "--:--";

  updateProductionHistoryForLine();
  updateAtelierChart();
  updateGlobalHistory();
}

function resetCurrentLine() {
  productionState[currentLine] = {};
  document.getElementById("heureDebut").value = "";
  document.getElementById("heureFin").value = "";
  document.getElementById("quantiteProduite").value = "";
  document.getElementById("quantiteRestante").value = "";
  document.getElementById("cadenceManuelle").value = "";
  document.getElementById("cadenceMoyenne").textContent = "0";
  document.getElementById("tempsRestant").textContent = "--:--";
}

function updateProductionHistoryForLine() {
  const container = document.getElementById("production-history");
  container.innerHTML = "";
  const items = historyProduction
    .filter(e => e.line === currentLine)
    .slice()
    .reverse();

  if (!items.length) {
    container.textContent = "Aucun enregistrement.";
    return;
  }

  for (const e of items) {
    const div = document.createElement("div");
    div.className = "history-item";
    const dt = new Date(e.dateISO);
    const h = dt.toLocaleTimeString("fr-FR", {hour:"2-digit", minute:"2-digit"});
    const d = dt.toLocaleDateString("fr-FR");
    div.innerHTML = `
      <strong>${e.line}</strong> — ${e.quantiteProduite} prod, ${e.quantiteRestante} rest.
      <div class="history-meta">
        ${d} ${h} | Cadence ${e.cadence} colis/h | Équipe ${e.equipe}
      </div>
    `;
    container.appendChild(div);
  }
}

// === ARRETS ===

function bindArrets() {
  const ligneSelect = document.getElementById("arretLigne");
  ligneSelect.innerHTML = "";
  LINES.concat(["Autre"]).forEach(l => {
    const opt = document.createElement("option");
    opt.value = l;
    opt.textContent = l;
    ligneSelect.appendChild(opt);
  });
  ligneSelect.value = "Râpé";

  ligneSelect.addEventListener("change", updateArretSources);
  document.getElementById("btnEnregistrerArret")
    .addEventListener("click", saveArret);

  updateArretSources();
  updateArretsHistory();
}

const ARRET_SOURCES = {
  "Râpé": [
    "Cubeuse", "Cheesix", "Liftvrac", "Associative",
    "Ensacheuse", "Encaisseuse", "Smartdate", "Bizerba",
    "DPM", "Scotcheuse", "Markem", "Ascenseur"
  ],
  "T2": [
    "Selvex","Trieuse","Robots","Tiromat","Vision","Convergeur",
    "DPM","Bizerba","Suremballeuse","Markem","Scotcheuse",
    "Balance cartons","Formeuse caisse","Ascenseur"
  ],
  "T1": [
    "Slicer","BFR","AES","Tiromat","Préhenseur","Bizerba","DPM",
    "Encaisseuse T1","Encaisseuse David","Markem",
    "Balance cartons","Ascenseur"
  ],
  "OMORI": [
    "BFR","Accumulateur","OMORI","Videolej","DPM",
    "Encaisseuse","Balance cartons","Ascenseur"
  ],
  "Emballage": [
    "Brinkman","Encaisseuse","Bizerba","Palettiseur",
    "Parafineuse","Râpé","Ecroûtage","Alpma"
  ],
  "Filets": [
    "Lieuse","C-Pack","Etiqueteuse","Scotcheuse"
  ],
  "Dés": [
    "Cheesix","Méca 2002","DPM","Bizerba","Scotcheuse"
  ],
  "Prédécoupés": [
    "Selvex","Bizerba","Quartivac","Scotcheuse"
  ]
};

function updateArretSources() {
  const ligne = document.getElementById("arretLigne").value;
  const isRape = (ligne === "Râpé");
  document.getElementById("wrapperSousLigne").style.display = isRape ? "flex" : "none";

  const sourceSelect = document.getElementById("arretSource");
  const libreWrapper = document.getElementById("wrapperSourceLibre");
  const libreInput = document.getElementById("arretSourceLibre");

  sourceSelect.innerHTML = "";
  libreWrapper.style.display = "none";
  libreInput.value = "";

  if (ligne === "Autre" || !ARRET_SOURCES[ligne]) {
    libreWrapper.style.display = "flex";
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Autre (texte libre)";
    sourceSelect.appendChild(opt);
    sourceSelect.value = "";
  } else {
    const list = ARRET_SOURCES[ligne];
    list.forEach(src => {
      const opt = document.createElement("option");
      opt.value = src;
      opt.textContent = src;
      sourceSelect.appendChild(opt);
    });
  }
}

function saveArret() {
  const ligne = document.getElementById("arretLigne").value;
  const sousLigne = document.getElementById("arretSousLigne").value;
  const srcSelect = document.getElementById("arretSource").value;
  const srcLibre = document.getElementById("arretSourceLibre").value.trim();
  const duree = Number(document.getElementById("arretDuree").value || 0);
  const commentaire = document.getElementById("arretCommentaire").value.trim();

  if (!ligne) {
    alert("Sélectionner une ligne.");
    return;
  }
  if (!duree) {
    alert("Renseigner la durée d'arrêt.");
    return;
  }

  let source = srcSelect;
  if (ligne === "Autre" || !ARRET_SOURCES[ligne]) {
    if (!srcLibre) {
      alert("Préciser la source d'arrêt.");
      return;
    }
    source = srcLibre;
  }

  const now = new Date();
  const equipe = getEquipe(now.getHours());

  const entry = {
    ligne,
    sousLigne: ligne === "Râpé" ? sousLigne : "",
    source,
    duree,
    commentaire,
    dateISO: now.toISOString(),
    equipe
  };

  historyArrets.push(entry);
  saveAll();

  document.getElementById("arretDuree").value = "";
  document.getElementById("arretCommentaire").value = "";
  if (ligne === "Râpé") document.getElementById("arretSousLigne").value = "";

  updateArretsHistory();
}

function updateArretsHistory() {
  const container = document.getElementById("arrets-history");
  container.innerHTML = "";
  const items = historyArrets.slice().reverse();
  if (!items.length) {
    container.textContent = "Aucun arrêt enregistré.";
    return;
  }
  for (const e of items) {
    const div = document.createElement("div");
    div.className = "history-item";
    const dt = new Date(e.dateISO);
    const d = dt.toLocaleDateString("fr-FR");
    const h = dt.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});
    div.innerHTML = `
      <strong>${e.ligne}${e.sousLigne ? " ("+e.sousLigne+")" : ""}</strong> — ${e.source} — ${e.duree} min
      <div class="history-meta">
        ${d} ${h} | Équipe ${e.equipe}${e.commentaire ? " | " + e.commentaire : ""}
      </div>
    `;
    container.appendChild(div);
  }
}

// === ORGANISATION ===

function bindOrganisation() {
  document.getElementById("btnEnregistrerConsigne")
    .addEventListener("click", saveConsigne);
  updateConsignesHistory();
}

function saveConsigne() {
  const texte = document.getElementById("consigneTexte").value.trim();
  const initValide = document.getElementById("consigneValidee").checked;
  if (!texte) {
    alert("Renseigner une consigne.");
    return;
  }
  const now = new Date();
  const equipe = getEquipe(now.getHours());

  const entry = {
    id: Date.now(),
    texte,
    dateISO: now.toISOString(),
    equipe,
    valide: initValide
  };
  historyConsignes.push(entry);
  saveAll();

  document.getElementById("consigneTexte").value = "";
  document.getElementById("consigneValidee").checked = false;
  updateConsignesHistory();
}

function toggleConsigne(id) {
  const c = historyConsignes.find(x => x.id === id);
  if (c) {
    c.valide = !c.valide;
    saveAll();
    updateConsignesHistory();
  }
}

function updateConsignesHistory() {
  const container = document.getElementById("consignes-history");
  container.innerHTML = "";
  const items = historyConsignes.slice().reverse();
  if (!items.length) {
    container.textContent = "Aucune consigne.";
    return;
  }
  for (const e of items) {
    const div = document.createElement("div");
    div.className = "history-item";
    const dt = new Date(e.dateISO);
    const d = dt.toLocaleDateString("fr-FR");
    const h = dt.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});
    const icon = e.valide ? "✅" : "⏳";
    div.innerHTML = `
      ${icon} <strong>${e.texte}</strong>
      <div class="history-meta">
        ${d} ${h} | Équipe ${e.equipe}
        <button style="margin-left:6px;font-size:11px;border-radius:999px;border:none;padding:2px 6px;background:#e0e8f5;">
          Basculer validation
        </button>
      </div>
    `;
    const btn = div.querySelector("button");
    btn.addEventListener("click", () => toggleConsigne(e.id));
    container.appendChild(div);
  }
}

// === PERSONNEL ===

function bindPersonnel() {
  document.getElementById("btnEnregistrerPersonnel")
    .addEventListener("click", savePersonnelNote);
  updatePersonnelHistory();
}

function savePersonnelNote() {
  const texte = document.getElementById("notePersonnel").value.trim();
  if (!texte) {
    alert("Renseigner une note.");
    return;
  }
  const now = new Date();
  const equipe = getEquipe(now.getHours());
  const entry = {
    dateISO: now.toISOString(),
    equipe,
    texte
  };
  historyPersonnel.push(entry);
  saveAll();
  document.getElementById("notePersonnel").value = "";
  updatePersonnelHistory();
}

function updatePersonnelHistory() {
  const container = document.getElementById("personnel-history");
  container.innerHTML = "";
  const items = historyPersonnel.slice().reverse();
  if (!items.length) {
    container.textContent = "Aucune note.";
    return;
  }
  for (const e of items) {
    const div = document.createElement("div");
    div.className = "history-item";
    const dt = new Date(e.dateISO);
    const d = dt.toLocaleDateString("fr-FR");
    const h = dt.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});
    div.innerHTML = `
      <strong>${e.texte}</strong>
      <div class="history-meta">${d} ${h} | Équipe ${e.equipe}</div>
    `;
    container.appendChild(div);
  }
}

// === ATELIER (graph + global history) ===

function refreshAllUI() {
  updateProductionHistoryForLine();
  updateArretsHistory();
  updateConsignesHistory();
  updatePersonnelHistory();
  updateAtelierChart();
  updateGlobalHistory();
}

function updateGlobalHistory() {
  const container = document.getElementById("global-history");
  container.innerHTML = "";
  const items = historyProduction.slice().reverse();
  if (!items.length) {
    container.textContent = "Aucune production enregistrée.";
    return;
  }
  for (const e of items.slice(0,50)) {
    const div = document.createElement("div");
    div.className = "history-item";
    const dt = new Date(e.dateISO);
    const d = dt.toLocaleDateString("fr-FR");
    const h = dt.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});
    div.innerHTML = `
      <strong>${e.line}</strong> — ${e.quantiteProduite} prod / ${e.quantiteRestante} rest. — ${e.cadence} colis/h
      <div class="history-meta">${d} ${h} | Équipe ${e.equipe}</div>
    `;
    container.appendChild(div);
  }
}

function updateAtelierChart() {
  const ctx = document.getElementById("atelierChart").getContext("2d");
  const byLine = {};
  const labels = [];

  const sorted = historyProduction.slice().sort((a,b) => a.dateISO.localeCompare(b.dateISO));
  for (const e of
