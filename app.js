// =========================
// CONFIG GLOBALE
// =========================

// Lignes de production
const LINES = [
  "Râpé",
  "T1",
  "T2",
  "OMORI",
  "Emballage",
  "Filets",
  "Dés",
  "Prédécoupés",
  "Autre"
];

// Options d'arrêts par ligne (fidèles au Word)
const ARRET_OPTIONS = {
  "Râpé": {
    sousLignes: ["R1", "R2", "R1/R2"],
    machines: [
      "Cubeuse",
      "Cheesix",
      "Liftvrac",
      "Associative",
      "Ensacheuse",
      "Encaisseuse",
      "Smartdate",
      "Bizerba",
      "DPM",
      "Scotcheuse",
      "Markem",
      "Ascenseur"
    ]
  },
  "T1": {
    machines: [
      "Slicer",
      "BFR",
      "AES",
      "Tiromat",
      "Préhenseur",
      "Bizerba",
      "DPM",
      "Encaisseuse T1",
      "Encaisseuse David",
      "Markem",
      "Balance cartons",
      "Ascenseur"
    ]
  },
  "T2": {
    machines: [
      "Selvex",
      "Trieuse",
      "Robots",
      "Tiromat",
      "Vision",
      "Convergeur",
      "DPM",
      "Bizerba",
      "Suremballeuse",
      "Markem",
      "Scotcheuse",
      "Balance cartons",
      "Formeuse caisse",
      "Ascenseur"
    ]
  },
  "OMORI": {
    machines: [
      "BFR",
      "Accumulateur",
      "OMORI",
      "Videojet",
      "DPM",
      "Encaisseuse",
      "Balance cartons",
      "Ascenseur"
    ]
  },
  "Emballage": {
    machines: [
      "Brinkman",
      "Encaisseuse",
      "Bizerba",
      "Palettiseur",
      "Paraffineuse",
      "Râpé",
      "Ecroûtage",
      "Alpma"
    ]
  },
  "Filets": {
    machines: [
      "Lieuse",
      "C-Pack",
      "Etiquetteuse",
      "Scotcheuse"
    ]
  },
  "Dés": {
    machines: [
      "Cheesix",
      "Méca 2002",
      "DPM",
      "Bizerba",
      "Scotcheuse"
    ]
  },
  "Prédécoupés": {
    machines: [
      "Selvex",
      "Bizerba",
      "Quartivac",
      "Scotcheuse"
    ]
  },
  "Autre": {
    machines: []
  }
};

// =========================
// ETAT GLOBAL
// =========================

let state = {
  production: {},     // { ligne: { draft: {...}, history: [...] } }
  arrets: [],         // liste d'arrêts
  organisation: [],   // consignes
  personnel: []       // absences / retards etc.
};

let currentLineForArret = null; // pour savoir de quelle page de ligne on vient

// =========================
// UTILITAIRES
// =========================

function saveState() {
  try {
    localStorage.setItem("atelier_state", JSON.stringify(state));
  } catch (e) {
    console.warn("Impossible de sauvegarder dans localStorage", e);
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem("atelier_state");
    if (raw) {
      state = JSON.parse(raw);
    }
  } catch (e) {
    console.warn("Impossible de charger localStorage", e);
  }

  // S'assurer que toutes les lignes existent
  if (!state.production) state.production = {};
  LINES.forEach(line => {
    if (!state.production[line]) {
      state.production[line] = {
        draft: {
          heureDebut: "",
          heureFin: "",
          quantite: "",
          quantiteRestante: "",
          cadenceManuelle: ""
        },
        history: []
      };
    }
  });
  if (!Array.isArray(state.arrets)) state.arrets = [];
  if (!Array.isArray(state.organisation)) state.organisation = [];
  if (!Array.isArray(state.personnel)) state.personnel = [];
}

function getCurrentTeam(date = new Date()) {
  const h = date.getHours();
  // M = 5h-13h / AM = 13h-21h / N = 21h-5h
  if (h >= 5 && h < 13) return "M";
  if (h >= 13 && h < 21) return "AM";
  return "N";
}

function getWeekNumber(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  return weekNo;
}

function pad2(n) {
  return n.toString().padStart(2, "0");
}

function initHeaderDate() {
  const el = document.getElementById("headerDateInfo");
  if (!el) return;
  const now = new Date();
  const jour = pad2(now.getDate());
  const mois = pad2(now.getMonth() + 1);
  const annee = now.getFullYear();
  const heure = pad2(now.getHours());
  const minute = pad2(now.getMinutes());
  const week = getWeekNumber(now);
  const equipe = getCurrentTeam(now);

  el.textContent = `📅 ${jour}/${mois}/${annee} (S${week}) • ⏰ ${heure}h${minute} • Équipe : ${equipe}`;
}

