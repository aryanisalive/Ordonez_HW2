/* ------------------------------
 * Simple Ride Platform (Merged)
 * - Front-end local demo (from app.js)
 * - Backend-triggered sim + server reports (from app_new.js)
 * Storage: localStorage (replace with real API)
 * ------------------------------ */

// ==== Constants & Defaults ====
const STORAGE_KEYS = {
  rides: "rides_v1",
  rates: "rates_v1",
  payouts: "payouts_v1",      // driverName -> { owedCents }
  commissions: "commissions_v1" // { periodKey, rides, amountCents, createdAt }
};

const DEFAULT_RATES = {
  taxRatePct: 8.25,         // % tax applied on base price
  commissionRatePct: 20.0   // % taken by company (on base, pre-tax)
};

const SIMULATION_POOL = {
  users: ["Alice Johnson", "Bob Smith", "Charlie Brown", "Diana Prince", "Ethan Hunt", "Chase Williams", "Liam Brooks", "Jacob Jameson", "Fernando Martinez", "Jose Lopez"],
  drivers: ["Samir Patel", "Maria Garcia", "David Chen", "Aisha Khan", "Leo Wong", "James Ferguson", "Bella Amelie", "William Matthews", "Kyle Thomas", "Joe Rodriguez"],
  pickups: ["123 Main St", "City Hall", "Airport Terminal A", "Central Park West", "Tech Campus Gate 3", "100 South St", "400 Terrace Ln", "Joseph's Diner", "Museum of Natural Science", "West Bay Bank"],
  dropoffs: ["500 Market Ave", "Martin Luther Blvd", "Boardwalk Ave", "Park Place St", "300 Towny Ln", "Johannes Zoo", "Train Station Platform 2", "The Museum District", "National Convention Center", "Ocean View Tower"],
  categories: ["Standard", "XL", "Executive"],
  payments: ["Card", "Cash", "Wallet"],
};

// ==== Small Helpers ====
const randomPick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// Storage helpers
const readJSON = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
};
const writeJSON = (key, value) => localStorage.setItem(key, JSON.stringify(value));

// Money & number helpers
const toCents = (n) => Math.round(Number(n) * 100);
const fromCents = (c) => (c / 100);
const money = (c) => `$${fromCents(c).toFixed(2)}`;
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// ==== Rates ====
function loadRates(){
  const saved = readJSON(STORAGE_KEYS.rates, null);
  return saved ? saved : { ...DEFAULT_RATES };
}
function saveRates(rates){
  writeJSON(STORAGE_KEYS.rates, rates);
}

// ==== Rides ====
function loadRides(){ return readJSON(STORAGE_KEYS.rides, []); }
function saveRides(rides){ writeJSON(STORAGE_KEYS.rides, rides); }

// ==== Payouts & Commissions ====
function loadPayouts(){ return readJSON(STORAGE_KEYS.payouts, {}); }
function savePayouts(p){ writeJSON(STORAGE_KEYS.payouts, p); }

function loadCommissions(){ return readJSON(STORAGE_KEYS.commissions, []); }
function saveCommissions(cs){ writeJSON(STORAGE_KEYS.commissions, cs); }

// ==== UI Init ====
document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initSettings();
  initBooking();
  renderTables();

  // Clear history button (if present)
  $("#clearHistory") && $("#clearHistory").addEventListener("click", clearAllRides);
});

// ==== Tabs ====
function initTabs(){
  const tabs = $$(".tab");
  tabs.forEach(btn => {
    btn.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("is-active"));
      $$(".panel").forEach(p => p.classList.remove("is-active"));
      btn.classList.add("is-active");
      const id = btn.dataset.tab;
      $("#" + id)?.classList.add("is-active");
    });
  });
}

