// === CONFIG & ÉTAT GLOBAL ===

const LINES = [
  "Râpé",
  "T2",
  "RT",
  "OMORI",
  "T1",
  "Sticks",
  "Emballage",
  "Dés",
  "Filets",
  "Prédécoupé",
];

const STORAGE_KEY = "atelier_ppnc_state_v1";

let state = {
  currentSection: "atelier",
  currentLine: LINES[0],
  production: {}, // { line: [records] }
  arrets: [], // [{...}]
  organisation: [], // [{...}]
  personnel: [], // [{...}]
};

// Pour gérer le retour à la ligne après un arrêt déclenché depuis la page production
let pendingArretReturnLine = null;

// === LISTES SPÉCIALES POUR ARRÊTS (DOC WORD) ===

// Pour RÂPÉ : sous-zones et machines EXACTEMENT comme tu les as donnés
const RAPE_SOUS_ZONES = ["R1", "R2", "R1 + R2"];

const RAPE_MACHINES = [
  "Cubeuse",
  "Chizix",
  "Bizerba",
  "DPM",
  "Balance",
  "Associative",
  "SmartDate",
  "Scotches",
  "Marquem",
  "Ascenseur",
];

// Pour les autres lignes : zones génériques
const GENERIC_ZONES = ["Découpe", "Packing", "MEC"];

// === UTILITAIRES DATE / HEURE / ÉQUIPE ===

function getNow() {
  return new Date();
}

function getEquipeFromDate(d) {
  const h = d.getHours();
  if (h >= 5 && h < 13) return "M";
  if (h >= 13 && h < 21) return "AM";
  return "N";
}

function getWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  return weekNo;
}

