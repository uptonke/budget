const STORAGE_KEY = "entertainment_budget_ledger_v2";
const DATA_VERSION = 2;

const defaultPlanTemplate = [
  { category: "喜劇", name: "23 全英文喜劇", count: 12, unitPrice: 600, note: "每月一次" },
  { category: "爵士", name: "Bluenote / 爵士酒吧", count: 12, unitPrice: 550, note: "每月一次" },
  { category: "餐飲", name: "fine dining / omakase", count: 4, unitPrice: 4000, note: "基準版：一年四次" },
  { category: "遠程出國", name: "過年遠程出國", count: 1, unitPrice: 55000, note: "基準版遠程預算" },
  { category: "東南亞", name: "東南亞連假", count: 1, unitPrice: 12500, note: "10,000～15,000 中位數" }
];

const sampleData = {
  version: DATA_VERSION,
  selectedYear: new Date().getFullYear(),
  years: {
    [new Date().getFullYear()]: {
      baseBudget: 100000,
      adjustment: 0,
      note: "基準版"
    }
  },
  plans: [],
  transactions: []
};

const el = {
  yearSelect: document.getElementById("yearSelect"),
  newYearBtn: document.getElementById("newYearBtn"),
  baseBudgetInput: document.getElementById("baseBudgetInput"),
  adjustmentInput: document.getElementById("adjustmentInput"),
  yearNoteInput: document.getElementById("yearNoteInput"),
  carryoverAmount: document.getElementById("carryoverAmount"),
  availableAmount: document.getElementById("availableAmount"),
  plannedAmount: document.getElementById("plannedAmount"),
  actualExpenseAmount: document.getElementById("actualExpenseAmount"),
  endingBalance: document.getElementById("endingBalance"),
  plannedVsAvailable: document.getElementById("plannedVsAvailable"),
  actualVsAvailable: document.getElementById("actualVsAvailable"),
  debitRows: document.getElementById("debitRows"),
  creditRows: document.getElementById("creditRows"),
  balancedTotal: document.getElementById("balancedTotal"),
  addTemplateBtn: document.getElementById("addTemplateBtn"),
  planForm: document.getElementById("planForm"),
  planCategory: document.getElementById("planCategory"),
  planName: document.getElementById("planName"),
  planCount: document.getElementById("planCount"),
  planUnitPrice: document.getElementById("planUnitPrice"),
  planNote: document.getElementById("planNote"),
  planTableBody: document.getElementById("planTableBody"),
  txnForm: document.getElementById("txnForm"),
  txnDate: document.getElementById("txnDate"),
  txnType: document.getElementById("txnType"),
  txnCategory: document.getElementById("txnCategory"),
  txnName: document.getElementById("txnName"),
  txnAmount: document.getElementById("txnAmount"),
  txnNote: document.getElementById("txnNote"),
  txnTableBody: document.getElementById("txnTableBody"),
  yearOverviewBody: document.getElementById("yearOverviewBody"),
  exportBtn: document.getElementById("exportBtn"),
  importFile: document.getElementById("importFile"),
  downloadSampleBtn: document.getElementById("downloadSampleBtn"),
  resetBtn: document.getElementById("resetBtn")
};

let state = loadState();
normaliseState();
setTodayDefault();
render();

el.yearSelect.addEventListener("change", () => {
  state.selectedYear = Number(el.yearSelect.value);
  ensureYear(state.selectedYear);
  saveState();
  render();
});

el.newYearBtn.addEventListener("click", () => {
  const current = state.selectedYear || new Date().getFullYear();
  const input = prompt("請輸入要新增 / 切換的年度", String(current + 1));
  if (input === null) return;

  const year = Number(input.trim());
  if (!Number.isInteger(year) || year < 1900 || year > 2200) {
    alert("年度格式不正確。");
    return;
  }

  ensureYear(year);
  state.selectedYear = year;
  saveState();
  render();
});

[el.baseBudgetInput, el.adjustmentInput, el.yearNoteInput].forEach(input => {
  input.addEventListener("input", () => {
    const year = getSelectedYear();
    ensureYear(year);
    state.years[year].baseBudget = numberOrZero(el.baseBudgetInput.value);
    state.years[year].adjustment = numberOrZero(el.adjustmentInput.value);
    state.years[year].note = el.yearNoteInput.value.trim();
    saveState();
    render(false);
  });
});

