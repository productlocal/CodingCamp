/* ============================================================
   BudgetViz – Expense & Budget Visualizer
   app.js  –  Vanilla JS, localStorage only
   ============================================================ */

'use strict';

/* ── Constants ──────────────────────────────────────────── */
const CATEGORIES = [
  { id: 'Food',          label: 'Makanan',       icon: '🍔', color: '#f97316' },
  { id: 'Transport',     label: 'Transportasi',  icon: '🚗', color: '#3b82f6' },
  { id: 'Entertainment', label: 'Hiburan',       icon: '🎮', color: '#a855f7' },
  { id: 'Health',        label: 'Kesehatan',     icon: '💊', color: '#22c55e' },
  { id: 'Shopping',      label: 'Belanja',       icon: '🛍️', color: '#ec4899' },
  { id: 'Education',     label: 'Pendidikan',    icon: '📚', color: '#14b8a6' },
  { id: 'Other',         label: 'Lainnya',       icon: '📦', color: '#94a3b8' },
];
const LS_EXPENSES = 'budgetviz_expenses';
const LS_BUDGETS  = 'budgetviz_budgets';

/* ── State ──────────────────────────────────────────────── */
let currentPage   = 'dashboard';
let currentMonth  = toMonthKey(new Date());   // 'YYYY-MM'
let pendingDelete = null;    // { type: 'expense'|'all', id? }

/* ── LocalStorage helpers ───────────────────────────────── */
function loadExpenses() {
  try { return JSON.parse(localStorage.getItem(LS_EXPENSES)) || []; }
  catch { return []; }
}
function saveExpenses(data) { localStorage.setItem(LS_EXPENSES, JSON.stringify(data)); }

function loadBudgets() {
  try { return JSON.parse(localStorage.getItem(LS_BUDGETS)) || {}; }
  catch { return {}; }
}
function saveBudgets(data) { localStorage.setItem(LS_BUDGETS, JSON.stringify(data)); }

/* ── Date / format helpers ──────────────────────────────── */
function toMonthKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}
function monthLabel(key) {
  const [y, m] = key.split('-');
  return new Date(+y, +m - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
}
function formatRp(n) {
  return 'Rp ' + Math.abs(n).toLocaleString('id-ID');
}
function formatDate(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}
function getCat(id) { return CATEGORIES.find(c => c.id === id) || CATEGORIES[6]; }

/* ── Navigation ─────────────────────────────────────────── */
function showPage(name) {
  currentPage = name;
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  document.getElementById(`page-${name}`).classList.remove('hidden');
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.page === name);
  });
  // Close sidebar on mobile
  document.getElementById('sidebar').classList.remove('open');
  renderPage();
}

function renderPage() {
  if (currentPage === 'dashboard')    renderDashboard();
  if (currentPage === 'transactions') renderTransactions();
  if (currentPage === 'budgets')      renderBudgets();
}

/* ── Month navigation ───────────────────────────────────── */
function changeMonth(delta) {
  const [y, m] = currentMonth.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  currentMonth = toMonthKey(d);
  syncMonthLabels();
  renderPage();
}
function syncMonthLabels() {
  const lbl = monthLabel(currentMonth);
  document.getElementById('monthLabel').textContent        = lbl;
  document.getElementById('monthLabelDesktop').textContent = lbl;
  const budgetLbl = document.getElementById('budgetMonthLabel');
  if (budgetLbl) budgetLbl.textContent = lbl;
}

/* ── Dashboard ──────────────────────────────────────────── */
function renderDashboard() {
  const expenses = loadExpenses().filter(e => e.date.startsWith(currentMonth));
  const budgets  = loadBudgets()[currentMonth] || {};

  const totalExp = expenses.reduce((s, e) => s + e.amount, 0);
  const totalBud = CATEGORIES.reduce((s, c) => s + (budgets[c.id] || 0), 0);
  const remaining = totalBud - totalExp;

  // Cards
  document.getElementById('totalExpense').textContent    = formatRp(totalExp);
  document.getElementById('totalBudget').textContent     = formatRp(totalBud);
  document.getElementById('transactionCount').textContent = expenses.length;

  const remEl = document.getElementById('remainingBudget');
  remEl.textContent = (remaining < 0 ? '-' : '') + formatRp(remaining);
  remEl.className = 'card-value ' + (remaining < 0 ? 'over-budget' : 'on-budget');

  // Progress bar
  const pct = totalBud > 0 ? Math.min((totalExp / totalBud) * 100, 100) : 0;
  const fill = document.getElementById('progressBarFill');
  fill.style.width = pct + '%';
  fill.className = 'progress-bar-fill' + (pct >= 100 ? ' danger' : pct >= 80 ? ' warning' : '');
  document.getElementById('progressPercent').textContent =
    totalBud > 0 ? Math.round((totalExp / totalBud) * 100) + '%' : '—';

  renderBarChart(expenses, budgets);
  renderPieChart(expenses);
  renderCategoryTable(expenses, budgets);
}