function formatDateTime(d) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}h${min}`;
}

function formatShortDate(d) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

function formatTimeRemaining(minutes) {
  if (!isFinite(minutes) || minutes <= 0) return "-";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

function parseTimeToMinutes(timeStr) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

// === LOCAL STORAGE ===

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      LINES.forEach((l) => (state.production[l] = []));
      return;
    }
    const parsed = JSON.parse(raw);
    state = Object.assign(
      {
        currentSection: "atelier",
        currentLine: LINES[0],
        production: {},
        arrets: [],
        organisation: [],
        personnel: [],
      },
      parsed
    );
    LINES.forEach((l) => {
      if (!state.production[l]) state.production[l] = [];
    });
  } catch (e) {
    console.error("Erreur loadState", e);
    LINES.forEach((l) => (state.production[l] = []));
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("Erreur saveState", e);
  }
}

// === HEADER DATE / HEURE ===

function initHeaderDate() {
  const el = document.getElementById("header-datetime");
  if (!el) return;

  function update() {
    const now = getNow();
    const week = getWeekNumber(now);
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const equipe = getEquipeFromDate(now);

    el.textContent = `Quantième ${day} • ${day}/${month}/${year} • S${week} • ${hh}:${mm} • Équipe ${equipe}`;
  }
  update();
  setInterval(update, 30000);
}

// === NAVIGATION ===

function showSection(section) {
  state.currentSection = section;
  saveState();

  document
    .querySelectorAll(".section")
    .forEach((sec) =>
      sec.classList.toggle("visible", sec.id === `section-${section}`)
    );

  document
    .querySelectorAll(".nav-btn")
    .forEach((btn) =>
      btn.classList.toggle("active", btn.dataset.section === section)
    );

  if (section === "atelier") {
    refreshAtelierView();
  } else if (section === "production") {
    refreshProductionView();
  } else if (section === "arrets") {
    refreshArretsView();
  } else if (section === "organisation") {
    refreshOrganisationView();
  } else if (section === "personnel") {
    refreshPersonnelView();
  }
}

function initNav() {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      showSection(btn.dataset.section);
    });
  });
}

// === LIGNES (Production) ===

function initLinesSidebar() {
  const container = document.getElementById("linesList");
  if (!container) return;
  container.innerHTML = "";
  LINES.forEach((line) => {
    const btn = document.createElement("button");
    btn.className = "line-btn";
    btn.textContent = line;
    btn.dataset.line = line;
    btn.addEventListener("click", () => {
      selectLine(line, true);
    });
    container.appendChild(btn);
  });
  selectLine(state.currentLine || LINES[0], false);
}

function selectLine(line, scrollToForm) {
  state.currentLine = line;
  saveState();

  const title = document.getElementById("currentLineTitle");
  if (title) {
    title.textContent = `Ligne ${line}`;
  }

  document.querySelectorAll(".line-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.line === line);
  });

  refreshProductionForm();
  refreshProductionHistoryTable();
  if (scrollToForm) {
    const card = document.querySelector("#section-production .card");
    if (card) {
      card.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
}

// === PRODUCTION : FORM & CALCULS ===

function getCurrentLineRecords() {
  return state.production[state.currentLine] || [];
}

function computeCadenceFromInputs() {
  const startStr = document.getElementById("prodStartTime")?.value;
  const endStr = document.getElementById("prodEndTime")?.value;
  const qty = Number(document.getElementById("prodQuantity")?.value) || 0;

  const startMin = parseTimeToMinutes(startStr);
  const endMin = parseTimeToMinutes(endStr);
  if (startMin == null || endMin == null || qty <= 0) return null;

  let duration = endMin - startMin;
  if (duration <= 0) {
    duration += 24 * 60; // gestion nuit
  }
  const hours = duration / 60;
  if (hours <= 0) return null;
  return qty / hours;
}

// Cadence de référence pour calcul du temps restant
function computeRefCadenceForLine(line) {
  const records = state.production[line] || [];
  const manual = Number(document.getElementById("prodCadenceManual")?.value);
  if (manual > 0) return manual;

  // On essaye d'abord la cadence en cours (champs début/fin/quantité)
  const currentCad = computeCadenceFromInputs();
  if (currentCad && currentCad > 0) return currentCad;

  // Sinon la dernière cadence historisée
  if (!records.length) return null;
  const lastWithCad = records.filter((r) => r.cadence && r.cadence > 0);
  if (!lastWithCad.length) return null;
  const last = lastWithCad[lastWithCad.length - 1];
  return last.cadence;
}

function updateCadenceDisplay() {
  const cad = computeCadenceFromInputs();
  const el = document.getElementById("prodCadenceDisplay");
  if (!el) return;
  el.textContent = cad ? cad.toFixed(2) : "-";
}

function updateRemainingTimeDisplay() {
  const qRestEl = document.getElementById("prodRemaining");
  const el = document.getElementById("prodRemainingTimeDisplay");
  if (!qRestEl || !el) return;

  const qRest = Number(qRestEl.value) || 0;
  const line = state.currentLine;
  const cadenceRef = computeRefCadenceForLine(line);

  if (!qRest || !cadenceRef || cadenceRef <= 0) {
    el.textContent = "-";
    return;
  }

  const hours = qRest / cadenceRef;
  const minutes = hours * 60;
  el.textContent = formatTimeRemaining(minutes);
}

function refreshProductionForm() {
  const fields = [
    "prodStartTime",
    "prodEndTime",
    "prodQuantity",
    "prodRemaining",
    "prodCadenceManual",
    "prodArretMinutes",
    "prodComment",
  ];
  fields.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  const cadEl = document.getElementById("prodCadenceDisplay");
  const remEl = document.getElementById("prodRemainingTimeDisplay");
  if (cadEl) cadEl.textContent = "-";
  if (remEl) remEl.textContent = "-";
}

function refreshProductionHistoryTable() {
  const table = document.getElementById("prodHistoryTable");
  if (!table) return;
  const tbody = table.querySelector("tbody");
  tbody.innerHTML = "";
  const records = getCurrentLineRecords();
  records.forEach((rec, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${rec.dateTime}</td>
      <td>${rec.equipe}</td>
      <td>${rec.start || "-"}</td>
      <td>${rec.end || "-"}</td>
      <td>${rec.quantity}</td>
      <td>${rec.arret || 0}</td>
      <td>${rec.cadence ? rec.cadence.toFixed(2) : "-"}</td>
      <td>${rec.remainingTime || "-"}</td>
      <td>${rec.comment || ""}</td>
      <td><button class="secondary-btn" data-idx="${idx}">✕</button></td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("button[data-idx]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = Number(btn.dataset.idx);
      const arr = getCurrentLineRecords();
      if (arr[i]) {
        arr.splice(i, 1);
        saveState();
        refreshProductionHistoryTable();
        refreshAtelierView();
      }
    });
  });
}

function bindProductionForm() {
  const startEl = document.getElementById("prodStartTime");
  const endEl = document.getElementById("prodEndTime");
  const qtyEl = document.getElementById("prodQuantity");
  const qRestEl = document.getElementById("prodRemaining");
  const cadManEl = document.getElementById("prodCadenceManual");
  const arretEl = document.getElementById("prodArretMinutes");

  [startEl, endEl, qtyEl].forEach((el) =>
    el && el.addEventListener("input", () => {
      updateCadenceDisplay();
      updateRemainingTimeDisplay();
    })
  );
  [qRestEl, cadManEl].forEach((el) =>
    el && el.addEventListener("input", updateRemainingTimeDisplay)
  );

  // Si on touche au champ arrêt, on prépare le renvoi vers la page Arrêts
  if (arretEl) {
    arretEl.addEventListener("input", () => {
      const val = Number(arretEl.value) || 0;
      if (val > 0) {
        pendingArretReturnLine = state.currentLine;
        // Pré-remplir le formulaire Arrêts
        const selLine = document.getElementById("arretLine");
        const dur = document.getElementById("arretDuration");
        if (selLine) selLine.value = state.currentLine;
        if (dur) dur.value = val;
        // On laisse l'utilisateur appuyer sur "Enregistrer" pour l'arrêt
      } else {
        pendingArretReturnLine = null;
      }
    });
  }

  const saveBtn = document.getElementById("prodSaveBtn");
  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      const now = getNow();
      const equipe = getEquipeFromDate(now);
      const dateTime = formatDateTime(now);

      const start = startEl?.value || "";
      const end = endEl?.value || "";
      const quantity = Number(qtyEl?.value) || 0;
      const remaining = Number(qRestEl?.value) || 0;
      const arret = Number(arretEl?.value) || 0;
      const comment =
        document.getElementById("prodComment")?.value || "";
      const cadMan = Number(cadManEl?.value) || 0;

      let cadence = cadMan || computeCadenceFromInputs() || null;
      const cadRef = cadence || computeRefCadenceForLine(state.currentLine);

      let remainingTimeStr = "-";
      if (remaining > 0 && cadRef && cadRef > 0) {
        const hours = remaining / cadRef;
        remainingTimeStr = formatTimeRemaining(hours * 60);
      }

      const rec = {
        dateTime,
        equipe,
        start,
        end,
        quantity,
        arret,
        cadence: cadence || null,
        remainingTime: remainingTimeStr,
        comment,
      };

      state.production[state.currentLine].push(rec);
      saveState();
      refreshProductionHistoryTable();
      refreshAtelierView();

      // Efface les champs après enregistrement
      refreshProductionForm();

      // Si on a saisi un arrêt, on bascule tout de suite sur la page Arrêts
      if (arret > 0) {
        pendingArretReturnLine = state.currentLine;
        const selLine = document.getElementById("arretLine");
        const dur = document.getElementById("arretDuration");
        if (selLine) selLine.value = state.currentLine;
        if (dur) dur.value = arret;
        showSection("arrets");
      }
    });
  }

  const undoBtn = document.getElementById("prodUndoBtn");
  if (undoBtn) {
    undoBtn.addEventListener("click", () => {
      const arr = getCurrentLineRecords();
      if (arr.length) {
        arr.pop();
        saveState();
        refreshProductionHistoryTable();
        refreshAtelierView();
      }
    });
  }
}

// === ARRETS ===

function initArretsForm() {
  const selLine = document.getElementById("arretLine");
  if (!selLine) return;
  selLine.innerHTML = "";
  LINES.forEach((l) => {
    const opt = document.createElement("option");
    opt.value = l;
    opt.textContent = l;
    selLine.appendChild(opt);
  });

  const sousZoneSelect = document.getElementById("arretSousZone");
  const machineSelect = document.getElementById("arretMachine");

  function fillArretSelectors() {
    const currentLine = selLine.value;

    if (sousZoneSelect) {
      sousZoneSelect.innerHTML = "";
      let values = [];

      if (currentLine === "Râpé") {
        values = RAPE_SOUS_ZONES;
      } else {
        values = GENERIC_ZONES;
      }

      values.forEach((v) => {
        const opt = document.createElement("option");
        opt.value = v;
        opt.textContent = v;
        sousZoneSelect.appendChild(opt);
      });
    }

    if (machineSelect) {
      machineSelect.innerHTML = "";
      let machines = [];

      if (currentLine === "Râpé") {
        machines = RAPE_MACHINES;
      } else {
        // Pour les autres lignes, on laisse simple
        machines = ["Ligne complète"];
      }

      machines.forEach((m) => {
        const opt = document.createElement("option");
        opt.value = m;
        opt.textContent = m;
        machineSelect.appendChild(opt);
      });
    }
  }

  selLine.addEventListener("change", fillArretSelectors);
  fillArretSelectors();

  const saveBtn = document.getElementById("arretSaveBtn");
  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      const now = getNow();
      const line = selLine.value;
      const duration =
        Number(document.getElementById("arretDuration")?.value) || 0;
      const comment =
        document.getElementById("arretComment")?.value || "";

      let sousZone =
        sousZoneSelect?.value || "";
      let machine =
        machineSelect?.value || "";

      const rec = {
        dateTime: formatDateTime(now),
        line,
        sousZone,
        machine,
        duration,
        comment,
      };

      state.arrets.push(rec);
      saveState();

      const durEl = document.getElementById("arretDuration");
      const comEl = document.getElementById("arretComment");
      if (durEl) durEl.value = "";
      if (comEl) comEl.value = "";

      refreshArretsView();
      refreshAtelierView();

      // Si on vient d'un arrêt déclenché depuis une ligne de production
      if (pendingArretReturnLine) {
        const retour = pendingArretReturnLine;
        pendingArretReturnLine = null;
        selectLine(retour, true);
        showSection("production");
      }
    });
  }
}

function refreshArretsView() {
  const table = document.getElementById("arretsHistoryTable");
  if (!table) return;
  const tbody = table.querySelector("tbody");
  tbody.innerHTML = "";
  state.arrets.forEach((rec) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${rec.dateTime}</td>
      <td>${rec.line}</td>
      <td>${rec.sousZone || "-"}</td>
      <td>${rec.machine || "-"}</td>
      <td>${rec.duration}</td>
      <td>${rec.comment || ""}</td>
    `;
    tbody.appendChild(tr);
  });
}