el.planForm.addEventListener("submit", event => {
  event.preventDefault();
  const year = getSelectedYear();
  const count = positiveNumber(el.planCount.value, 1);
  const unitPrice = positiveNumber(el.planUnitPrice.value, 0);

  state.plans.push({
    id: createId(),
    year,
    category: cleanText(el.planCategory.value),
    name: cleanText(el.planName.value),
    count,
    unitPrice,
    note: cleanText(el.planNote.value),
    createdAt: new Date().toISOString()
  });

  saveState();
  el.planForm.reset();
  el.planCount.value = 1;
  render();
});

el.txnForm.addEventListener("submit", event => {
  event.preventDefault();
  const year = getSelectedYear();
  const date = el.txnDate.value || new Date().toISOString().slice(0, 10);
  const amount = positiveNumber(el.txnAmount.value, 0);

  if (amount <= 0) {
    alert("金額必須大於 0。");
    return;
  }

  state.transactions.push({
    id: createId(),
    year,
    date,
    type: el.txnType.value,
    category: cleanText(el.txnCategory.value),
    name: cleanText(el.txnName.value),
    amount,
    note: cleanText(el.txnNote.value),
    createdAt: new Date().toISOString()
  });

  saveState();
  const lastDate = el.txnDate.value;
  el.txnForm.reset();
  el.txnDate.value = lastDate || new Date().toISOString().slice(0, 10);
  render();
});

el.addTemplateBtn.addEventListener("click", () => {
  const year = getSelectedYear();
  const hasExistingPlan = state.plans.some(item => item.year === year);
  if (hasExistingPlan && !confirm("此年度已有計畫項目，仍要加入一組基準版嗎？")) return;

  defaultPlanTemplate.forEach(item => {
    state.plans.push({
      id: createId(),
      year,
      ...item,
      createdAt: new Date().toISOString()
    });
  });

  saveState();
  render();
});

el.exportBtn.addEventListener("click", () => {
  downloadJson(state, `entertainment-budget-ledger-${dateStamp()}.json`);
});

el.downloadSampleBtn.addEventListener("click", () => {
  const year = new Date().getFullYear();
  const demo = createInitialState(year);
  defaultPlanTemplate.forEach(item => {
    demo.plans.push({
      id: createId(),
      year,
      ...item,
      createdAt: new Date().toISOString()
    });
  });
  demo.transactions.push(
    { id: createId(), year, date: `${year}-01-15`, type: "expense", category: "喜劇", name: "23 全英文喜劇", amount: 600, note: "範例", createdAt: new Date().toISOString() },
    { id: createId(), year, date: `${year}-02-10`, type: "expense", category: "爵士", name: "Bluenote", amount: 550, note: "範例", createdAt: new Date().toISOString() },
    { id: createId(), year, date: `${year}-03-20`, type: "expense", category: "餐飲", name: "Omakase", amount: 4200, note: "範例", createdAt: new Date().toISOString() }
  );
  downloadJson(demo, `sample-entertainment-budget-ledger-${year}.json`);
});

el.importFile.addEventListener("change", async event => {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const imported = validateImportedState(parsed);
    if (!confirm("匯入會覆蓋目前瀏覽器中的資料。確定繼續？")) return;
    state = imported;
    normaliseState();
    saveState();
    render();
    alert("匯入完成。");
  } catch (error) {
    alert(`匯入失敗：${error.message}`);
  } finally {
    el.importFile.value = "";
  }
});

el.resetBtn.addEventListener("click", () => {
  if (!confirm("確定要刪除所有本機資料？這個動作無法復原。")) return;
  localStorage.removeItem(STORAGE_KEY);
  state = createInitialState(new Date().getFullYear());
  saveState();
  render();
});

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialState(new Date().getFullYear());
    return validateImportedState(JSON.parse(raw));
  } catch {
    return createInitialState(new Date().getFullYear());
  }
}