// ==== Settings ====
function initSettings(){
  const rates = loadRates();
  $("#taxRate") && ($("#taxRate").value = rates.taxRatePct);
  $("#commissionRate") && ($("#commissionRate").value = rates.commissionRatePct);
  $("#taxRateLabel") && ( $("#taxRateLabel").textContent = `${rates.taxRatePct}%` );

  $("#settingsForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const taxRatePct = Number($("#taxRate")?.value || DEFAULT_RATES.taxRatePct);
    const commissionRatePct = Number($("#commissionRate")?.value || DEFAULT_RATES.commissionRatePct);
    saveRates({ taxRatePct, commissionRatePct });
    $("#taxRateLabel") && ( $("#taxRateLabel").textContent = `${taxRatePct}%` );
    calcBookingSummary(); // reflect changes
    alert("Settings saved.");
  });

  $("#resetRates")?.addEventListener("click", () => {
    saveRates({ ...DEFAULT_RATES });
    $("#taxRate") && ($("#taxRate").value = DEFAULT_RATES.taxRatePct);
    $("#commissionRate") && ($("#commissionRate").value = DEFAULT_RATES.commissionRatePct);
    $("#taxRateLabel") && ( $("#taxRateLabel").textContent = `${DEFAULT_RATES.taxRatePct}%` );
    calcBookingSummary();
  });
}

// ==== Booking ====
function initBooking(){
  const form = $("#bookingForm");
  if (!form) return;

  form.addEventListener("input", calcBookingSummary);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = getBookingData();
    if(!data) return;

    const rides = loadRides();
    rides.push(data);
    saveRides(rides);

    // Update driver payouts ledger (unpaid until explicitly paid)
    const payouts = loadPayouts();
    const key = data.driverName.trim();
    payouts[key] = payouts[key] || { owedCents: 0 };
    payouts[key].owedCents += data.driverTakeCents;
    savePayouts(payouts);

    form.reset();
    calcBookingSummary();
    renderTables();
    alert("Ride booked.");
  });

  $("#resetBooking")?.addEventListener("click", calcBookingSummary);

  // --- Simulation buttons ---
  // Support either separate buttons or one unified button.
  if ($("#simulateLocal")) {
    $("#simulateLocal").addEventListener("click", runSimulation);
  }
  if ($("#simulateServer")) {
    $("#simulateServer").addEventListener("click", runServerSimulation);
  }
  // Backward-compat: single button #simulateRide prompts user which mode to use.
  if ($("#simulateRide")) {
    $("#simulateRide").addEventListener("click", () => {
      const choice = prompt("Simulation mode: type 'local' for browser-only or 'server' for backend-simulated rides.", "server");
      if (choice && choice.toLowerCase().startsWith("l")) runSimulation();
      else if (choice && choice.toLowerCase().startsWith("s")) runServerSimulation();
    });
  }

  calcBookingSummary();
}