// === ORGANISATION / CONSIGNES ===

function bindOrganisationForm() {
  const btn = document.getElementById("orgSaveBtn");
  if (!btn) return;

  btn.addEventListener("click", () => {
    const now = getNow();
    const rec = {
      dateTime: formatDateTime(now),
      equipe: getEquipeFromDate(now),
      consigne: document.getElementById("orgConsigne")?.value || "",
      visa: document.getElementById("orgVisa")?.value || "",
      valide: false,
    };
    state.organisation.push(rec);
    saveState();
    const c = document.getElementById("orgConsigne");
    const v = document.getElementById("orgVisa");
    if (c) c.value = "";
    if (v) v.value = "";
    refreshOrganisationView();
  });
}

function refreshOrganisationView() {
  const table = document.getElementById("orgHistoryTable");
  if (!table) return;
  const tbody = table.querySelector("tbody");
  tbody.innerHTML = "";
  state.organisation.forEach((rec, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${rec.dateTime}</td>
      <td>${rec.equipe}</td>
      <td>${rec.consigne}</td>
      <td>${rec.visa}</td>
      <td>
        <button class="secondary-btn" data-idx="${idx}">
          ${rec.valide ? "✅" : "❌"}
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("button[data-idx]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = Number(btn.dataset.idx);
      const rec = state.organisation[i];
      if (!rec) return;
      rec.valide = !rec.valide;
      saveState();
      refreshOrganisationView();
    });
  });
}