/* ── Bar Chart (Budget vs Expense) ─────────────────────── */
function renderBarChart(expenses, budgets) {
  const canvas  = document.getElementById('barChart');
  const emptyEl = document.getElementById('barChartEmpty');
  const ctx     = canvas.getContext('2d');

  const totals = {};
  CATEGORIES.forEach(c => { totals[c.id] = 0; });
  expenses.forEach(e => { totals[e.category] = (totals[e.category] || 0) + e.amount; });

  const hasData = CATEGORIES.some(c => totals[c.id] > 0 || budgets[c.id] > 0);
  canvas.classList.toggle('hidden', !hasData);
  emptyEl.style.display = hasData ? 'none' : 'block';
  if (!hasData) return;

  const dpr = window.devicePixelRatio || 1;
  const w   = canvas.offsetWidth  || canvas.parentElement.offsetWidth  || 400;
  const h   = canvas.offsetHeight || 220;
  canvas.width  = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);

  const padL = 70, padR = 20, padT = 20, padB = 50;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;

  ctx.clearRect(0, 0, w, h);

  const maxVal = Math.max(
    ...CATEGORIES.map(c => Math.max(totals[c.id] || 0, budgets[c.id] || 0)),
    1
  );

  const groupW  = chartW / CATEGORIES.length;
  const barW    = Math.max(6, Math.min(18, groupW * 0.35));
  const gap     = 3;

  // Grid lines
  ctx.strokeStyle = '#e2e6ea';
  ctx.lineWidth   = 1;
  [0.25, 0.5, 0.75, 1].forEach(frac => {
    const y = padT + chartH * (1 - frac);
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + chartW, y); ctx.stroke();
    ctx.fillStyle = '#9ca3af'; ctx.font = '10px Segoe UI, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(formatRpShort(maxVal * frac), padL - 6, y + 4);
  });

  CATEGORIES.forEach((cat, i) => {
    const cx    = padL + groupW * i + groupW / 2;
    const budH  = ((budgets[cat.id] || 0) / maxVal) * chartH;
    const expH  = ((totals[cat.id]  || 0) / maxVal) * chartH;

    // Budget bar (light tint)
    ctx.fillStyle = cat.color + '33';
    ctx.fillRect(cx - barW - gap / 2, padT + chartH - budH, barW, budH);

    // Expense bar
    ctx.fillStyle = cat.color;
    ctx.fillRect(cx + gap / 2,        padT + chartH - expH, barW, expH);

    // Category icon label
    ctx.fillStyle = '#6b7280'; ctx.font = '10px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(cat.icon, cx, padT + chartH + 16);
    ctx.fillText(cat.id.slice(0,5), cx, padT + chartH + 28);
  });

  // Legend
  drawLegendDot(ctx, padL, h - 12, '#94a3b833', 'Anggaran');
  drawLegendDot(ctx, padL + 90, h - 12, '#4f46e5', 'Pengeluaran');
}

function drawLegendDot(ctx, x, y, color, label) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#6b7280'; ctx.font = '11px Segoe UI, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(label, x + 10, y + 4);
}

function formatRpShort(n) {
  if (n >= 1e6) return 'Rp ' + (n / 1e6).toFixed(1) + 'jt';
  if (n >= 1e3) return 'Rp ' + (n / 1e3).toFixed(0) + 'rb';
  return 'Rp ' + n;
}

