/* ===== VARIABLES ===== */
const lignes = ["Râpé", "T2", "RT", "OMORI", "T1", "Sticks", "Emballage", "Dés", "Filets", "Prédécoupés"];
let dragOffsetX = 0, dragOffsetY = 0;

/* ===== INITIALISATION ===== */
window.onload = () => {
  initDateTime();
  generateLineButtons();
  generateCalcButtons();
  updateDropdownLignes();
  loadHistorique();
  showPage("atelier");
  setInterval(initDateTime, 60000); // rafraîchir heure chaque minute
};

/* ======= NAVIGATION ======= */
function showPage(pageId) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById(pageId).classList.add("active");
}

/* ======= AFFICHAGE DATE / HEURE ======= */
function initDateTime() {
  const now = new Date();
  const semaine = getWeekNumber(now);
  const quantieme = `${now.getDate()}/${now.getMonth() + 1}`;
  const heures = now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const equipe = getEquipe(now);
  document.getElementById("datetime").innerText =
    `Semaine ${semaine} | ${quantieme} | ${heures} | Équipe : ${equipe}`;
}

function getWeekNumber(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

function getEquipe(date) {
  const h = date.getHours();
  if (h >= 5 && h < 13) return "M";
  if (h >= 13 && h < 21) return "AM";
  return "N";
}

/* ======= LIGNES ======= */
function generateLineButtons() {
  const container = document.getElementById("lineButtons");
  container.innerHTML = "";
  lignes.forEach(ligne => {
    const btn = document.createElement("button");
    btn.innerText = ligne;
    btn.onclick = () => selectLine(ligne);
    container.appendChild(btn);
  });
}

function selectLine(ligne) {
  document.getElementById("selectedLineTitle").innerText = ligne;
  document.getElementById("productionForm").dataset.ligne = ligne;
  loadPersistance(ligne);
  document.getElementById("productionForm").scrollIntoView({ behavior: "smooth" });
}

/* ======= CALCULS ======= */
function updateEstimation() {
  const ligne = document.getElementById("productionForm").dataset.ligne;
  const qRest = parseFloat(document.getElementById("quantiteRestante").value) || 0;
  const cadenceManuelle = parseFloat(document.getElementById("cadenceManuelle").value);
  const heureDebut = document.getElementById("heureDebut").value;
  const heureFin = document.getElementById("heureFin").value;
  let cadence = cadenceManuelle;

  if (!cadence) {
    const q = parseFloat(document.getElementById("quantite").value);
    if (q && heureDebut && heureFin) {
      const d1 = new Date(`1970-01-01T${heureDebut}:00`);
      const d2 = new Date(`1970-01-01T${heureFin}:00`);
      const diffH = (d2 - d1) / 3600000;
      cadence = q / diffH;
    }
  }

  let result = "—";
  if (qRest && cadence > 0) {
    const heuresRestantes = qRest / cadence;
    const minutes = Math.round(heuresRestantes * 60);
    result = `${minutes} min restantes (${heuresRestantes.toFixed(2)} h)`;
  }
  document.getElementById("finEstimee").innerText = "Temps restant estimé : " + result;

  savePersistance(ligne);
}

/* ======= SAUVEGARDE ======= */
function saveProduction() {
  const ligne = document.getElementById("productionForm").dataset.ligne;
  if (!ligne) return alert("Sélectionnez une ligne.");
  const data = {
    ligne,
    quantite: document.getElementById("quantite").value,
    quantiteRestante: document.getElementById("quantiteRestante").value,
    heureDebut: document.getElementById("heureDebut").value,
    heureFin: document.getElementById("heureFin").value,
    cadenceManuelle: document.getElementById("cadenceManuelle").value,
    equipe: getEquipe(new Date()),
    date: new Date().toLocaleString()
  };

  let historique = JSON.parse(localStorage.getItem("historiqueProduction") || "[]");
  historique.push(data);
  localStorage.setItem("historiqueProduction", JSON.stringify(historique));
  displayHistorique();
  clearProductionForm();
}

/* ======= AFFICHAGE HISTORIQUES ======= */
function loadHistorique() {
  displayHistorique();
  displayArrets();
  displayConsignes();
  displayPersonnel();
  updateDropdownLignes();
}

function displayHistorique() {
  const hist = JSON.parse(localStorage.getItem("historiqueProduction") || "[]");
  const container = document.getElementById("historiqueProduction");
  container.innerHTML = "";
  hist.slice(-10).reverse().forEach(item => {
    const div = document.createElement("div");
    div.className = "historique-item";
    div.innerText = `${item.date} | ${item.ligne} | ${item.quantite} colis (${item.equipe})`;
    container.appendChild(div);
  });

  // Affichage sur page Atelier
  const atelierHist = document.getElementById("atelierHistorique");
  atelierHist.innerHTML = "<h3>Historique global</h3>";
  hist.slice(-20).reverse().forEach(item => {
    const d = document.createElement("div");
    d.className = "historique-item";
    d.innerText = `${item.date} | ${item.ligne} : ${item.quantite} colis (${item.equipe})`;
    atelierHist.appendChild(d);
  });
}

/* ======= ARRETS ======= */
function updateDropdownLignes() {
  const select = document.getElementById("ligneArret");
  select.innerHTML = '<option value="">Choisir une ligne</option>';
  lignes.forEach(l => {
    const opt = document.createElement("option");
    opt.value = l;
    opt.innerText = l;
    select.appendChild(opt);
  });
}

function saveArret() {
  const ligne = document.getElementById("ligneArret").value;
  const duree = document.getElementById("dureeArret").value;
  const type = document.getElementById("typeArret").value;
  const comment = document.getElementById("commentArret").value;

  if (!ligne || !duree) return alert("Complétez la ligne et la durée !");
  const data = {
    ligne, duree, type, comment,
    equipe: getEquipe(new Date()),
    date: new Date().toLocaleString()
  };

  let hist = JSON.parse(localStorage.getItem("historiqueArrets") || "[]");
  hist.push(data);
  localStorage.setItem("historiqueArrets", JSON.stringify(hist));
  displayArrets();
  document.getElementById("commentArret").value = "";
  document.getElementById("dureeArret").value = "";
}

function displayArrets() {
  const hist = JSON.parse(localStorage.getItem("historiqueArrets") || "[]");
  const container = document.getElementById("historiqueArrets");
  container.innerHTML = "";
  hist.slice(-10).reverse().forEach(item => {
    const div = document.createElement("div");
    div.className = "historique-item";
    div.innerText = `${item.date} | ${item.ligne} (${item.type}) - ${item.duree} min : ${item.comment}`;
    container.appendChild(div);
  });
}

/* ======= ORGANISATION ======= */
function addConsigne() {
  const txt = document.getElementById("consigneText").value.trim();
  if (!txt) return;
  let consignes = JSON.parse(localStorage.getItem("consignes") || "[]");
  consignes.push({ texte: txt, date: new Date().toLocaleString(), valide: false });
  localStorage.setItem("consignes", JSON.stringify(consignes));
  displayConsignes();
  document.getElementById("consigneText").value = "";
}

function displayConsignes() {
  const consignes = JSON.parse(localStorage.getItem("consignes") || "[]");
  const cont = document.getElementById("listeConsignes");
  cont.innerHTML = "";
  consignes.slice(-10).reverse().forEach((c, i) => {
    const div = document.createElement("div");
    div.className = "historique-item" + (c.valide ? " validated" : "");
    div.innerHTML = `${c.date} - ${c.texte}
      <button onclick="toggleValide(${i})">${c.valide ? "✅" : "☐"}</button>`;
    cont.appendChild(div);
  });
}

function toggleValide(i) {
  let consignes = JSON.parse(localStorage.getItem("consignes") || "[]");
  consignes[i].valide = !consignes[i].valide;
  localStorage.setItem("consignes", JSON.stringify(consignes));
  displayConsignes();
}

/* ======= PERSONNEL ======= */
function savePersonnel() {
  const nom = document.getElementById("nomPersonnel").value;
  const motif = document.getElementById("motifPersonnel").value;
  const com = document.getElementById("commentPersonnel").value;
  if (!nom || !motif) return alert("Nom et motif requis.");
  const data = { nom, motif, com, date: new Date().toLocaleString(), equipe: getEquipe(new Date()) };
  let hist = JSON.parse(localStorage.getItem("historiquePersonnel") || "[]");
  hist.push(data);
  localStorage.setItem("historiquePersonnel", JSON.stringify(hist));
  displayPersonnel();
  document.getElementById("nomPersonnel").value = "";
  document.getElementById("motifPersonnel").value = "";
  document.getElementById("commentPersonnel").value = "";
}

function displayPersonnel() {
  const hist = JSON.parse(localStorage.getItem("historiquePersonnel") || "[]");
  const cont = document.getElementById("historiquePersonnel");
  cont.innerHTML = "";
  hist.slice(-10).reverse().forEach(item => {
    const d = document.createElement("div");
    d.className = "historique-item";
    d.innerText = `${item.date} - ${item.nom} (${item.motif}) ${item.com || ""}`;
    cont.appendChild(d);
  });
}

/* ======= PERSISTANCE ======= */
function savePersistance(ligne) {
  const obj = {
    quantite: document.getElementById("quantite").value,
    quantiteRestante: document.getElementById("quantiteRestante").value,
    heureDebut: document.getElementById("heureDebut").value,
    heureFin: document.getElementById("heureFin").value,
    cadenceManuelle: document.getElementById("cadenceManuelle").value
  };
  localStorage.setItem("persistance_" + ligne, JSON.stringify(obj));
}

function loadPersistance(ligne) {
  const saved = JSON.parse(localStorage.getItem("persistance_" + ligne) || "{}");
  document.getElementById("quantite").value = saved.quantite || "";
  document.getElementById("quantiteRestante").value = saved.quantiteRestante || "";
  document.getElementById("heureDebut").value = saved.heureDebut || "";
  document.getElementById("heureFin").value = saved.heureFin || "";
  document.getElementById("cadenceManuelle").value = saved.cadenceManuelle || "";
}

/* ======= CALCULATRICE ======= */
function generateCalcButtons() {
  const keys = ["7","8","9","/","4","5","6","*","1","2","3","-","0",".","=","+"];
  const cont = document.getElementById("calcButtons");
  keys.forEach(k => {
    const b = document.createElement("button");
    b.innerText = k;
    b.onclick = () => pressCalc(k);
    cont.appendChild(b);
  });
}

function pressCalc(k) {
  const display = document.getElementById("calcDisplay");
  if (k === "=") {
    try { display.value = eval(display.value); } catch { display.value = "Erreur"; }
  } else display.value += k;
}

function toggleCalculator() {
  const calc = document.getElementById("calculator");
  calc.classList.toggle("active");
}

/* ======= DRAG ======= */
function startDrag(e) {
  const calc = document.getElementById("calculator");
  dragOffsetX = e.clientX - calc.offsetLeft;
  dragOffsetY = e.clientY - calc.offsetTop;
  document.onmousemove = dragMove;
  document.onmouseup = stopDrag;
}

function dragMove(e) {
  const calc = document.getElementById("calculator");
  calc.style.left = (e.clientX - dragOffsetX) + "px";
  calc.style.top = (e.clientY - dragOffsetY) + "px";
}

function stopDrag() {
  document.onmousemove = null;
  document.onmouseup = null;
}

/* ======= EXPORT EXCEL ======= */
function exportAllData() {
  const wb = XLSX.utils.book_new();
  const sheets = {
    Production: JSON.parse(localStorage.getItem("historiqueProduction") || "[]"),
    Arrets: JSON.parse(localStorage.getItem("historiqueArrets") || "[]"),
    Organisation: JSON.parse(localStorage.getItem("consignes") || "[]"),
    Personnel: JSON.parse(localStorage.getItem("historiquePersonnel") || "[]")
  };

  for (const [name, data] of Object.entries(sheets)) {
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, name);
  }

  const now = new Date().toLocaleTimeString("fr-FR").replace(/[: ]/g, "-");
  XLSX.writeFile(wb, `Atelier_PPNC_${now}.xlsx`);
}

/* ======= GRAPHIQUES ======= */
let chartInstance;
function updateAtelierChart() {
  const ctx = document.getElementById("atelierChart").getContext("2d");
  const hist = JSON.parse(localStorage.getItem("historiqueProduction") || "[]");

  const grouped = {};
  hist.forEach(h => {
    if (!grouped[h.ligne]) grouped[h.ligne] = [];
    grouped[h.ligne].push({ x: new Date(h.date), y: parseFloat(h.quantite) || 0 });
  });

  const datasets = Object.keys(grouped).map(ligne => ({
    label: ligne,
    data: grouped[ligne],
    borderColor: `hsl(${Math.random()*360},70%,50%)`,
    fill: false,
    tension: 0.3
  }));

  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(ctx, {
    type: "line",
    data: { datasets },
    options: {
      responsive: true,
      plugins: { legend: { position: "bottom" } },
      scales: {
        x: { type: "time", time: { unit: "hour" }, title: { display: true, text: "Heure" } },
        y: { title: { display: true, text: "Quantité (colis)" } }
      }
    }
  });
}

setInterval(updateAtelierChart, 60000);