function createInitialState(year) {
  return {
    version: DATA_VERSION,
    selectedYear: year,
    years: {
      [year]: {
        baseBudget: 100000,
        adjustment: 0,
        note: ""
      }
    },
    plans: [],
    transactions: []
  };
}

function validateImportedState(input) {
  if (!input || typeof input !== "object") throw new Error("JSON 格式不正確。");
  const years = input.years && typeof input.years === "object" ? input.years : {};
  const plans = Array.isArray(input.plans) ? input.plans : [];
  const transactions = Array.isArray(input.transactions) ? input.transactions : [];
  const selectedYear = Number(input.selectedYear) || new Date().getFullYear();

  return {
    version: DATA_VERSION,
    selectedYear,
    years,
    plans: plans.map(item => ({
      id: item.id || createId(),
      year: Number(item.year) || selectedYear,
      category: cleanText(item.category || "其他"),
      name: cleanText(item.name || "未命名"),
      count: positiveNumber(item.count, 1),
      unitPrice: positiveNumber(item.unitPrice, 0),
      note: cleanText(item.note || ""),
      createdAt: item.createdAt || new Date().toISOString()
    })),
    transactions: transactions.map(item => ({
      id: item.id || createId(),
      year: Number(item.year) || selectedYear,
      date: item.date || new Date().toISOString().slice(0, 10),
      type: item.type === "income" ? "income" : "expense",
      category: cleanText(item.category || "其他"),
      name: cleanText(item.name || "未命名"),
      amount: positiveNumber(item.amount, 0),
      note: cleanText(item.note || ""),
      createdAt: item.createdAt || new Date().toISOString()
    }))
  };
}

function normaliseState() {
  if (!state.selectedYear) state.selectedYear = new Date().getFullYear();
  if (!state.years || typeof state.years !== "object") state.years = {};
  if (!Array.isArray(state.plans)) state.plans = [];
  if (!Array.isArray(state.transactions)) state.transactions = [];
  ensureYear(state.selectedYear);

  getAllYears().forEach(year => ensureYear(year));
}