// Local-only simulation (from original app.js)
function runSimulation() {
  const numRides = prompt("Enter the number of rides to simulate (1-100):", "10");
  if (numRides === null) return; // User cancelled

  const N = Number(numRides);
  if (isNaN(N) || N < 1 || N > 100) {
    alert("Please enter a valid number between 1 and 100.");
    return;
  }

  const newRides = [];
  const tempPayouts = {};

  // Load rates once outside the loop for efficiency
  const { taxRatePct, commissionRatePct } = loadRates();

  for (let i = 0; i < N; i++) {
    // 1. Generate random ride data
    const randomUser = randomPick(SIMULATION_POOL.users);
    const randomDriver = randomPick(SIMULATION_POOL.drivers);
    const randomPickup = randomPick(SIMULATION_POOL.pickups);
    const randomDropoff = randomPick(SIMULATION_POOL.dropoffs);
    const randomCategory = randomPick(SIMULATION_POOL.categories);
    const randomPayment = randomPick(SIMULATION_POOL.payments);
    const randomPrice = randomInt(10, 100);
    const now = new Date();
    const pastTime = new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000);
    const rideTimeISO = pastTime.toISOString();
    const baseCents = toCents(randomPrice);
    const taxCents = Math.round(baseCents * (taxRatePct / 100));
    const totalCents = baseCents + taxCents;
    const commissionCents = Math.round(baseCents * (commissionRatePct / 100));
    const driverTakeCents = baseCents - commissionCents; // driver paid from base only

    const rideData = {
      id: cryptoRandomId(),
      createdAt: rideTimeISO,
      userName: randomUser,
      driverName: randomDriver,
      pickup: randomPickup,
      dropoff: randomDropoff,
      category: randomCategory,
      paymentMethod: randomPayment,
      baseCents, taxCents, totalCents, commissionCents, driverTakeCents,
      notes: "Mass simulated ride.",
      status: "Booked"
    };

    newRides.push(rideData);

    const key = rideData.driverName.trim();
    tempPayouts[key] = tempPayouts[key] || { owedCents: 0 };
    tempPayouts[key].owedCents += rideData.driverTakeCents;
  }

  const existingRides = loadRides();
  const existingPayouts = loadPayouts();

  const finalRides = existingRides.concat(newRides);
  saveRides(finalRides);

  Object.entries(tempPayouts).forEach(([driverName, data]) => {
    existingPayouts[driverName] = existingPayouts[driverName] || { owedCents: 0 };
    existingPayouts[driverName].owedCents += data.owedCents;
  });
  savePayouts(existingPayouts);

  renderTables();
  alert("rides booked (local)");
}

function getBookingData(){
  const userName = $("#userName")?.value.trim();
  const driverName = $("#driverName")?.value.trim();
  const pickup = $("#pickup")?.value.trim();
  const dropoff = $("#dropoff")?.value.trim();
  const category = $("#category")?.value;
  const paymentMethod = $("#paymentMethod")?.value;
  const rideTime = $("#rideTime")?.value;
  const basePrice = Number($("#basePrice")?.value);

  if(!userName || !driverName || !pickup || !dropoff || !category || !paymentMethod || !rideTime || isNaN(basePrice)){
    alert("Please complete all required fields.");
    return null;
  }

  const { taxRatePct, commissionRatePct } = loadRates();
  const baseCents = toCents(basePrice);
  const taxCents = Math.round(baseCents * (taxRatePct / 100));
  const totalCents = baseCents + taxCents;
  const commissionCents = Math.round(baseCents * (commissionRatePct / 100));
  const driverTakeCents = baseCents - commissionCents; // driver paid from base only

  return {
    id: cryptoRandomId(),
    createdAt: new Date(rideTime).toISOString(),
    userName, driverName, pickup, dropoff, category, paymentMethod,
    baseCents, taxCents, totalCents, commissionCents, driverTakeCents,
    notes: $("#notes")?.value.trim() || "",
    status: "Booked" // could evolve to Completed/Canceled
  };
}

function calcBookingSummary(){
  const basePrice = Number($("#basePrice")?.value || 0);
  const { taxRatePct } = loadRates();
  const tax = basePrice * (taxRatePct / 100);
  $("#taxRateLabel") && ( $("#taxRateLabel").textContent = `${taxRatePct}%` );
  $("#taxAmount") && ( $("#taxAmount").textContent = `$${tax.toFixed(2)}` );
  $("#totalAmount") && ( $("#totalAmount").textContent = `$${(basePrice + tax).toFixed(2)}` );
}

// ==== Render tables ====
function renderTables(){
  renderHistory();
  renderPayouts();
  renderCommissions();
}

