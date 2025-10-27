/* ------------------------------
 * Simple Ride Platform Starter
 * Storage: localStorage (replace with real API)
 * ------------------------------ */

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

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* ---------- Storage helpers ---------- */
const readJSON = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
};
const writeJSON = (key, value) => localStorage.setItem(key, JSON.stringify(value));

/* ---------- Money helpers ---------- */
const toCents = (n) => Math.round(Number(n) * 100);
const fromCents = (c) => (c / 100);
const money = (c) => `$${fromCents(c).toFixed(2)}`;

/* ---------- Rates ---------- */
function loadRates(){
  const saved = readJSON(STORAGE_KEYS.rates, null);
  return saved ? saved : { ...DEFAULT_RATES };
}
function saveRates(rates){
  writeJSON(STORAGE_KEYS.rates, rates);
}

/* ---------- Rides ---------- */
function loadRides(){ return readJSON(STORAGE_KEYS.rides, []); }
function saveRides(rides){ writeJSON(STORAGE_KEYS.rides, rides); }

/* ---------- Payouts & Commissions ---------- */
function loadPayouts(){ return readJSON(STORAGE_KEYS.payouts, {}); }
function savePayouts(p){ writeJSON(STORAGE_KEYS.payouts, p); }

function loadCommissions(){ return readJSON(STORAGE_KEYS.commissions, []); }
function saveCommissions(cs){ writeJSON(STORAGE_KEYS.commissions, cs); }

/* ---------- UI Init ---------- */
document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initSettings();
  initBooking();
  renderTables();
});

/* ---------- Tabs ---------- */
function initTabs(){
  const tabs = $$(".tab");
  tabs.forEach(btn => {
    btn.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("is-active"));
      $$(".panel").forEach(p => p.classList.remove("is-active"));
      btn.classList.add("is-active");
      const id = btn.dataset.tab;
      $("#" + id).classList.add("is-active");
    });
  });
}

/* ---------- Settings ---------- */
function initSettings(){
  const rates = loadRates();
  $("#taxRate").value = rates.taxRatePct;
  $("#commissionRate").value = rates.commissionRatePct;
  $("#taxRateLabel").textContent = `${rates.taxRatePct}%`;

  $("#settingsForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const taxRatePct = Number($("#taxRate").value || DEFAULT_RATES.taxRatePct);
    const commissionRatePct = Number($("#commissionRate").value || DEFAULT_RATES.commissionRatePct);
    saveRates({ taxRatePct, commissionRatePct });
    $("#taxRateLabel").textContent = `${taxRatePct}%`;
    calcBookingSummary(); // reflect changes
    alert("Settings saved.");
  });

  $("#resetRates").addEventListener("click", () => {
    saveRates({ ...DEFAULT_RATES });
    $("#taxRate").value = DEFAULT_RATES.taxRatePct;
    $("#commissionRate").value = DEFAULT_RATES.commissionRatePct;
    $("#taxRateLabel").textContent = `${DEFAULT_RATES.taxRatePct}%`;
    calcBookingSummary();
  });
}

/* ---------- Booking ---------- */
function initBooking(){
  const form = $("#bookingForm");
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

  $("#resetBooking").addEventListener("click", calcBookingSummary);
  calcBookingSummary();
}

function getBookingData(){
  const userName = $("#userName").value.trim();
  const driverName = $("#driverName").value.trim();
  const pickup = $("#pickup").value.trim();
  const dropoff = $("#dropoff").value.trim();
  const category = $("#category").value;
  const paymentMethod = $("#paymentMethod").value;
  const rideTime = $("#rideTime").value;
  const basePrice = Number($("#basePrice").value);

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
    notes: $("#notes").value.trim(),
    status: "Booked" // could evolve to Completed/Canceled
  };
}

function calcBookingSummary(){
  const basePrice = Number($("#basePrice").value || 0);
  const { taxRatePct } = loadRates();
  const tax = basePrice * (taxRatePct / 100);
  $("#taxRateLabel").textContent = `${taxRatePct}%`;
  $("#taxAmount").textContent = `$${tax.toFixed(2)}`;
  $("#totalAmount").textContent = `$${(basePrice + tax).toFixed(2)}`;
}

/* ---------- Render tables ---------- */
function renderTables(){
  renderHistory();
  renderPayouts();
  renderCommissions();
}

function renderHistory(){
  const rides = loadRides().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  const tbody = $("#ridesTable tbody");
  tbody.innerHTML = "";

  const fUser = $("#filterUser").value?.toLowerCase() || "";
  const fDriver = $("#filterDriver").value?.toLowerCase() || "";
  const fCat = $("#filterCategory").value || "";

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

  $("#filterUser").oninput = renderHistory;
  $("#filterDriver").oninput = renderHistory;
  $("#filterCategory").onchange = renderHistory;
  $("#clearFilters").onclick = () => {
    $("#filterUser").value = "";
    $("#filterDriver").value = "";
    $("#filterCategory").value = "";
    renderHistory();
  };
}

function renderPayouts(){
  const payouts = loadPayouts();
  const tbody = $("#payoutTable tbody");
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

  $("#btnPayDriver").onclick = () => {
    const name = $("#payoutDriver").value.trim();
    if(!name) return alert("Enter a driver name.");
    payDriver(name);
  };
}

function renderCommissions(){
  const rows = loadCommissions().slice(-20).reverse(); // latest 20
  const tbody = $("#commissionTable tbody");
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

  $("#btnRunCommission").onclick = () => {
    const period = $("#commissionPeriod").value;
    const res = calculateCommission(period);
    if(res.rides === 0){ alert("No rides in selected period."); return; }
    const all = loadCommissions();
    all.push(res);
    saveCommissions(all);
    renderCommissions();
    alert(`Commission for ${res.periodKey}: ${money(res.amountCents)} across ${res.rides} ride(s).`);
  };
}

/* ---------- Actions (mock backend) ---------- */
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

/* ---------- Utilities ---------- */
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
  return s.replace(/[&<>"']/g, (m)=>({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[m]));
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

/* ---------- Wire finance action handlers (after render) ---------- */
$("#btnRunCommission")?.addEventListener("click", ()=>{}); // bound in renderCommissions