/* ── Pie Chart ──────────────────────────────────────────── */
function renderPieChart(expenses) {
  const canvas  = document.getElementById('pieChart');
  const emptyEl = document.getElementById('pieChartEmpty');
  const legendEl= document.getElementById('pieLegend');
  const ctx     = canvas.getContext('2d');

  const totals = {};
  CATEGORIES.forEach(c => { totals[c.id] = 0; });
  expenses.forEach(e => { totals[e.category] = (totals[e.category] || 0) + e.amount; });
  const total = Object.values(totals).reduce((s, v) => s + v, 0);

  const hasData = total > 0;
  canvas.classList.toggle('hidden', !hasData);
  emptyEl.style.display = hasData ? 'none' : 'block';
  legendEl.innerHTML = '';
  if (!hasData) return;

  const dpr  = window.devicePixelRatio || 1;
  const size = Math.min(canvas.parentElement.offsetWidth || 200, 190);
  canvas.width  = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width  = size + 'px';
  canvas.style.height = size + 'px';
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, size, size);

  const cx = size / 2, cy = size / 2, r = size / 2 - 8;
  let startAngle = -Math.PI / 2;

  CATEGORIES.forEach(cat => {
    if (!totals[cat.id]) return;
    const slice = (totals[cat.id] / total) * 2 * Math.PI;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, startAngle, startAngle + slice);
    ctx.closePath();
    ctx.fillStyle = cat.color;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    startAngle += slice;
  });

  // Centre donut hole
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.52, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // Total text in centre
  ctx.fillStyle = '#1a1d23';
  ctx.font = `bold ${Math.round(size * 0.09)}px Segoe UI, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(formatRpShort(total), cx, cy);

  // Legend
  CATEGORIES.forEach(cat => {
    if (!totals[cat.id]) return;
    const pct = Math.round((totals[cat.id] / total) * 100);
    const item = document.createElement('div');
    item.className = 'pie-legend-item';
    item.innerHTML = `<span class="pie-legend-dot" style="background:${cat.color}"></span>
      <span>${cat.icon} ${cat.label} (${pct}%)</span>`;
    legendEl.appendChild(item);
  });
}

/* ── Category Table ─────────────────────────────────────── */
function renderCategoryTable(expenses, budgets) {
  const totals = {};
  CATEGORIES.forEach(c => { totals[c.id] = 0; });
  expenses.forEach(e => { totals[e.category] = (totals[e.category] || 0) + e.amount; });

  const tbody   = document.getElementById('categoryTableBody');
  const emptyEl = document.getElementById('categoryTableEmpty');
  const hasData = CATEGORIES.some(c => totals[c.id] > 0 || budgets[c.id] > 0);

  document.getElementById('categoryTable').style.display = hasData ? '' : 'none';
  emptyEl.style.display = hasData ? 'none' : 'block';
  tbody.innerHTML = '';

  CATEGORIES.forEach(cat => {
    const exp = totals[cat.id] || 0;
    const bud = budgets[cat.id] || 0;
    if (exp === 0 && bud === 0) return;
    const rem = bud - exp;
    const pct = bud > 0 ? Math.round((exp / bud) * 100) : null;

    let statusClass, statusLabel;
    if (bud === 0)        { statusClass = 'no-budget'; statusLabel = 'Tidak ada anggaran'; }
    else if (pct >= 100)  { statusClass = 'danger';    statusLabel = 'Melebihi anggaran'; }
    else if (pct >= 80)   { statusClass = 'warn';      statusLabel = `${pct}% terpakai`; }
    else                  { statusClass = 'ok';        statusLabel = `${pct}% terpakai`; }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="cat-badge cat-${cat.id}">${cat.icon} ${cat.label}</span></td>
      <td>${bud > 0 ? formatRp(bud) : '—'}</td>
      <td>${formatRp(exp)}</td>
      <td style="color:${rem < 0 ? 'var(--danger)' : 'var(--success)'}">${bud > 0 ? (rem < 0 ? '-' : '') + formatRp(rem) : '—'}</td>
      <td><span class="status-chip ${statusClass}">${statusLabel}</span></td>`;
    tbody.appendChild(tr);
  });
}