// === PERSONNEL ===

function bindPersonnelForm() {
  const btn = document.getElementById("persSaveBtn");
  if (!btn) return;

  btn.addEventListener("click", () => {
    const now = getNow();
    const rec = {
      dateTime: formatDateTime(now),
      equipe: getEquipeFromDate(now),
      nom: document.getElementById("persNom")?.value || "",
      motif: document.getElementById("persMotif")?.value || "",
      comment: document.getElementById("persComment")?.value || "",
    };
    state.personnel.push(rec);
    saveState();
    const n = document.getElementById("persNom");
    const m = document.getElementById("persMotif");
    const c = document.getElementById("persComment");
    if (n) n.value = "";
    if (m) m.value = "";
    if (c) c.value = "";
    refreshPersonnelView();
  });
}

function refreshPersonnelView() {
  const table = document.getElementById("persHistoryTable");
  if (!table) return;
  const tbody = table.querySelector("tbody");
  tbody.innerHTML = "";
  state.personnel.forEach((rec) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${rec.dateTime}</td>
      <td>${rec.equipe}</td>
      <td>${rec.nom}</td>
      <td>${rec.motif}</td>
      <td>${rec.comment}</td>
    `;
    tbody.appendChild(tr);
  });
}

// === ATELIER (vue globale) ===
let atelierChart = null;

function refreshAtelierView() {
  // Résumé par ligne (total qtés et cadence moyenne)
  const container = document.getElementById("atelier-lines-summary");
  if (!container) return;
  container.innerHTML = "";
  LINES.forEach((line) => {
    const records = state.production[line] || [];
    const totalQty = records.reduce((sum, r) => sum + (r.quantity || 0), 0);
    const cadences = records
      .map((r) => r.cadence)
      .filter((c) => c && c > 0);
    const avgCad =
      cadences.length > 0
        ? cadences.reduce((s, c) => s + c, 0) / cadences.length
        : 0;

    const div = document.createElement("div");
    div.className = "summary-card";
    div.innerHTML = `
      <div class="summary-card-title">${line}</div>
      <div class="summary-main">${totalQty} colis</div>
      <div class="summary-sub">Cadence moy. ${
        avgCad ? avgCad.toFixed(1) : "-"
      } colis/h</div>
    `;
    container.appendChild(div);
  });

  // Tableau arrêts sur Atelier (trié par durée)
  const table = document.getElementById("atelier-arrets-table");
  if (table) {
    const tbody = table.querySelector("tbody");
    tbody.innerHTML = "";
    const arretsSorted = [...state.arrets].sort(
      (a, b) => (b.duration || 0) - (a.duration || 0)
    );
    arretsSorted.forEach((rec) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${rec.line}</td>
        <td>${rec.sousZone || "-"}</td>
        <td>${rec.machine || "-"}</td>
        <td>${rec.duration}</td>
        <td>${rec.comment || ""}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Graphique d’évolution des cadences (une courbe par ligne)
  const ctx = document.getElementById("atelierChart");
  if (!ctx || typeof Chart === "undefined") return;

  const labels = [];
  const datasets = [];

  LINES.forEach((line) => {
    const records = state.production[line] || [];
    if (!records.length) return;

    const lineLabels = [];
    const data = [];
    records.forEach((r, i) => {
      lineLabels.push(i + 1);
      data.push(r.cadence || null);
    });

    if (lineLabels.length > labels.length) {
      labels.length = 0;
      lineLabels.forEach((l) => labels.push(l));
    }

    datasets.push({
      label: line,
      data,
      tension: 0.3,
      borderWidth: 2,
      spanGaps: true,
    });
  });

  if (atelierChart) {
    atelierChart.destroy();
  }

  atelierChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets,
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          labels: {
            color: "#e5ecff",
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: "#9aa7c5",
          },
          grid: {
            color: "rgba(255,255,255,0.05)",
          },
        },
        y: {
          ticks: {
            color: "#9aa7c5",
          },
          grid: {
            color: "rgba(255,255,255,0.05)",
          },
        },
      },
    },
  });
      }
// === EXPORT EXCEL GLOBAL ===

function bindExportGlobal() {
  const btn = document.getElementById("exportGlobalBtn");
  if (!btn) return;

  btn.addEventListener("click", () => {
    const now = getNow();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    const filename = `Atelier_PPNC_${hh}h${mm}_${ss}.xlsx`;

    const wb = XLSX.utils.book_new();

    // Sheet Production
    const prodRows = [
      [
        "Ligne",
        "Date/Heure",
        "Équipe",
        "Début",
        "Fin",
        "Qté",
        "Arrêt (min)",
        "Cadence",
        "Temps restant",
        "Commentaire",
      ],
    ];
    LINES.forEach((line) => {
      (state.production[line] || []).forEach((r) => {
        prodRows.push([
          line,
          r.dateTime,
          r.equipe,
          r.start,
          r.end,
          r.quantity,
          r.arret,
          r.cadence || "",
          r.remainingTime || "",
          r.comment || "",
        ]);
      });
    });
    const wsProd = XLSX.utils.aoa_to_sheet(prodRows);
    XLSX.utils.book_append_sheet(wb, wsProd, "Production");

    // Sheet Arrêts
    const arrRows = [
      [
        "Date/Heure",
        "Ligne",
        "Sous-zone / Zone",
        "Machine",
        "Durée (min)",
        "Commentaire",
      ],
    ];
    state.arrets.forEach((r) => {
      arrRows.push([
        r.dateTime,
        r.line,
        r.sousZone || "",
        r.machine || "",
        r.duration,
        r.comment || "",
      ]);
    });
    const wsArr = XLSX.utils.aoa_to_sheet(arrRows);
    XLSX.utils.book_append_sheet(wb, wsArr, "Arrêts");

    // Sheet Organisation
    const orgRows = [
      ["Date/Heure", "Équipe", "Consigne", "Visa", "Validée"],
    ];
    state.organisation.forEach((r) => {
      orgRows.push([
        r.dateTime,
        r.equipe,
        r.consigne,
        r.visa,
        r.valide ? "Oui" : "Non",
      ]);
    });
    const wsOrg = XLSX.utils.aoa_to_sheet(orgRows);
    XLSX.utils.book_append_sheet(wb, wsOrg, "Organisation");

    // Sheet Personnel
    const persRows = [
      ["Date/Heure", "Équipe", "Nom", "Motif", "Commentaire"],
    ];
    state.personnel.forEach((r) => {
      persRows.push([
        r.dateTime,
        r.equipe,
        r.nom,
        r.motif,
        r.comment || "",
      ]);
    });
    const wsPers = XLSX.utils.aoa_to_sheet(persRows);
    XLSX.utils.book_append_sheet(wb, wsPers, "Personnel");

    XLSX.writeFile(wb, filename);
  });
}

// === CALCULATRICE ===

function initCalculator() {
  const calc = document.getElementById("calculator");
  const toggle = document.getElementById("calcToggle");
  const closeBtn = document.getElementById("calcCloseBtn");
  const display = document.getElementById("calcDisplay");
  if (!calc || !toggle || !closeBtn || !display) return;

  let expr = "";

  function refresh() {
    display.value = expr;
  }

  toggle.addEventListener("click", () => {
    calc.classList.toggle("hidden");
  });

  closeBtn.addEventListener("click", () => {
    calc.classList.add("hidden");
  });

  calc.querySelectorAll(".calc-btn").forEach((btn) => {
    const val = btn.dataset.value;
    const action = btn.dataset.action;
    if (action === "clear") {
      btn.addEventListener("click", () => {
        expr = "";
        refresh();
      });
    } else if (action === "equals") {
      btn.addEventListener("click", () => {
        if (!expr.trim()) return;
        try {
          // simple éval, usage local
          // eslint-disable-next-line no-eval
          const result = eval(expr);
          expr = String(result);
          refresh();
        } catch {
          expr = "Erreur";
          refresh();
        }
      });
    } else if (val) {
      btn.addEventListener("click", () => {
        expr += val;
        refresh();
      });
    }
  });
}

// === VALIDATION DDM ===

function bindDDM() {
  const btn = document.getElementById("ddmCalcBtn");
  const out = document.getElementById("ddmResult");
  const qInput = document.getElementById("ddmQuantieme");
  const aInput = document.getElementById("ddmAnnee");
  const dInput = document.getElementById("ddmDuree");

  if (!btn || !out || !qInput || !aInput || !dInput) return;

  // Valeur par défaut année : année courante
  aInput.value = new Date().getFullYear();

  btn.addEventListener("click", () => {
    const q = Number(qInput.value);
    const annee = Number(aInput.value) || new Date().getFullYear();
    const dj = Number(dInput.value);

    if (!q || q < 1 || q > 366 || !Number.isFinite(dj) || dj < 0) {
      out.textContent = "Entrées invalides";
      return;
    }

    const base = new Date(annee, 0, 1);
    base.setDate(q);
    base.setDate(base.getDate() + dj);
    const dd = String(base.getDate()).padStart(2, "0");
    const mm = String(base.getMonth() + 1).padStart(2, "0");
    const yyyy = base.getFullYear();
    out.textContent = `${dd}/${mm}/${yyyy}`;
  });
}

// === INIT GLOBALE ===

document.addEventListener("DOMContentLoaded", () => {
  loadState();
  initHeaderDate();
  initNav();
  initLinesSidebar();
  bindProductionForm();
  initArretsForm();
  bindOrganisationForm();
  bindPersonnelForm();
  bindExportGlobal();
  initCalculator();
  bindDDM();

  // Affiche la section actuelle ou Atelier par défaut
  showSection(state.currentSection || "atelier");
});