// =========================
// NAVIGATION
// =========================

function showSection(sectionId) {
  document.querySelectorAll(".page-section").forEach(sec => {
    if (sec.id === sectionId) {
      sec.classList.add("active");
    } else {
      sec.classList.remove("active");
    }
  });

  document.querySelectorAll(".nav-button").forEach(btn => {
    const target = btn.getAttribute("data-target");
    if (target === sectionId) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });
}

function openLinePage(lineName) {
  // On suppose que la section production contient toutes les lignes,
  // et qu'on scrolle jusqu'au bloc de la ligne.
  showSection("page-production");
  const anchor = document.querySelector(`[data-line-block="${lineName}"]`);
  if (anchor) {
    anchor.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

// =========================
// PRODUCTION : FORMULAIRES
// =========================

function syncLineDraftFromInputs(lineName) {
  const baseId = lineName.replace(/\s+/g, "_"); // ex: "Râpé" -> "Râpé"
  const hDeb = document.getElementById(`heureDebut-${baseId}`);
  const hFin = document.getElementById(`heureFin-${baseId}`);
  const qte = document.getElementById(`quantite-${baseId}`);
  const qteRest = document.getElementById(`quantiteRestante-${baseId}`);
  const cadMan = document.getElementById(`cadenceManuelle-${baseId}`);

  const draft = state.production[lineName].draft;

  if (hDeb) draft.heureDebut = hDeb.value;
  if (hFin) draft.heureFin = hFin.value;
  if (qte) draft.quantite = qte.value;
  if (qteRest) draft.quantiteRestante = qteRest.value;
  if (cadMan) draft.cadenceManuelle = cadMan.value;
}

function fillLineInputsFromDraft(lineName) {
  const baseId = lineName.replace(/\s+/g, "_");
  const d = state.production[lineName].draft;

  const hDeb = document.getElementById(`heureDebut-${baseId}`);
  const hFin = document.getElementById(`heureFin-${baseId}`);
  const qte = document.getElementById(`quantite-${baseId}`);
  const qteRest = document.getElementById(`quantiteRestante-${baseId}`);
  const cadMan = document.getElementById(`cadenceManuelle-${baseId}`);
  const tempsRest = document.getElementById(`tempsRestant-${baseId}`);

  if (hDeb && d.heureDebut) hDeb.value = d.heureDebut;
  if (hFin && d.heureFin) hFin.value = d.heureFin;
  if (qte && d.quantite) qte.value = d.quantite;
  if (qteRest && d.quantiteRestante) qteRest.value = d.quantiteRestante;
  if (cadMan && d.cadenceManuelle) cadMan.value = d.cadenceManuelle;
  if (tempsRest) tempsRest.textContent = ""; // sera recalculé
}

function computeCadence(heureDebut, heureFin, quantite) {
  if (!heureDebut || !heureFin || !quantite) return 0;
  const [hdH, hdM] = heureDebut.split(":").map(Number);
  const [hfH, hfM] = heureFin.split(":").map(Number);
  let debut = hdH * 60 + hdM;
  let fin = hfH * 60 + hfM;
  if (isNaN(debut) || isNaN(fin) || isNaN(+quantite)) return 0;
  // gestion passage minuit
  if (fin < debut) fin += 24 * 60;
  const dureeMinutes = fin - debut;
  if (dureeMinutes <= 0) return 0;
  const cadence = (Number(quantite) / dureeMinutes) * 60;
  return Math.round(cadence);
}

function updateTempsRestant(lineName) {
  const baseId = lineName.replace(/\s+/g, "_");
  const d = state.production[lineName].draft;
  const tempsRestEl = document.getElementById(`tempsRestant-${baseId}`);
  if (!tempsRestEl) return;

  const qteRest = Number(d.quantiteRestante || 0);
  let cadence = 0;

  if (d.cadenceManuelle) {
    cadence = Number(d.cadenceManuelle) || 0;
  } else {
    // essayer de prendre la dernière cadence de l'historique
    const hist = state.production[lineName].history;
    if (hist && hist.length > 0) {
      const last = hist[hist.length - 1];
      cadence = Number(last.cadence) || 0;
    }
  }

  if (!qteRest || !cadence || cadence <= 0) {
    tempsRestEl.textContent = "";
    return;
  }

  const heuresRestantes = qteRest / cadence; // heures
  const minutesTotal = Math.round(heuresRestantes * 60);
  const h = Math.floor(minutesTotal / 60);
  const m = minutesTotal % 60;

  tempsRestEl.textContent = `${h}h${pad2(m)} restantes (estimé)`;
}

function enregistrerProduction(lineName) {
  syncLineDraftFromInputs(lineName);
  const d = state.production[lineName].draft;
  const now = new Date();
  const equipe = getCurrentTeam(now);
  const week = getWeekNumber(now);

  // Calcul cadence automatique
  let cadenceAuto = computeCadence(d.heureDebut, d.heureFin, d.quantite);
  let cadenceFinale = cadenceAuto;
  if (d.cadenceManuelle) {
    const man = Number(d.cadenceManuelle);
    if (!isNaN(man) && man > 0) {
      cadenceFinale = man;
    }
  }

  const record = {
    date: now.toISOString(),
    jour: `${pad2(now.getDate())}/${pad2(now.getMonth() + 1)}/${now.getFullYear()}`,
    heureSaisie: `${pad2(now.getHours())}h${pad2(now.getMinutes())}`,
    semaine: week,
    equipe,
    ligne: lineName,
    heureDebut: d.heureDebut,
    heureFin: d.heureFin,
    quantite: d.quantite,
    quantiteRestante: d.quantiteRestante,
    cadence: cadenceFinale,
    cadenceAuto: cadenceAuto,
    cadenceManuelle: d.cadenceManuelle || ""
  };

  state.production[lineName].history.push(record);

  // vider les champs (draft)
  state.production[lineName].draft = {
    heureDebut: "",
    heureFin: "",
    quantite: "",
    quantiteRestante: "",
    cadenceManuelle: ""
  };

  saveState();
  fillLineInputsFromDraft(lineName);
  renderProductionHistoryForLine(lineName);
  updateTempsRestant(lineName);
}

// affichage historique simple (table)
function renderProductionHistoryForLine(lineName) {
  const baseId = lineName.replace(/\s+/g, "_");
  const tbody = document.getElementById(`historiqueBody-${baseId}`);
  if (!tbody) return;
  tbody.innerHTML = "";
  const hist = state.production[lineName].history || [];
  hist.forEach((rec, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${rec.jour} ${rec.heureSaisie}</td>
      <td>${rec.equipe}</td>
      <td>${rec.heureDebut}</td>
      <td>${rec.heureFin}</td>
      <td>${rec.quantite}</td>
      <td>${rec.cadence}</td>
      <td>${rec.quantiteRestante || ""}</td>
    `;
    tbody.appendChild(tr);
  });
}

// =========================
// ARRETS : LOGIQUE
// =========================

function updateArretSelectorsForLine(lineName) {
  const selectLigne = document.getElementById("arretLigne");
  const selectSousLigne = document.getElementById("arretSousLigne");
  const selectMachine = document.getElementById("arretMachine");
  if (!selectLigne || !selectMachine) return;

  if (lineName) {
    selectLigne.value = lineName;
  } else {
    lineName = selectLigne.value;
  }

  const config = ARRET_OPTIONS[lineName] || ARRET_OPTIONS["Autre"];

  // Sous-lignes (Râpé)
  if (selectSousLigne) {
    if (config.sousLignes && config.sousLignes.length > 0) {
      selectSousLigne.style.display = "";
      selectSousLigne.innerHTML = "";
      config.sousLignes.forEach(opt => {
        const o = document.createElement("option");
        o.value = opt;
        o.textContent = opt;
        selectSousLigne.appendChild(o);
      });
    } else {
      selectSousLigne.style.display = "none";
      selectSousLigne.innerHTML = "";
    }
  }

  // Machines
  selectMachine.innerHTML = "";
  if (config.machines && config.machines.length > 0) {
    config.machines.forEach(m => {
      const o = document.createElement("option");
      o.value = m;
      o.textContent = m;
      selectMachine.appendChild(o);
    });
  } else {
    const o = document.createElement("option");
    o.value = "";
    o.textContent = "-- Machine / source à décrire --";
    selectMachine.appendChild(o);
  }
}

function ouvrirArretDepuisLigne(lineName) {
  currentLineForArret = lineName;
  showSection("page-arrets");

  const selectLigne = document.getElementById("arretLigne");
  if (selectLigne) {
    selectLigne.value = lineName;
  }
  updateArretSelectorsForLine(lineName);
}

function enregistrerArret() {
  const selectLigne = document.getElementById("arretLigne");
  const selectSousLigne = document.getElementById("arretSousLigne");
  const selectMachine = document.getElementById("arretMachine");
  const inputDuree = document.getElementById("arretDuree");
  const inputComment = document.getElementById("arretCommentaire");

  if (!selectLigne || !selectMachine || !inputDuree) return;

  const now = new Date();
  const equipe = getCurrentTeam(now);
  const week = getWeekNumber(now);

  const ligne = selectLigne.value || "Autre";
  const sousLigne = selectSousLigne && selectSousLigne.style.display !== "none"
    ? selectSousLigne.value
    : "";
  const machine = selectMachine.value;
  const duree = inputDuree.value;
  const commentaire = inputComment.value;

  const rec = {
    date: now.toISOString(),
    jour: `${pad2(now.getDate())}/${pad2(now.getMonth() + 1)}/${now.getFullYear()}`,
    heure: `${pad2(now.getHours())}h${pad2(now.getMinutes())}`,
    semaine: week,
    equipe,
    ligne,
    sousLigne,
    machine,
    duree,
    commentaire
  };

  state.arrets.push(rec);
  saveState();

  // vider les champs
  inputDuree.value = "";
  if (inputComment) inputComment.value = "";

  renderArretsHistory();

  // retour à la ligne d'origine si défini
  if (currentLineForArret) {
    openLinePage(currentLineForArret);
    currentLineForArret = null;
  }
}

function renderArretsHistory() {
  const tbody = document.getElementById("arretsHistoriqueBody");
  if (!tbody) return;
  tbody.innerHTML = "";
  state.arrets.forEach(rec => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${rec.jour} ${rec.heure}</td>
      <td>${rec.equipe}</td>
      <td>${rec.ligne}${rec.sousLigne ? " / " + rec.sousLigne : ""}</td>
      <td>${rec.machine || ""}</td>
      <td>${rec.duree}</td>
      <td>${rec.commentaire || ""}</td>
    `;
    tbody.appendChild(tr);
  });
}

// =========================
// ORGANISATION / PERSONNEL (VERSION SIMPLE)
// =========================

function enregistrerConsigne() {
  const inputTexte = document.getElementById("consigneTexte");
  const inputVisa = document.getElementById("consigneVisa");
  if (!inputTexte || !inputVisa) return;
  const texte = inputTexte.value.trim();
  const visa = inputVisa.value.trim();
  if (!texte) return;
  const now = new Date();
  const week = getWeekNumber(now);
  const rec = {
    date: now.toISOString(),
    jour: `${pad2(now.getDate())}/${pad2(now.getMonth() + 1)}/${now.getFullYear()}`,
    semaine: week,
    heure: `${pad2(now.getHours())}h${pad2(now.getMinutes())}`,
    texte,
    visa,
    valide: false
  };
  state.organisation.push(rec);
  saveState();
  inputTexte.value = "";
  inputVisa.value = "";
  renderOrganisationHistory();
}

function toggleConsigneValide(index) {
  const rec = state.organisation[index];
  if (!rec) return;
  rec.valide = !rec.valide;
  saveState();
  renderOrganisationHistory();
}

function renderOrganisationHistory() {
  const tbody = document.getElementById("organisationHistoriqueBody");
  if (!tbody) return;
  tbody.innerHTML = "";
  state.organisation.forEach((rec, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${rec.jour} ${rec.heure}</td>
      <td>${rec.texte}</td>
      <td>${rec.visa}</td>
      <td>
        <label>
          <input type="checkbox" ${rec.valide ? "checked" : ""} onclick="toggleConsigneValide(${idx})">
          Validée
        </label>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function enregistrerPersonnel() {
  const inputNom = document.getElementById("persNom");
  const selectMotif = document.getElementById("persMotif");
  const inputComment = document.getElementById("persCommentaire");
  if (!inputNom || !selectMotif) return;
  const nom = inputNom.value.trim();
  const motif = selectMotif.value;
  const commentaire = inputComment ? inputComment.value.trim() : "";
  if (!nom || !motif) return;
  const now = new Date();
  const week = getWeekNumber(now);
  const rec = {
    date: now.toISOString(),
    jour: `${pad2(now.getDate())}/${pad2(now.getMonth() + 1)}/${now.getFullYear()}`,
    semaine: week,
    heure: `${pad2(now.getHours())}h${pad2(now.getMinutes())}`,
    nom,
    motif,
    commentaire
  };
  state.personnel.push(rec);
  saveState();
  inputNom.value = "";
  if (inputComment) inputComment.value = "";
  renderPersonnelHistory();
}

function renderPersonnelHistory() {
  const tbody = document.getElementById("personnelHistoriqueBody");
  if (!tbody) return;
  tbody.innerHTML = "";
  state.personnel.forEach(rec => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${rec.jour} ${rec.heure}</td>
      <td>${rec.nom}</td>
      <td>${rec.motif}</td>
      <td>${rec.commentaire || ""}</td>
    `;
    tbody.appendChild(tr);
  });
}

// =========================
// INIT
// =========================

function initEventListeners() {
  // nav
  document.querySelectorAll(".nav-button").forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-target");
      if (target) showSection(target);
    });
  });

  // boutons de lignes (pour aller au bloc de la ligne)
  document.querySelectorAll(".line-button").forEach(btn => {
    btn.addEventListener("click", () => {
      const line = btn.getAttribute("data-line");
      if (line) openLinePage(line);
    });
  });

  // boutons "Arrêt" sur chaque ligne
  document.querySelectorAll(".btn-arret-ligne").forEach(btn => {
    btn.addEventListener("click", () => {
      const line = btn.getAttribute("data-line");
      if (line) ouvrirArretDepuisLigne(line);
    });
  });

  // changement de ligne sur la page arrêts
  const arretLigne = document.getElementById("arretLigne");
  if (arretLigne) {
    arretLigne.addEventListener("change", (e) => {
      updateArretSelectorsForLine(e.target.value);
    });
  }

  // bouton enregistrer arrêt
  const btnSaveArret = document.getElementById("btnEnregistrerArret");
  if (btnSaveArret) {
    btnSaveArret.addEventListener("click", () => {
      enregistrerArret();
    });
  }

  // boutons enregistrer production
  document.querySelectorAll(".btn-enregistrer-production").forEach(btn => {
    btn.addEventListener("click", () => {
      const line = btn.getAttribute("data-line");
      if (!line) return;
      enregistrerProduction(line);
    });
  });

  // inputs quantité restante pour recalcul temps restant
  LINES.forEach(line => {
    const baseId = line.replace(/\s+/g, "_");
    const inputQteRest = document.getElementById(`quantiteRestante-${baseId}`);
    if (inputQteRest) {
      inputQteRest.addEventListener("input", () => {
        syncLineDraftFromInputs(line);
        updateTempsRestant(line);
        saveState();
      });
    }
    const cadenceManuelle = document.getElementById(`cadenceManuelle-${baseId}`);
    if (cadenceManuelle) {
      cadenceManuelle.addEventListener("input", () => {
        syncLineDraftFromInputs(line);
        updateTempsRestant(line);
        saveState();
      });
    }

    const hDeb = document.getElementById(`heureDebut-${baseId}`);
    const hFin = document.getElementById(`heureFin-${baseId}`);
    const qte = document.getElementById(`quantite-${baseId}`);
    [hDeb, hFin, qte].forEach(inp => {
      if (inp) {
        inp.addEventListener("input", () => {
          syncLineDraftFromInputs(line);
          saveState();
        });
      }
    });
  });

  // Organisation
  const btnSaveConsigne = document.getElementById("btnEnregistrerConsigne");
  if (btnSaveConsigne) {
    btnSaveConsigne.addEventListener("click", enregistrerConsigne);
  }

  // Personnel
  const btnSavePersonnel = document.getElementById("btnEnregistrerPersonnel");
  if (btnSavePersonnel) {
    btnSavePersonnel.addEventListener("click", enregistrerPersonnel);
  }

  // Calculatrice (si elle existe déjà dans ton HTML)
  const calcToggle = document.getElementById("calcToggle");
  const calcPanel = document.getElementById("calcPanel");
  if (calcToggle && calcPanel) {
    calcToggle.addEventListener("click", () => {
      calcPanel.classList.toggle("open");
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadState();
  initHeaderDate();

  // Remplir les formulaires des lignes avec les brouillons
  LINES.forEach(line => {
    fillLineInputsFromDraft(line);
    renderProductionHistoryForLine(line);
  });

  renderArretsHistory();
  renderOrganisationHistory();
  renderPersonnelHistory();

  initEventListeners();

  // initialiser la page Arrêts avec Râpé par défaut
  const arretLigne = document.getElementById("arretLigne");
  if (arretLigne) {
    updateArretSelectorsForLine(arretLigne.value || "Râpé");
  }

  // page par défaut : Atelier ou Production selon ton choix
  showSection("page-atelier");
});
    