/* ── Transactions Page ──────────────────────────────────── */
function renderTransactions() {
  const search   = document.getElementById('searchInput').value.toLowerCase();
  const catFilter= document.getElementById('filterCategory').value;
  const sortBy   = document.getElementById('sortBy').value;

  let expenses = loadExpenses().filter(e => e.date.startsWith(currentMonth));

  if (search)    expenses = expenses.filter(e => e.description.toLowerCase().includes(search));
  if (catFilter) expenses = expenses.filter(e => e.category === catFilter);

  expenses.sort((a, b) => {
    if (sortBy === 'date-desc')   return b.date.localeCompare(a.date);
    if (sortBy === 'date-asc')    return a.date.localeCompare(b.date);
    if (sortBy === 'amount-desc') return b.amount - a.amount;
    if (sortBy === 'amount-asc')  return a.amount - b.amount;
    return 0;
  });

  const list    = document.getElementById('transactionList');
  const emptyEl = document.getElementById('transactionEmpty');
  list.innerHTML = '';
  emptyEl.style.display = expenses.length === 0 ? 'block' : 'none';

  expenses.forEach(e => {
    const cat  = getCat(e.category);
    const item = document.createElement('div');
    item.className = 'transaction-item';
    item.innerHTML = `
      <div class="tx-cat-dot bg-cat-${cat.id}" style="color:${cat.color}">${cat.icon}</div>
      <div class="tx-body">
        <div class="tx-desc">${e.description || cat.label}</div>
        <div class="tx-meta">
          <span>${formatDate(e.date)}</span>
          <span class="cat-badge cat-${cat.id}" style="font-size:.72rem;padding:2px 7px">${cat.label}</span>
        </div>
      </div>
      <div class="tx-amount">- ${formatRp(e.amount)}</div>
      <div class="tx-actions">
        <button class="btn-icon" title="Edit" onclick="openEditModal('${e.id}')">✏️</button>
        <button class="btn-icon delete" title="Hapus" onclick="confirmDelete('expense','${e.id}')">🗑</button>
      </div>`;
    list.appendChild(item);
  });
}

/* ── Budget Page ────────────────────────────────────────── */
function renderBudgets() {
  document.getElementById('budgetMonthLabel').textContent = monthLabel(currentMonth);

  const budgets  = loadBudgets()[currentMonth] || {};
  const expenses = loadExpenses().filter(e => e.date.startsWith(currentMonth));
  const totals   = {};
  CATEGORIES.forEach(c => { totals[c.id] = 0; });
  expenses.forEach(e => { totals[e.category] = (totals[e.category] || 0) + e.amount; });

  const grid = document.getElementById('budgetGrid');
  grid.innerHTML = '';

  CATEGORIES.forEach(cat => {
    const bud = budgets[cat.id] || 0;
    const exp = totals[cat.id] || 0;
    const pct = bud > 0 ? Math.min(Math.round((exp / bud) * 100), 100) : 0;
    const fillClass = pct >= 100 ? 'danger' : pct >= 80 ? 'warning' : '';

    const card = document.createElement('div');
    card.className = 'budget-card';
    card.innerHTML = `
      <div class="budget-card-header">
        <div class="budget-cat-icon bg-cat-${cat.id}" style="color:${cat.color}">${cat.icon}</div>
        <span class="budget-cat-name">${cat.label}</span>
      </div>
      <div class="budget-input-row">
        <input type="number" class="budget-input" id="budgetInput-${cat.id}"
          value="${bud || ''}" placeholder="Masukkan anggaran..." min="1000000" />
        <button class="btn-save-budget" onclick="saveBudgetCategory('${cat.id}')">Simpan</button>
      </div>
      <div class="budget-stat">
        <span>Pengeluaran</span>
        <span style="color:var(--danger)">${formatRp(exp)}</span>
      </div>
      <div class="budget-stat">
        <span>Sisa</span>
        <span style="color:${bud - exp < 0 ? 'var(--danger)' : 'var(--success)'}">
          ${bud > 0 ? (bud - exp < 0 ? '-' : '') + formatRp(bud - exp) : '—'}
        </span>
      </div>
      <div class="budget-progress-track">
        <div class="budget-progress-fill ${fillClass}" style="width:${pct}%"></div>
      </div>`;
    grid.appendChild(card);
  });
}