function renderHistory(){
  const rides = loadRides().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  const tbody = $("#ridesTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const fUser = ($("#filterUser")?.value || "").toLowerCase();
  const fDriver = ($("#filterDriver")?.value || "").toLowerCase();
  const fCat = $("#filterCategory")?.value || "";

  rides
    .filter(r => (!fUser || r.userName.toLowerCase().includes(fUser)))
    .filter(r => (!fDriver || r.driverName.toLowerCase().includes(fDriver)))
    .filter(r => (!fCat || r.category === fCat))
    .forEach(r => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${formatDateTime(r.createdAt)}</td>
        <td>${escapeHTML(r.userName)}</td>
        <td>${escapeHTML(r.driverName)}</td>
        <td><span class="muted">${escapeHTML(r.pickup)}</span> → <span class="muted">${escapeHTML(r.dropoff)}</span></td>
        <td>${r.category}</td>
        <td>${r.paymentMethod}</td>
        <td>${money(r.baseCents)}</td>
        <td>${money(r.taxCents)}</td>
        <td>${money(r.totalCents)}</td>
        <td>${badge(r.status)}</td>
      `;
      tbody.appendChild(tr);
    });

  $("#filterUser") && ($("#filterUser").oninput = renderHistory);
  $("#filterDriver") && ($("#filterDriver").oninput = renderHistory);
  $("#filterCategory") && ($("#filterCategory").onchange = renderHistory);
  $("#clearFilters") && ($("#clearFilters").onclick = () => {
    if ($("#filterUser")) $("#filterUser").value = "";
    if ($("#filterDriver")) $("#filterDriver").value = "";
    if ($("#filterCategory")) $("#filterCategory").value = "";
    renderHistory();
  });
}

function clearAllRides() {
  const isConfirmed = confirm("This will permanently delete all ride history data. Are you sure?");
  if (isConfirmed) {
    localStorage.removeItem(STORAGE_KEYS.rides);
    localStorage.removeItem(STORAGE_KEYS.payouts);
    localStorage.removeItem(STORAGE_KEYS.commissions);
    renderTables();
  }
}

function renderPayouts(){
  const payouts = loadPayouts();
  const tbody = $("#payoutTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  Object.entries(payouts).forEach(([driver, obj]) => {
    const tr = document.createElement("tr");
    const unpaidRides = countUnpaidRidesForDriver(driver);
    tr.innerHTML = `
      <td>${escapeHTML(driver)}</td>
      <td>${unpaidRides}</td>
      <td>${money(obj.owedCents || 0)}</td>
      <td><button class="btn" data-pay="${escapeHTML(driver)}">Pay</button></td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("[data-pay]").forEach(btn => {
    btn.addEventListener("click", () => {
      const name = btn.dataset.pay;
      payDriver(name);
    });
  });

  $("#btnPayDriver") && ($("#btnPayDriver").onclick = () => {
    const name = $("#payoutDriver")?.value.trim();
    if(!name) return alert("Enter a driver name.");
    payDriver(name);
  });
}

function renderCommissions(){
  const rows = loadCommissions().slice(-20).reverse(); // latest 20
  const tbody = $("#commissionTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  rows.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHTML(r.periodKey)}</td>
      <td>${r.rides}</td>
      <td>${money(r.amountCents)}</td>
      <td><button class="btn ghost" data-view="${escapeHTML(r.periodKey)}">View</button></td>
    `;
    tbody.appendChild(tr);
  });

  $("#btnRunCommission") && ($("#btnRunCommission").onclick = () => {
    const period = $("#commissionPeriod")?.value;
    const res = calculateCommission(period);
    if(res.rides === 0){ alert("No rides in selected period."); return; }
    const all = loadCommissions();
    all.push(res);
    saveCommissions(all);
    renderCommissions();
    alert(`Commission for ${res.periodKey}: ${money(res.amountCents)} across ${res.rides} ride(s).`);
  });
}

// ==== Actions (mock backend) ====
function payDriver(driverName){
  const payouts = loadPayouts();
  const owed = payouts[driverName]?.owedCents || 0;
  if(!owed){ alert(`No outstanding payouts for ${driverName}.`); return; }

  // Mark payout as paid (zero owed), and mark rides as paid
  payouts[driverName].owedCents = 0;
  savePayouts(payouts);

  // Optionally flag rides as "Paid to Driver"
  const rides = loadRides().map(r => {
    if(r.driverName === driverName && r.driverTakeCents > 0 && r.status === "Booked"){
      return { ...r, status: "PaidToDriver" };
    }
    return r;
  });
  saveRides(rides);

  renderTables();
  alert(`Paid ${driverName} ${money(owed)}.`);
}

function calculateCommission(period){
  const now = new Date();
  let start = new Date(0);
  let key = "All time";

  if(period === "today"){
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    key = `Today ${formatDate(now)}`;
  } else if(period === "7d"){
    start = new Date(now); start.setDate(now.getDate() - 7);
    key = "Last 7 days";
  } else if(period === "30d"){
    start = new Date(now); start.setDate(now.getDate() - 30);
    key = "Last 30 days";
  }

  const rides = loadRides().filter(r => new Date(r.createdAt) >= start);
  const ridesCount = rides.length;
  const commissionCents = rides.reduce((sum, r) => sum + (r.commissionCents || 0), 0);
  return {
    periodKey: key,
    rides: ridesCount,
    amountCents: commissionCents,
    createdAt: new Date().toISOString()
  };
}

// ==== Utilities ====
function formatDateTime(iso){
  const d = new Date(iso);
  return d.toLocaleString(undefined, { year:"numeric", month:"short", day:"2-digit", hour:"2-digit", minute:"2-digit" });
}
function formatDate(d){
  return d.toLocaleDateString(undefined, { year:"numeric", month:"short", day:"2-digit" });
}
function badge(status){
  const map = {
    "Booked":"badge pending",
    "PaidToDriver":"badge success",
    "Canceled":"badge failed"
  };
  const cls = map[status] || "badge";
  return `<span class="${cls}">${status}</span>`;
}
function escapeHTML(s){
  return (s ?? "").toString().replace(/[&<>"']/g, (m)=>({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[m]));
}
function cryptoRandomId(){
  // short random id
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2,"0")).join("");
}
function countUnpaidRidesForDriver(driver){
  const rides = loadRides();
  return rides.filter(r => r.driverName === driver && r.status === "Booked").length;
}

// ---- Server-side report wiring & helpers (from app_new.js) ----
function q$(sel){ return document.querySelector(sel); }
async function fetchJSON(url){
  const r = await fetch(url);
  if(!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
function qsDates(startSel, endSel){
  const sEl = q$(startSel), eEl = q$(endSel);
  const qs = new URLSearchParams();
  if (sEl && sEl.value) qs.set("start", sEl.value);
  if (eEl && eEl.value) qs.set("end", eEl.value);
  const str = qs.toString();
  return str ? `?${str}` : "";
}
function setRows(tbodySel, rowsHtml){
  const el = q$(`${tbodySel} tbody`) || q$(tbodySel);
  if (el) el.innerHTML = rowsHtml || "";
}

// Reuse global money() and escapeHTML()

async function runReportCommission(){
  try{
    const rows = await fetchJSON(`/api/reports/commission-by-day-category${qsDates("#r1Start","#r1End")}`);
    const html = rows.map(r => `
      <tr>
        <td>${escapeHTML(r.day)}</td>
        <td>${escapeHTML(r.category_name)}</td>
        <td>${r.rides}</td>
        <td>${money(r.base_cents)}</td>
        <td>${money(r.commission_cents)}</td>
        <td>${money(r.tax_cents)}</td>
        <td>${money(r.total_cents)}</td>
      </tr>
    `).join("");
    setRows("#tblReportCommission", html);
  } catch(e){ alert(`Failed to load report: ${e.message}`); }
}

async function runReportRidesPerDriver(){
  try{
    const rows = await fetchJSON(`/api/reports/rides-per-driver-per-day${qsDates("#r2Start","#r2End")}`);
    const html = rows.map(r => `
      <tr>
        <td>${escapeHTML(r.day)}</td>
        <td>${escapeHTML(r.driver)}</td>
        <td>${r.rides}</td>
        <td>${money(r.gross_cents)}</td>
      </tr>
    `).join("");
    setRows("#tblReportRidesPerDriver", html);
  } catch(e){ alert(`Failed to load report: ${e.message}`); }
}

async function runReportOutstanding(){
  try{
    const rows = await fetchJSON(`/api/reports/outstanding-payouts${qsDates("#r3Start","#r3End")}`);
    const html = rows.map(r => `
      <tr>
        <td>${escapeHTML(r.driver)}</td>
        <td>${r.rides}</td>
        <td>${money(r.owed_cents)}</td>
      </tr>
    `).join("");
    setRows("#tblReportOutstanding", html);
  } catch(e){ alert(`Failed to load report: ${e.message}`); }
}

async function adminFetch(url, options = {}) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

// Populate table dropdown on load / when Admin tab is opened
async function loadAdminTables() {
  const sel = document.getElementById('admin-table');
  if (!sel) return;
  sel.innerHTML = '<option value="">Loading…</option>';
  try {
    const data = await adminFetch('/api/admin/tables');
    sel.innerHTML = '<option value="">Select a table…</option>';
    (data.tables || []).forEach(t => {
      const opt = document.createElement('option');
      opt.value = t; opt.textContent = t;
      sel.appendChild(opt);
    });
  } catch (e) {
    sel.innerHTML = `<option value="">(Failed to load tables)</option>`;
    adminPrint(e.message, true);
  }
}

function adminPrint(msg, isError = false) {
  const out = document.getElementById('admin-output');
  if (!out) return;
  const pre = document.createElement('pre');
  pre.textContent = (typeof msg === 'string') ? msg : JSON.stringify(msg, null, 2);
  pre.className = isError ? 'error' : 'ok';
  out.prepend(pre);
}

async function onCreateTables() {
  try {
    const data = await adminFetch('/api/admin/create-tables', { method: 'POST', body: JSON.stringify({}) });
    adminPrint(data);
    await loadAdminTables();
  } catch (e) {
    adminPrint(e.message, true);
  }
}

async function onInitLookups() {
  try {
    const data = await adminFetch('/api/admin/init-lookups', { method: 'POST', body: JSON.stringify({}) });
    adminPrint(data);
  } catch (e) {
    adminPrint(e.message, true);
  }
}

async function onTruncate() {
  const onlyNonLookup = document.getElementById('admin-only-nonlookup')?.checked ?? true;
  try {
    const data = await adminFetch('/api/admin/truncate', { method: 'POST', body: JSON.stringify({ onlyNonLookup }) });
    adminPrint(data);
  } catch (e) {
    adminPrint(e.message, true);
  }
}

async function onBrowse() {
  const table = document.getElementById('admin-table')?.value || '';
  const limit = document.getElementById('admin-limit')?.value || '10';
  if (!table) return adminPrint('Pick a table first.', true);
  try {
    const data = await adminFetch(`/api/admin/browse?table=${encodeURIComponent(table)}&limit=${encodeURIComponent(limit)}`);
    adminPrint(data);
  } catch (e) {
    adminPrint(e.message, true);
  }
}

function onDownloadTrace(type) {
  if (type !== 'transaction' && type !== 'query') return;
  window.location.href = `/api/admin/download/${type}.sql`;
}

async function onClearTraces() {
  try {
    const data = await adminFetch('/api/admin/clear-traces', { method: 'POST', body: JSON.stringify({}) });
    adminPrint(data);
  } catch (e) {
    adminPrint(e.message, true);
  }
}

// --- Hook up events once the DOM is ready ---
document.addEventListener('DOMContentLoaded', () => {
  // If you show Admin by default or behind a tab, call loadAdminTables() when visible.
  loadAdminTables();

  document.getElementById('btn-create-tables')?.addEventListener('click', onCreateTables);
  document.getElementById('btn-init-lookups')?.addEventListener('click', onInitLookups);
  document.getElementById('btn-truncate')?.addEventListener('click', onTruncate);
  document.getElementById('btn-browse')?.addEventListener('click', onBrowse);
  document.getElementById('btn-dl-transaction')?.addEventListener('click', () => onDownloadTrace('transaction'));
  document.getElementById('btn-dl-query')?.addEventListener('click', () => onDownloadTrace('query'));
  document.getElementById('btn-clear-traces')?.addEventListener('click', onClearTraces);
});


// Attach listeners once DOM is ready
(function(){
  if (document.readyState !== "loading") ready(); else document.addEventListener("DOMContentLoaded", ready);
  function ready(){
    q$("#btnReportCommission") && q$("#btnReportCommission").addEventListener("click", runReportCommission);
    q$("#btnReportRidesPerDriver") && q$("#btnReportRidesPerDriver").addEventListener("click", runReportRidesPerDriver);
    q$("#btnReportOutstanding") && q$("#btnReportOutstanding").addEventListener("click", runReportOutstanding);
  }
})();

/* ==== Server-backed Simulation (hits /api/book) ==== */
async function runServerSimulation(){
  try{
    const numRides = prompt("Enter number of rides to simulate on the server (1-50):", "10");
    if (numRides === null) return;
    const N = Number(numRides);
    if (isNaN(N) || N < 1 || N > 50) { alert("Please enter a number between 1 and 50."); return; }

    // Fetch available drivers
    const drvRes = await fetch("/api/drivers/available");
    if(!drvRes.ok){ alert("Failed to load drivers"); return; }
    const drivers = await drvRes.json();
    if(!Array.isArray(drivers) || drivers.length === 0){
      alert("No available drivers found. Please add drivers or mark some as available.");
      return;
    }

    // Static pools (server-mode: no PII-ish names)
    const categories = ["Standard","XL","Executive"];
    const streets = [
      "100 Main St", "200 Oak Ave", "15 Market St", "22 Pine Rd", "301 Cedar Blvd",
      "950 Lakeview Dr", "77 Sunset Way", "1200 River Rd", "18 Maple Ln", "45 Broadway"
    ];
    const cities = ["Springfield","Hill Valley","Sunnydale","River City","Fairview"];
    function rand(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
    function randomAddress(){ return `${rand(streets)}, ${rand(cities)}`; }
    function randomName(){ return `User ${Math.floor(100000 + Math.random()*900000)}`; }
    function randomBase(){ return (8 + Math.random()*32).toFixed(2); } // $8 - $40
    function randomTime(){
      const now = new Date();
      const deltaMin = Math.floor(Math.random() * 7 * 24 * 60); // past 7 days
      const t = new Date(now.getTime() - deltaMin*60000);
      return new Date(t.getTime() + Math.floor(Math.random()*60)*60000).toISOString(); // slight jitter
    }

    let ok = 0, fail = 0;
    for (let i=0;i<N;i++){
      const d = rand(drivers);
      const payload = {
        userName: randomName(),
        driverId: d.driver_id,
        pickup: randomAddress(),
        dropoff: randomAddress(),
        category: rand(categories),
        paymentMethod: "Cash", // avoids needing a saved card/bank account
        rideTime: randomTime(),
        basePrice: randomBase()
      };

      try{
        const r = await fetch("/api/book", {
          method: "POST",
          headers: {"Content-Type":"application/json"},
          body: JSON.stringify(payload)
        });
        if(!r.ok){
          fail++;
        }else{
          const j = await r.json();
          if (j && j.ok) ok++; else fail++;
        }
      }catch(e){
        fail++;
      }
    }

    alert(`Server simulation complete.\nSuccess: ${ok}\nFailed: ${fail}`);
    // Optionally refresh any client tables that read from the server (if present in UI)
  }catch(e){
    alert("Simulation failed: " + e.message);
  }
}