function ensureYear(year) {
  const key = String(year);
  if (!state.years[key]) {
    state.years[key] = {
      baseBudget: 100000,
      adjustment: 0,
      note: ""
    };
  }
  state.years[key].baseBudget = numberOrZero(state.years[key].baseBudget);
  state.years[key].adjustment = numberOrZero(state.years[key].adjustment);
  state.years[key].note = cleanText(state.years[key].note || "");
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getSelectedYear() {
  return Number(state.selectedYear) || new Date().getFullYear();
}

function getAllYears() {
  const yearSet = new Set([Number(state.selectedYear), new Date().getFullYear()]);
  Object.keys(state.years || {}).forEach(year => yearSet.add(Number(year)));
  state.plans.forEach(item => yearSet.add(Number(item.year)));
  state.transactions.forEach(item => yearSet.add(Number(item.year)));
  return [...yearSet]
    .filter(year => Number.isInteger(year) && year >= 1900 && year <= 2200)
    .sort((a, b) => a - b);
}

function computeYearSummaries() {
  const years = getAllYears();
  let carryover = 0;
  const summaries = {};

  years.forEach(year => {
    ensureYear(year);
    const config = state.years[String(year)];
    const yearPlans = state.plans.filter(item => Number(item.year) === year);
    const yearTxns = state.transactions.filter(item => Number(item.year) === year);

    const planned = yearPlans.reduce((sum, item) => sum + item.count * item.unitPrice, 0);
    const actualExpense = yearTxns
      .filter(item => item.type === "expense")
      .reduce((sum, item) => sum + item.amount, 0);
    const actualIncome = yearTxns
      .filter(item => item.type === "income")
      .reduce((sum, item) => sum + item.amount, 0);

    const baseBudget = numberOrZero(config.baseBudget);
    const adjustment = numberOrZero(config.adjustment);
    const available = baseBudget + carryover + adjustment + actualIncome;
    const ending = available - actualExpense;

    summaries[year] = {
      year,
      baseBudget,
      adjustment,
      note: config.note || "",
      carryover,
      planned,
      actualExpense,
      actualIncome,
      available,
      ending
    };

    carryover = ending;
  });

  return summaries;
}

function render(syncInputs = true) {
  normaliseState();
  renderYearSelect();

  const year = getSelectedYear();
  const summaries = computeYearSummaries();
  const current = summaries[year];

  if (syncInputs) {
    const config = state.years[String(year)];
    el.baseBudgetInput.value = config.baseBudget;
    el.adjustmentInput.value = config.adjustment;
    el.yearNoteInput.value = config.note || "";
  }

  renderSummary(current);
  renderLedger(current);
  renderPlanTable(year);
  renderTransactionTable(year);
  renderYearOverview(summaries);
}

function renderYearSelect() {
  const years = getAllYears();
  el.yearSelect.innerHTML = years
    .map(year => `<option value="${year}" ${year === getSelectedYear() ? "selected" : ""}>${year}</option>`)
    .join("");
}

function renderSummary(summary) {
  el.carryoverAmount.textContent = formatMoney(summary.carryover);
  el.availableAmount.textContent = formatMoney(summary.available);
  el.plannedAmount.textContent = formatMoney(summary.planned);
  el.actualExpenseAmount.textContent = formatMoney(summary.actualExpense);
  el.endingBalance.textContent = formatMoney(summary.ending);

  applySignClass(el.carryoverAmount, summary.carryover);
  applySignClass(el.endingBalance, summary.ending);

  el.plannedVsAvailable.textContent = `佔可用總額 ${formatPercent(summary.planned, summary.available)}`;
  el.actualVsAvailable.textContent = `佔可用總額 ${formatPercent(summary.actualExpense, summary.available)}`;
}

function renderLedger(summary) {
  const year = summary.year;
  const expenseGroups = groupByCategory(
    state.transactions.filter(item => Number(item.year) === year && item.type === "expense")
  );
  const incomeGroups = groupByCategory(
    state.transactions.filter(item => Number(item.year) === year && item.type === "income")
  );

  const debits = [];
  const credits = [];

  Object.entries(expenseGroups).forEach(([category, amount]) => {
    debits.push({ label: category, amount });
  });

  if (summary.carryover < 0) debits.push({ label: "上年結轉赤字", amount: Math.abs(summary.carryover) });
  if (summary.adjustment < 0) debits.push({ label: "年度負調整", amount: Math.abs(summary.adjustment) });

  credits.push({ label: "年度基礎預算", amount: summary.baseBudget });
  if (summary.carryover > 0) credits.push({ label: "上年結轉盈餘", amount: summary.carryover });
  if (summary.adjustment > 0) credits.push({ label: "年度正調整", amount: summary.adjustment });
  Object.entries(incomeGroups).forEach(([category, amount]) => {
    credits.push({ label: `退款 / 收入：${category}`, amount });
  });

  const debitBeforeBalance = debits.reduce((sum, item) => sum + item.amount, 0);
  const creditBeforeBalance = credits.reduce((sum, item) => sum + item.amount, 0);

  if (creditBeforeBalance > debitBeforeBalance) {
    debits.push({ label: "期末結餘", amount: creditBeforeBalance - debitBeforeBalance, special: "positive" });
  } else if (debitBeforeBalance > creditBeforeBalance) {
    credits.push({ label: "期末赤字", amount: debitBeforeBalance - creditBeforeBalance, special: "negative" });
  }

  const balanced = Math.max(
    debits.reduce((sum, item) => sum + item.amount, 0),
    credits.reduce((sum, item) => sum + item.amount, 0)
  );

  el.debitRows.innerHTML = renderLedgerRows(debits, "尚無用途紀錄");
  el.creditRows.innerHTML = renderLedgerRows(credits, "尚無來源紀錄");
  el.balancedTotal.textContent = formatMoney(balanced);
}

function renderLedgerRows(rows, emptyText) {
  if (rows.length === 0) return `<div class="empty-state">${emptyText}</div>`;
  return rows.map(row => `
    <div class="ledger-row ${row.special || ""}">
      <span>${escapeHtml(row.label)}</span>
      <span>${formatMoney(row.amount)}</span>
    </div>
  `).join("");
}

function renderPlanTable(year) {
  const plans = state.plans
    .filter(item => Number(item.year) === year)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  if (plans.length === 0) {
    el.planTableBody.innerHTML = `<tr><td colspan="6" class="empty-state">尚無年度計畫。</td></tr>`;
    return;
  }

  el.planTableBody.innerHTML = plans.map(item => {
    const subtotal = item.count * item.unitPrice;
    return `
      <tr>
        <td><span class="badge">${escapeHtml(item.category)}</span></td>
        <td title="${escapeHtml(item.note || "")}">${escapeHtml(item.name)}</td>
        <td>${item.count}</td>
        <td>${formatMoney(item.unitPrice)}</td>
        <td>${formatMoney(subtotal)}</td>
        <td><button class="icon-btn" data-action="delete-plan" data-id="${item.id}" type="button">刪除</button></td>
      </tr>
    `;
  }).join("");

  el.planTableBody.querySelectorAll("[data-action='delete-plan']").forEach(button => {
    button.addEventListener("click", () => {
      state.plans = state.plans.filter(item => item.id !== button.dataset.id);
      saveState();
      render();
    });
  });
}

function renderTransactionTable(year) {
  const txns = state.transactions
    .filter(item => Number(item.year) === year)
    .sort((a, b) => `${b.date}${b.createdAt}`.localeCompare(`${a.date}${a.createdAt}`));

  if (txns.length === 0) {
    el.txnTableBody.innerHTML = `<tr><td colspan="6" class="empty-state">尚無實際流水帳。</td></tr>`;
    return;
  }

  el.txnTableBody.innerHTML = txns.map(item => {
    const isIncome = item.type === "income";
    return `
      <tr>
        <td>${escapeHtml(item.date)}</td>
        <td><span class="badge ${isIncome ? "badge-income" : ""}">${isIncome ? "收入" : "支出"}</span></td>
        <td>${escapeHtml(item.category)}</td>
        <td title="${escapeHtml(item.note || "")}">${escapeHtml(item.name)}</td>
        <td class="${isIncome ? "positive" : ""}">${formatMoney(item.amount)}</td>
        <td><button class="icon-btn" data-action="delete-txn" data-id="${item.id}" type="button">刪除</button></td>
      </tr>
    `;
  }).join("");

  el.txnTableBody.querySelectorAll("[data-action='delete-txn']").forEach(button => {
    button.addEventListener("click", () => {
      state.transactions = state.transactions.filter(item => item.id !== button.dataset.id);
      saveState();
      render();
    });
  });
}

function renderYearOverview(summaries) {
  const rows = Object.values(summaries).sort((a, b) => a.year - b.year);
  el.yearOverviewBody.innerHTML = rows.map(item => `
    <tr>
      <td>${item.year}</td>
      <td>${formatMoney(item.baseBudget)}</td>
      <td class="${signClass(item.carryover)}">${formatMoney(item.carryover)}</td>
      <td class="${signClass(item.adjustment)}">${formatMoney(item.adjustment)}</td>
      <td>${formatMoney(item.actualIncome)}</td>
      <td>${formatMoney(item.actualExpense)}</td>
      <td class="${signClass(item.ending)}"><strong>${formatMoney(item.ending)}</strong></td>
      <td>${escapeHtml(item.note || "")}</td>
    </tr>
  `).join("");
}

function groupByCategory(items) {
  return items.reduce((acc, item) => {
    const category = item.category || "其他";
    acc[category] = (acc[category] || 0) + item.amount;
    return acc;
  }, {});
}

function applySignClass(node, value) {
  node.classList.remove("positive", "negative", "warning");
  if (value > 0) node.classList.add("positive");
  if (value < 0) node.classList.add("negative");
}

function signClass(value) {
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "";
}

function setTodayDefault() {
  el.txnDate.value = new Date().toISOString().slice(0, 10);
}

function formatMoney(value) {
  const rounded = Math.round(numberOrZero(value));
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0
  }).format(rounded);
}

function formatPercent(numerator, denominator) {
  if (!denominator) return "0.0%";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return fallback;
  return number;
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function createId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10).replaceAll("-", "");
}