function saveBudgetCategory(catId) {
  const val = parseFloat(document.getElementById(`budgetInput-${catId}`).value);
  const budgets = loadBudgets();
  if (!budgets[currentMonth]) budgets[currentMonth] = {};
  if (isNaN(val) || val < 0) {
    delete budgets[currentMonth][catId];
  } else {
    budgets[currentMonth][catId] = val;
  }
  saveBudgets(budgets);
  showToast('Anggaran disimpan ✓');
  renderBudgets();
}

/* ── Transaction Modal ──────────────────────────────────── */
function openAddModal() {
  document.getElementById('modalTitle').textContent = 'Tambah Transaksi';
  document.getElementById('modalSubmit').textContent = 'Simpan';
  document.getElementById('editId').value = '';
  document.getElementById('inputDate').value     = currentMonth + '-' + new Date().getDate().toString().padStart(2, '0');
  document.getElementById('inputCategory').value = '';
  document.getElementById('inputAmount').value   = '';
  document.getElementById('inputDesc').value     = '';
  clearFormErrors();
  document.getElementById('transactionModal').classList.remove('hidden');
  document.getElementById('inputDate').focus();
}

function openEditModal(id) {
  const exp = loadExpenses().find(e => e.id === id);
  if (!exp) return;
  document.getElementById('modalTitle').textContent = 'Edit Transaksi';
  document.getElementById('modalSubmit').textContent = 'Perbarui';
  document.getElementById('editId').value          = id;
  document.getElementById('inputDate').value        = exp.date;
  document.getElementById('inputCategory').value    = exp.category;
  document.getElementById('inputAmount').value      = exp.amount;
  document.getElementById('inputDesc').value        = exp.description;
  clearFormErrors();
  document.getElementById('transactionModal').classList.remove('hidden');
}

function closeTransactionModal() {
  document.getElementById('transactionModal').classList.add('hidden');
}

function clearFormErrors() {
  ['Date','Category','Amount'].forEach(f => {
    document.getElementById(`error${f}`).textContent = '';
    document.getElementById(`input${f}`).classList.remove('error');
  });
}

function validateForm() {
  let valid = true;
  const date   = document.getElementById('inputDate').value;
  const cat    = document.getElementById('inputCategory').value;
  const amount = document.getElementById('inputAmount').value;

  if (!date) {
    document.getElementById('errorDate').textContent = 'Tanggal wajib diisi';
    document.getElementById('inputDate').classList.add('error');
    valid = false;
  }
  if (!cat) {
    document.getElementById('errorCategory').textContent = 'Pilih kategori';
    document.getElementById('inputCategory').classList.add('error');
    valid = false;
  }
  if (!amount || parseFloat(amount) <= 0) {
    document.getElementById('errorAmount').textContent = 'Jumlah harus lebih dari 0';
    document.getElementById('inputAmount').classList.add('error');
    valid = false;
  }
  return valid;
}

function handleFormSubmit(e) {
  e.preventDefault();
  clearFormErrors();
  if (!validateForm()) return;

  const id   = document.getElementById('editId').value;
  const date = document.getElementById('inputDate').value;
  const cat  = document.getElementById('inputCategory').value;
  const amt  = parseFloat(document.getElementById('inputAmount').value);
  const desc = document.getElementById('inputDesc').value.trim();

  let expenses = loadExpenses();
  if (id) {
    // Edit
    const idx = expenses.findIndex(e => e.id === id);
    if (idx !== -1) {
      expenses[idx] = { ...expenses[idx], date, category: cat, amount: amt, description: desc };
      showToast('Transaksi diperbarui ✓');
    }
  } else {
    // Add
    expenses.push({ id: Date.now().toString(), date, category: cat, amount: amt, description: desc });
    // Update currentMonth to the entered date's month
    currentMonth = date.slice(0, 7);
    syncMonthLabels();
    showToast('Transaksi ditambahkan ✓');
  }
  saveExpenses(expenses);
  closeTransactionModal();
  renderPage();
}

/* ── Delete confirm modal ───────────────────────────────── */
function confirmDelete(type, id) {
  pendingDelete = { type, id };
  const text = type === 'all'
    ? 'Semua data pengeluaran dan anggaran akan dihapus permanen. Lanjutkan?'
    : 'Transaksi ini akan dihapus permanen.';
  document.getElementById('confirmText').textContent = text;
  document.getElementById('confirmModal').classList.remove('hidden');
}

function executeDelete() {
  if (!pendingDelete) return;
  if (pendingDelete.type === 'all') {
    localStorage.removeItem(LS_EXPENSES);
    localStorage.removeItem(LS_BUDGETS);
    showToast('Semua data dihapus');
  } else if (pendingDelete.type === 'expense') {
    const expenses = loadExpenses().filter(e => e.id !== pendingDelete.id);
    saveExpenses(expenses);
    showToast('Transaksi dihapus');
  }
  pendingDelete = null;
  document.getElementById('confirmModal').classList.add('hidden');
  renderPage();
}

/* ── Toast ──────────────────────────────────────────────── */
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), 2500);
}

/* ── Bootstrap / Event Wiring ───────────────────────────── */
function populateCategorySelects() {
  const selects = [
    document.getElementById('inputCategory'),
    document.getElementById('filterCategory'),
  ];
  selects.forEach(sel => {
    // Keep the first placeholder option, remove category options and re-add
    while (sel.options.length > 1) sel.remove(1);
    CATEGORIES.forEach(cat => {
      const opt = document.createElement('option');
      opt.value       = cat.id;
      opt.textContent = `${cat.icon} ${cat.label}`;
      sel.appendChild(opt);
    });
  });
}

function init() {
  // Sync month labels
  syncMonthLabels();

  // Populate selects
  populateCategorySelects();

  // Nav buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => showPage(btn.dataset.page));
  });

  // Month navigation
  document.getElementById('prevMonth').addEventListener('click', () => changeMonth(-1));
  document.getElementById('nextMonth').addEventListener('click', () => changeMonth(+1));
  document.getElementById('prevMonthDesktop').addEventListener('click', () => changeMonth(-1));
  document.getElementById('nextMonthDesktop').addEventListener('click', () => changeMonth(+1));

  // Hamburger (mobile sidebar)
  document.getElementById('hamburger').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });
  document.addEventListener('click', e => {
    const sidebar = document.getElementById('sidebar');
    const hamburger = document.getElementById('hamburger');
    if (sidebar.classList.contains('open') &&
        !sidebar.contains(e.target) &&
        !hamburger.contains(e.target)) {
      sidebar.classList.remove('open');
    }
  });

  // Add transaction button
  document.getElementById('btnAddTransaction').addEventListener('click', openAddModal);

  // Transaction form
  document.getElementById('transactionForm').addEventListener('submit', handleFormSubmit);

  // Modal close buttons
  document.getElementById('modalClose').addEventListener('click', closeTransactionModal);
  document.getElementById('modalCancel').addEventListener('click', closeTransactionModal);

  // Close modal on overlay click
  document.getElementById('transactionModal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeTransactionModal();
  });

  // Confirm modal
  document.getElementById('confirmOk').addEventListener('click', executeDelete);
  document.getElementById('confirmCancel').addEventListener('click', () => {
    pendingDelete = null;
    document.getElementById('confirmModal').classList.add('hidden');
  });
  document.getElementById('confirmModalClose').addEventListener('click', () => {
    pendingDelete = null;
    document.getElementById('confirmModal').classList.add('hidden');
  });
  document.getElementById('confirmModal').addEventListener('click', e => {
    if (e.target === e.currentTarget) {
      pendingDelete = null;
      document.getElementById('confirmModal').classList.add('hidden');
    }
  });

  // Clear all data
  document.getElementById('btnClearData').addEventListener('click', () => confirmDelete('all'));

  // Filter / search inputs
  document.getElementById('searchInput').addEventListener('input', renderTransactions);
  document.getElementById('filterCategory').addEventListener('change', renderTransactions);
  document.getElementById('sortBy').addEventListener('change', renderTransactions);

  // Keyboard: ESC closes modals
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeTransactionModal();
      pendingDelete = null;
      document.getElementById('confirmModal').classList.add('hidden');
    }
  });

  // Redraw charts on resize
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (currentPage === 'dashboard') renderDashboard();
    }, 200);
  });

  // Initial render
  showPage('dashboard');
}

document.addEventListener('DOMContentLoaded', init);
