const STORAGE_KEY = "entertainment_budget_ledger_v2";
const DATA_VERSION = 3;

const defaultPlanTemplate = [
  { category: "喜劇", name: "23 全英文喜劇", count: 12, unitPrice: 600, note: "每月一次" },
  { category: "爵士", name: "Bluenote / 爵士酒吧", count: 12, unitPrice: 550, note: "每月一次" },
  { category: "餐飲", name: "fine dining / omakase", count: 4, unitPrice: 4000, note: "基準版：一年四次" },
  { category: "遠程出國", name: "過年遠程出國", count: 1, unitPrice: 55000, note: "基準版遠程預算" },
  { category: "東南亞", name: "東南亞連假", count: 1, unitPrice: 12500, note: "10,000～15,000 中位數" }
];

const el = {
  yearSelect: document.getElementById("yearSelect"),
  newYearBtn: document.getElementById("newYearBtn"),
  deleteYearBtn: document.getElementById("deleteYearBtn"),
  baseBudgetInput: document.getElementById("baseBudgetInput"),
  adjustmentInput: document.getElementById("adjustmentInput"),
  yearNoteInput: document.getElementById("yearNoteInput"),
  carryoverAmount: document.getElementById("carryoverAmount"),
  availableAmount: document.getElementById("availableAmount"),
  plannedAmount: document.getElementById("plannedAmount"),
  actualExpenseAmount: document.getElementById("actualExpenseAmount"),
  endingBalance: document.getElementById("endingBalance"),
  carryoverPreview: document.getElementById("carryoverPreview"),
  carryoverPreviewText: document.getElementById("carryoverPreviewText"),
  plannedVsAvailable: document.getElementById("plannedVsAvailable"),
  actualVsAvailable: document.getElementById("actualVsAvailable"),
  warningPanel: document.getElementById("warningPanel"),
  warningStatus: document.getElementById("warningStatus"),
  warningList: document.getElementById("warningList"),
  debitRows: document.getElementById("debitRows"),
  creditRows: document.getElementById("creditRows"),
  balancedTotal: document.getElementById("balancedTotal"),
  buildBudgetsFromPlanBtn: document.getElementById("buildBudgetsFromPlanBtn"),
  budgetLimitForm: document.getElementById("budgetLimitForm"),
  limitCategory: document.getElementById("limitCategory"),
  limitAmount: document.getElementById("limitAmount"),
  limitNote: document.getElementById("limitNote"),
  limitSubmitBtn: document.getElementById("limitSubmitBtn"),
  cancelLimitEditBtn: document.getElementById("cancelLimitEditBtn"),
  categoryProgressGrid: document.getElementById("categoryProgressGrid"),
  varianceTableBody: document.getElementById("varianceTableBody"),
  addTemplateBtn: document.getElementById("addTemplateBtn"),
  copyPreviousPlanBtn: document.getElementById("copyPreviousPlanBtn"),
  planForm: document.getElementById("planForm"),
  planCategory: document.getElementById("planCategory"),
  planName: document.getElementById("planName"),
  planCount: document.getElementById("planCount"),
  planUnitPrice: document.getElementById("planUnitPrice"),
  planNote: document.getElementById("planNote"),
  planSubmitBtn: document.getElementById("planSubmitBtn"),
  cancelPlanEditBtn: document.getElementById("cancelPlanEditBtn"),
  planTableBody: document.getElementById("planTableBody"),
  txnForm: document.getElementById("txnForm"),
  txnDate: document.getElementById("txnDate"),
  txnType: document.getElementById("txnType"),
  txnCategory: document.getElementById("txnCategory"),
  txnName: document.getElementById("txnName"),
  txnAmount: document.getElementById("txnAmount"),
  txnNote: document.getElementById("txnNote"),
  txnSubmitBtn: document.getElementById("txnSubmitBtn"),
  cancelTxnEditBtn: document.getElementById("cancelTxnEditBtn"),
  txnTableBody: document.getElementById("txnTableBody"),
  yearOverviewBody: document.getElementById("yearOverviewBody"),
  exportBtn: document.getElementById("exportBtn"),
  importFile: document.getElementById("importFile"),
  resetBtn: document.getElementById("resetBtn")
};

let state = loadState();
let editingPlanId = null;
let editingTxnId = null;
let editingBudgetId = null;

normaliseState();
setTodayDefault();
render();

el.yearSelect.addEventListener("change", () => {
  state.selectedYear = Number(el.yearSelect.value);
  ensureYear(state.selectedYear);
  resetPlanForm();
  resetTxnForm();
  resetBudgetForm();
  saveState();
  render();
});

el.newYearBtn.addEventListener("click", () => {
  const current = getSelectedYear();
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

el.deleteYearBtn.addEventListener("click", () => deleteYear(getSelectedYear()));

[el.baseBudgetInput, el.adjustmentInput, el.yearNoteInput].forEach(input => {
  input.addEventListener("input", () => {
    const year = getSelectedYear();
    ensureYear(year);
    state.years[String(year)].baseBudget = numberOrZero(el.baseBudgetInput.value);
    state.years[String(year)].adjustment = numberOrZero(el.adjustmentInput.value);
    state.years[String(year)].note = cleanText(el.yearNoteInput.value);
    saveState();
    render(false);
  });
});

el.addTemplateBtn.addEventListener("click", () => {
  const year = getSelectedYear();
  const hasExistingPlan = state.plans.some(item => Number(item.year) === year);
  if (hasExistingPlan && !confirm("此年度已有計畫項目，仍要加入一組基準版嗎？")) return;

  defaultPlanTemplate.forEach(item => {
    state.plans.push({
      id: createId(),
      year,
      ...item,
      createdAt: nowIso()
    });
  });

  upsertBudgetsFromTemplate(year, false);
  saveState();
  render();
});

el.copyPreviousPlanBtn.addEventListener("click", () => copyPreviousYearPlan());

el.planForm.addEventListener("submit", event => {
  event.preventDefault();
  const year = getSelectedYear();
  const count = positiveNumber(el.planCount.value, 1);
  const unitPrice = positiveNumber(el.planUnitPrice.value, 0);
  const payload = {
    year,
    category: cleanText(el.planCategory.value),
    name: cleanText(el.planName.value),
    count,
    unitPrice,
    note: cleanText(el.planNote.value)
  };

  if (editingPlanId) {
    const index = state.plans.findIndex(item => item.id === editingPlanId);
    if (index >= 0) {
      state.plans[index] = { ...state.plans[index], ...payload, updatedAt: nowIso() };
    }
  } else {
    state.plans.push({ id: createId(), ...payload, createdAt: nowIso() });
  }

  saveState();
  resetPlanForm();
  render();
});

el.cancelPlanEditBtn.addEventListener("click", resetPlanForm);

el.txnForm.addEventListener("submit", event => {
  event.preventDefault();
  const year = getSelectedYear();
  const date = el.txnDate.value || todayString();
  const amount = positiveNumber(el.txnAmount.value, 0);

  if (amount <= 0) {
    alert("金額必須大於 0。");
    return;
  }

  const payload = {
    year,
    date,
    type: el.txnType.value === "income" ? "income" : "expense",
    category: cleanText(el.txnCategory.value),
    name: cleanText(el.txnName.value),
    amount,
    note: cleanText(el.txnNote.value)
  };

  if (editingTxnId) {
    const index = state.transactions.findIndex(item => item.id === editingTxnId);
    if (index >= 0) {
      state.transactions[index] = { ...state.transactions[index], ...payload, updatedAt: nowIso() };
    }
  } else {
    state.transactions.push({ id: createId(), ...payload, createdAt: nowIso() });
  }

  saveState();
  resetTxnForm(date);
  render();
});

el.cancelTxnEditBtn.addEventListener("click", () => resetTxnForm());

el.buildBudgetsFromPlanBtn.addEventListener("click", () => {
  const year = getSelectedYear();
  const grouped = getPlanByCategory(year);
  const entries = Object.entries(grouped);
  if (entries.length === 0) {
    alert("此年度尚無計畫項目，無法建立分類上限。");
    return;
  }
  const hasExisting = state.categoryBudgets.some(item => Number(item.year) === year);
  if (hasExisting && !confirm("此年度已有分類上限。是否用目前年度計畫金額覆蓋同分類上限？")) return;

  entries.forEach(([category, limit]) => {
    upsertCategoryBudget(year, category, limit, "由年度計畫建立");
  });

  saveState();
  render();
});

el.budgetLimitForm.addEventListener("submit", event => {
  event.preventDefault();
  const year = getSelectedYear();
  const category = cleanText(el.limitCategory.value);
  const limit = positiveNumber(el.limitAmount.value, 0);
  const note = cleanText(el.limitNote.value);

  if (!category) {
    alert("請輸入分類。");
    return;
  }

  if (editingBudgetId) {
    const index = state.categoryBudgets.findIndex(item => item.id === editingBudgetId);
    if (index >= 0) {
      state.categoryBudgets[index] = {
        ...state.categoryBudgets[index],
        year,
        category,
        limit,
        note,
        updatedAt: nowIso()
      };
    }
  } else {
    upsertCategoryBudget(year, category, limit, note);
  }

  saveState();
  resetBudgetForm();
  render();
});

el.cancelLimitEditBtn.addEventListener("click", resetBudgetForm);

el.exportBtn.addEventListener("click", () => {
  const year = getSelectedYear();
  downloadJson(state, `entertainment-budget-ledger-${year}-${dateTimeStamp()}.json`);
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
    resetPlanForm();
    resetTxnForm();
    resetBudgetForm();
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
  resetPlanForm();
  resetTxnForm();
  resetBudgetForm();
  saveState();
  render();
});

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
    transactions: [],
    categoryBudgets: []
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialState(new Date().getFullYear());
    return validateImportedState(JSON.parse(raw));
  } catch {
    return createInitialState(new Date().getFullYear());
  }
}

function validateImportedState(input) {
  if (!input || typeof input !== "object") throw new Error("JSON 格式不正確。");
  const selectedYear = Number(input.selectedYear) || new Date().getFullYear();
  const years = input.years && typeof input.years === "object" ? input.years : {};
  const plans = Array.isArray(input.plans) ? input.plans : [];
  const transactions = Array.isArray(input.transactions) ? input.transactions : [];
  const categoryBudgets = Array.isArray(input.categoryBudgets) ? input.categoryBudgets : [];

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
      createdAt: item.createdAt || nowIso(),
      updatedAt: item.updatedAt || ""
    })),
    transactions: transactions.map(item => ({
      id: item.id || createId(),
      year: Number(item.year) || selectedYear,
      date: item.date || todayString(),
      type: item.type === "income" ? "income" : "expense",
      category: cleanText(item.category || "其他"),
      name: cleanText(item.name || "未命名"),
      amount: positiveNumber(item.amount, 0),
      note: cleanText(item.note || ""),
      createdAt: item.createdAt || nowIso(),
      updatedAt: item.updatedAt || ""
    })),
    categoryBudgets: categoryBudgets.map(item => ({
      id: item.id || createId(),
      year: Number(item.year) || selectedYear,
      category: cleanText(item.category || "其他"),
      limit: positiveNumber(item.limit ?? item.amount, 0),
      note: cleanText(item.note || ""),
      createdAt: item.createdAt || nowIso(),
      updatedAt: item.updatedAt || ""
    }))
  };
}

function normaliseState() {
  if (!state.selectedYear) state.selectedYear = new Date().getFullYear();
  if (!state.years || typeof state.years !== "object") state.years = {};
  if (!Array.isArray(state.plans)) state.plans = [];
  if (!Array.isArray(state.transactions)) state.transactions = [];
  if (!Array.isArray(state.categoryBudgets)) state.categoryBudgets = [];
  ensureYear(state.selectedYear);
  getAllYears().forEach(year => ensureYear(year));
}

function ensureYear(year) {
  const key = String(year);
  if (!state.years[key]) {
    state.years[key] = { baseBudget: 100000, adjustment: 0, note: "" };
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
  const yearSet = new Set();
  if (state.selectedYear) yearSet.add(Number(state.selectedYear));
  Object.keys(state.years || {}).forEach(year => yearSet.add(Number(year)));
  state.plans.forEach(item => yearSet.add(Number(item.year)));
  state.transactions.forEach(item => yearSet.add(Number(item.year)));
  state.categoryBudgets.forEach(item => yearSet.add(Number(item.year)));

  const years = [...yearSet]
    .filter(year => Number.isInteger(year) && year >= 1900 && year <= 2200)
    .sort((a, b) => a - b);

  return years.length ? years : [new Date().getFullYear()];
}

function computeYearSummaries() {
  const years = getAllYears();
  let carryover = 0;
  const summaries = {};

  years.forEach(year => {
    ensureYear(year);
    const config = state.years[String(year)];
    const planned = getPlanTotal(year);
    const actualExpense = getActualExpenseTotal(year);
    const actualIncome = getActualIncomeTotal(year);
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
      plannedBalance: available - planned,
      ending,
      nextCarryover: ending
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
  renderWarnings(year, current);
  renderLedger(current);
  renderCategoryAnalysis(year);
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
  el.carryoverPreview.textContent = formatMoney(summary.nextCarryover);
  el.carryoverPreviewText.textContent = summary.nextCarryover >= 0
    ? "若現在結算，下一年會帶入盈餘"
    : "若現在結算，下一年會帶入赤字";

  applySignClass(el.carryoverAmount, summary.carryover);
  applySignClass(el.endingBalance, summary.ending);
  applySignClass(el.carryoverPreview, summary.nextCarryover);

  el.plannedVsAvailable.textContent = `佔可用總額 ${formatPercent(summary.planned, summary.available)}`;
  el.actualVsAvailable.textContent = `佔可用總額 ${formatPercent(summary.actualExpense, summary.available)}`;
}

function renderWarnings(year, summary) {
  const warnings = buildWarnings(year, summary);
  const hasCritical = warnings.some(item => item.level === "critical");
  const hasWarning = warnings.some(item => item.level === "warning");

  el.warningStatus.textContent = hasCritical ? "爆表" : hasWarning ? "警戒" : "安全";
  el.warningStatus.className = `status-pill ${hasCritical ? "danger" : hasWarning ? "warn" : "safe"}`;

  if (!warnings.length) {
    el.warningList.innerHTML = `<div class="alert-item safe"><strong>目前沒有明顯超支警示。</strong><span>仍建議定期匯出 JSON 備份。</span></div>`;
    return;
  }

  el.warningList.innerHTML = warnings.map(item => `
    <div class="alert-item ${item.level}">
      <strong>${escapeHtml(item.title)}</strong>
      <span>${escapeHtml(item.message)}</span>
    </div>
  `).join("");
}

function buildWarnings(year, summary) {
  const warnings = [];
  if (summary.planned > summary.available) {
    warnings.push({
      level: "warning",
      title: "計畫花費超過可用總額",
      message: `年度計畫超出 ${formatMoney(summary.planned - summary.available)}。`
    });
  }
  if (summary.actualExpense > summary.available) {
    warnings.push({
      level: "critical",
      title: "實際花費已超過可用總額",
      message: `目前赤字 ${formatMoney(summary.actualExpense - summary.available)}，會結轉到下一年。`
    });
  }
  if (summary.ending < 0) {
    warnings.push({
      level: "critical",
      title: "年度結轉為赤字",
      message: `若現在結算，下一年會先背 ${formatMoney(Math.abs(summary.ending))} 赤字。`
    });
  }
  if (summary.actualExpense > summary.planned && summary.planned > 0) {
    warnings.push({
      level: "warning",
      title: "實際花費已超過年度計畫",
      message: `實際比計畫多 ${formatMoney(summary.actualExpense - summary.planned)}。`
    });
  }

  const comparisons = computeCategoryComparisons(year);
  comparisons.forEach(item => {
    if (item.limit !== null && item.actual > item.limit) {
      warnings.push({
        level: "critical",
        title: `${item.category} 已超過分類上限`,
        message: `實際 ${formatMoney(item.actual)}，上限 ${formatMoney(item.limit)}，超出 ${formatMoney(item.actual - item.limit)}。`
      });
    } else if (item.limit !== null && item.plan > item.limit) {
      warnings.push({
        level: "warning",
        title: `${item.category} 計畫已高於分類上限`,
        message: `計畫 ${formatMoney(item.plan)}，上限 ${formatMoney(item.limit)}。`
      });
    } else if (item.limit !== null && item.limit > 0 && item.actual / item.limit >= 0.8) {
      warnings.push({
        level: "warning",
        title: `${item.category} 使用率達 ${(item.actual / item.limit * 100).toFixed(0)}%`,
        message: `剩餘 ${formatMoney(item.limit - item.actual)}。`
      });
    }
  });

  return warnings;
}

function renderLedger(summary) {
  const year = summary.year;
  const expenseGroups = getActualExpenseByCategory(year);
  const incomeGroups = getActualIncomeByCategory(year);
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

  const debitBeforeBalance = sumAmounts(debits);
  const creditBeforeBalance = sumAmounts(credits);

  if (creditBeforeBalance > debitBeforeBalance) {
    debits.push({ label: "期末結餘", amount: creditBeforeBalance - debitBeforeBalance, special: "positive" });
  } else if (debitBeforeBalance > creditBeforeBalance) {
    credits.push({ label: "期末赤字", amount: debitBeforeBalance - creditBeforeBalance, special: "negative" });
  }

  const balanced = Math.max(sumAmounts(debits), sumAmounts(credits));
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

function renderCategoryAnalysis(year) {
  const comparisons = computeCategoryComparisons(year);
  if (!comparisons.length) {
    el.categoryProgressGrid.innerHTML = `<div class="empty-state full-span-grid">尚無分類資料。可先加入基準版或新增年度計畫。</div>`;
    el.varianceTableBody.innerHTML = `<tr><td colspan="8" class="empty-state">尚無分類差異資料。</td></tr>`;
    return;
  }

  el.categoryProgressGrid.innerHTML = comparisons.map(item => renderCategoryCard(item)).join("");
  el.varianceTableBody.innerHTML = comparisons.map(item => renderVarianceRow(item)).join("");

  el.categoryProgressGrid.querySelectorAll("[data-action='edit-budget']").forEach(button => {
    button.addEventListener("click", () => editBudget(button.dataset.id));
  });
  el.categoryProgressGrid.querySelectorAll("[data-action='delete-budget']").forEach(button => {
    button.addEventListener("click", () => deleteBudget(button.dataset.id));
  });
  el.varianceTableBody.querySelectorAll("[data-action='edit-budget']").forEach(button => {
    button.addEventListener("click", () => editBudget(button.dataset.id));
  });
  el.varianceTableBody.querySelectorAll("[data-action='delete-budget']").forEach(button => {
    button.addEventListener("click", () => deleteBudget(button.dataset.id));
  });
}

function renderCategoryCard(item) {
  const limitText = item.limit === null ? "未設定" : formatMoney(item.limit);
  const percent = item.limit && item.limit > 0 ? (item.actual / item.limit) * 100 : 0;
  const barClass = item.limit === null ? "neutral" : percent >= 100 ? "danger" : percent >= 80 ? "warning" : "safe";
  const width = item.limit && item.limit > 0 ? Math.min(percent, 120) : 0;
  const status = categoryStatus(item);
  const actionButtons = item.budgetId ? `
    <div class="mini-actions">
      <button class="mini-btn" data-action="edit-budget" data-id="${item.budgetId}" type="button">編輯上限</button>
      <button class="mini-btn danger-text" data-action="delete-budget" data-id="${item.budgetId}" type="button">刪除</button>
    </div>
  ` : `<div class="mini-actions"><span class="muted tiny">尚未設定分類上限</span></div>`;

  return `
    <article class="category-card ${barClass}">
      <div class="category-topline">
        <strong>${escapeHtml(item.category)}</strong>
        <span class="status-dot ${status.className}">${status.label}</span>
      </div>
      <div class="category-numbers">
        <span>實際 ${formatMoney(item.actual)}</span>
        <span>上限 ${limitText}</span>
      </div>
      <div class="progress-bar" aria-label="${escapeHtml(item.category)} 使用率">
        <div class="progress-fill ${barClass}" style="width: ${width}%;"></div>
      </div>
      <p class="hint">使用率：${item.limit ? percent.toFixed(1) + "%" : "N/A"}｜計畫：${formatMoney(item.plan)}</p>
      ${actionButtons}
    </article>
  `;
}

function renderVarianceRow(item) {
  const diff = item.actual - item.plan;
  const remainingLimit = item.limit === null ? null : item.limit - item.actual;
  const status = categoryStatus(item);
  const actions = item.budgetId ? `
    <div class="action-buttons">
      <button class="icon-btn edit" data-action="edit-budget" data-id="${item.budgetId}" type="button">編輯</button>
      <button class="icon-btn" data-action="delete-budget" data-id="${item.budgetId}" type="button">刪除</button>
    </div>
  ` : `<span class="muted">—</span>`;

  return `
    <tr>
      <td><span class="badge">${escapeHtml(item.category)}</span></td>
      <td>${item.limit === null ? "未設定" : formatMoney(item.limit)}</td>
      <td>${formatMoney(item.plan)}</td>
      <td>${formatMoney(item.actual)}</td>
      <td class="${signClass(diff)}">${formatSignedMoney(diff)}</td>
      <td class="${remainingLimit === null ? "" : signClass(remainingLimit)}">${remainingLimit === null ? "N/A" : formatMoney(remainingLimit)}</td>
      <td><span class="status-dot ${status.className}">${status.label}</span></td>
      <td>${actions}</td>
    </tr>
  `;
}

function categoryStatus(item) {
  if (item.limit === null) return { label: "無上限", className: "neutral" };
  if (item.actual > item.limit) return { label: "超支", className: "danger" };
  if (item.plan > item.limit) return { label: "計畫超限", className: "warn" };
  if (item.limit > 0 && item.actual / item.limit >= 0.8) return { label: "接近上限", className: "warn" };
  return { label: "正常", className: "safe" };
}

function renderPlanTable(year) {
  const plans = state.plans
    .filter(item => Number(item.year) === year)
    .sort((a, b) => safeDate(a.createdAt).localeCompare(safeDate(b.createdAt)));

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
        <td>${formatNumber(item.count)}</td>
        <td>${formatMoney(item.unitPrice)}</td>
        <td>${formatMoney(subtotal)}</td>
        <td>
          <div class="action-buttons">
            <button class="icon-btn edit" data-action="edit-plan" data-id="${item.id}" type="button">編輯</button>
            <button class="icon-btn" data-action="delete-plan" data-id="${item.id}" type="button">刪除</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  el.planTableBody.querySelectorAll("[data-action='edit-plan']").forEach(button => {
    button.addEventListener("click", () => editPlan(button.dataset.id));
  });
  el.planTableBody.querySelectorAll("[data-action='delete-plan']").forEach(button => {
    button.addEventListener("click", () => deletePlan(button.dataset.id));
  });
}

function renderTransactionTable(year) {
  const txns = state.transactions
    .filter(item => Number(item.year) === year)
    .sort((a, b) => `${b.date}${safeDate(b.createdAt)}`.localeCompare(`${a.date}${safeDate(a.createdAt)}`));

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
        <td>
          <div class="action-buttons">
            <button class="icon-btn edit" data-action="edit-txn" data-id="${item.id}" type="button">編輯</button>
            <button class="icon-btn" data-action="delete-txn" data-id="${item.id}" type="button">刪除</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  el.txnTableBody.querySelectorAll("[data-action='edit-txn']").forEach(button => {
    button.addEventListener("click", () => editTransaction(button.dataset.id));
  });
  el.txnTableBody.querySelectorAll("[data-action='delete-txn']").forEach(button => {
    button.addEventListener("click", () => deleteTransaction(button.dataset.id));
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
      <td class="${signClass(item.nextCarryover)}">${formatMoney(item.nextCarryover)}</td>
      <td>${escapeHtml(item.note || "")}</td>
    </tr>
  `).join("");
}

function deleteYear(year) {
  const years = getAllYears();
  if (years.length <= 1) {
    alert("至少需要保留一個年度。");
    return;
  }

  const planCount = state.plans.filter(item => Number(item.year) === year).length;
  const txnCount = state.transactions.filter(item => Number(item.year) === year).length;
  const budgetCount = state.categoryBudgets.filter(item => Number(item.year) === year).length;
  const message = `確定刪除 ${year} 年？\n會同時刪除：${planCount} 筆年度計畫、${txnCount} 筆實際流水帳、${budgetCount} 筆分類上限。`;
  if (!confirm(message)) return;

  delete state.years[String(year)];
  state.plans = state.plans.filter(item => Number(item.year) !== year);
  state.transactions = state.transactions.filter(item => Number(item.year) !== year);
  state.categoryBudgets = state.categoryBudgets.filter(item => Number(item.year) !== year);
  const nextYears = getAllYears().filter(item => item !== year);
  state.selectedYear = nextYears.length ? nextYears[Math.max(0, nextYears.length - 1)] : new Date().getFullYear();
  if (!nextYears.length) ensureYear(state.selectedYear);
  resetPlanForm();
  resetTxnForm();
  resetBudgetForm();
  saveState();
  render();
}

function copyPreviousYearPlan() {
  const currentYear = getSelectedYear();
  const previousYears = getAllYears().filter(year => year < currentYear).sort((a, b) => b - a);
  const sourceYear = previousYears.find(year => state.plans.some(item => Number(item.year) === year));

  if (!sourceYear) {
    alert("找不到有年度計畫的上一年度。");
    return;
  }

  const sourcePlans = state.plans.filter(item => Number(item.year) === sourceYear);
  const sourceBudgets = state.categoryBudgets.filter(item => Number(item.year) === sourceYear);
  const currentPlanCount = state.plans.filter(item => Number(item.year) === currentYear).length;
  const currentBudgetCount = state.categoryBudgets.filter(item => Number(item.year) === currentYear).length;

  const message = `${sourceYear} 年有 ${sourcePlans.length} 筆計畫、${sourceBudgets.length} 筆分類上限。\n將複製到 ${currentYear} 年；不會複製實際流水帳。${currentPlanCount || currentBudgetCount ? "\n目前年度已有資料，計畫會追加、同名分類上限會更新。" : ""}`;
  if (!confirm(message)) return;

  sourcePlans.forEach(item => {
    state.plans.push({
      id: createId(),
      year: currentYear,
      category: item.category,
      name: item.name,
      count: item.count,
      unitPrice: item.unitPrice,
      note: item.note,
      createdAt: nowIso()
    });
  });

  sourceBudgets.forEach(item => {
    upsertCategoryBudget(currentYear, item.category, item.limit, item.note || `由 ${sourceYear} 年複製`);
  });

  saveState();
  render();
}

function editPlan(id) {
  const item = state.plans.find(plan => plan.id === id);
  if (!item) return;
  editingPlanId = id;
  state.selectedYear = Number(item.year);
  ensureYear(state.selectedYear);
  saveState();
  render();
  el.planCategory.value = item.category;
  el.planName.value = item.name;
  el.planCount.value = item.count;
  el.planUnitPrice.value = item.unitPrice;
  el.planNote.value = item.note || "";
  el.planSubmitBtn.textContent = "儲存計畫項目";
  el.cancelPlanEditBtn.classList.remove("hidden");
  el.planForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function deletePlan(id) {
  const item = state.plans.find(plan => plan.id === id);
  if (!item) return;
  if (!confirm(`確定刪除計畫項目「${item.name}」？`)) return;
  state.plans = state.plans.filter(plan => plan.id !== id);
  if (editingPlanId === id) resetPlanForm();
  saveState();
  render();
}

function resetPlanForm() {
  editingPlanId = null;
  el.planForm.reset();
  el.planCount.value = 1;
  el.planSubmitBtn.textContent = "新增計畫項目";
  el.cancelPlanEditBtn.classList.add("hidden");
}

function editTransaction(id) {
  const item = state.transactions.find(txn => txn.id === id);
  if (!item) return;
  editingTxnId = id;
  state.selectedYear = Number(item.year);
  ensureYear(state.selectedYear);
  saveState();
  render();
  el.txnDate.value = item.date;
  el.txnType.value = item.type;
  el.txnCategory.value = item.category;
  el.txnName.value = item.name;
  el.txnAmount.value = item.amount;
  el.txnNote.value = item.note || "";
  el.txnSubmitBtn.textContent = "儲存實際紀錄";
  el.cancelTxnEditBtn.classList.remove("hidden");
  el.txnForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function deleteTransaction(id) {
  const item = state.transactions.find(txn => txn.id === id);
  if (!item) return;
  if (!confirm(`確定刪除實際紀錄「${item.name}」？`)) return;
  state.transactions = state.transactions.filter(txn => txn.id !== id);
  if (editingTxnId === id) resetTxnForm();
  saveState();
  render();
}

function resetTxnForm(keepDate) {
  editingTxnId = null;
  el.txnForm.reset();
  el.txnDate.value = keepDate || todayString();
  el.txnType.value = "expense";
  el.txnSubmitBtn.textContent = "新增實際紀錄";
  el.cancelTxnEditBtn.classList.add("hidden");
}

function editBudget(id) {
  const item = state.categoryBudgets.find(budget => budget.id === id);
  if (!item) return;
  editingBudgetId = id;
  state.selectedYear = Number(item.year);
  ensureYear(state.selectedYear);
  saveState();
  render();
  el.limitCategory.value = item.category;
  el.limitAmount.value = item.limit;
  el.limitNote.value = item.note || "";
  el.limitSubmitBtn.textContent = "儲存分類上限";
  el.cancelLimitEditBtn.classList.remove("hidden");
  el.budgetLimitForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function deleteBudget(id) {
  const item = state.categoryBudgets.find(budget => budget.id === id);
  if (!item) return;
  if (!confirm(`確定刪除「${item.category}」分類上限？`)) return;
  state.categoryBudgets = state.categoryBudgets.filter(budget => budget.id !== id);
  if (editingBudgetId === id) resetBudgetForm();
  saveState();
  render();
}

function resetBudgetForm() {
  editingBudgetId = null;
  el.budgetLimitForm.reset();
  el.limitSubmitBtn.textContent = "新增 / 更新上限";
  el.cancelLimitEditBtn.classList.add("hidden");
}

function upsertBudgetsFromTemplate(year, overwrite = false) {
  const grouped = defaultPlanTemplate.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + item.count * item.unitPrice;
    return acc;
  }, {});

  Object.entries(grouped).forEach(([category, limit]) => {
    const existing = state.categoryBudgets.find(item => Number(item.year) === year && item.category === category);
    if (!existing || overwrite) upsertCategoryBudget(year, category, limit, "基準版分類上限");
  });
}

function upsertCategoryBudget(year, category, limit, note = "") {
  const cleanedCategory = cleanText(category);
  const existing = state.categoryBudgets.find(item => Number(item.year) === year && item.category === cleanedCategory);
  if (existing) {
    existing.limit = positiveNumber(limit, 0);
    existing.note = cleanText(note || existing.note || "");
    existing.updatedAt = nowIso();
  } else {
    state.categoryBudgets.push({
      id: createId(),
      year,
      category: cleanedCategory,
      limit: positiveNumber(limit, 0),
      note: cleanText(note),
      createdAt: nowIso()
    });
  }
}

function computeCategoryComparisons(year) {
  const planMap = getPlanByCategory(year);
  const actualMap = getActualExpenseByCategory(year);
  const budgetMap = getCategoryBudgetMap(year);
  const categories = new Set([
    ...Object.keys(planMap),
    ...Object.keys(actualMap),
    ...Object.keys(budgetMap)
  ]);

  return [...categories].sort((a, b) => a.localeCompare(b, "zh-Hant")).map(category => {
    const budget = budgetMap[category] || null;
    return {
      category,
      plan: planMap[category] || 0,
      actual: actualMap[category] || 0,
      limit: budget ? budget.limit : null,
      note: budget ? budget.note : "",
      budgetId: budget ? budget.id : ""
    };
  });
}

function getPlanTotal(year) {
  return state.plans
    .filter(item => Number(item.year) === year)
    .reduce((sum, item) => sum + item.count * item.unitPrice, 0);
}

function getActualExpenseTotal(year) {
  return state.transactions
    .filter(item => Number(item.year) === year && item.type === "expense")
    .reduce((sum, item) => sum + item.amount, 0);
}

function getActualIncomeTotal(year) {
  return state.transactions
    .filter(item => Number(item.year) === year && item.type === "income")
    .reduce((sum, item) => sum + item.amount, 0);
}

function getPlanByCategory(year) {
  return state.plans
    .filter(item => Number(item.year) === year)
    .reduce((acc, item) => {
      const category = item.category || "其他";
      acc[category] = (acc[category] || 0) + item.count * item.unitPrice;
      return acc;
    }, {});
}

function getActualExpenseByCategory(year) {
  return state.transactions
    .filter(item => Number(item.year) === year && item.type === "expense")
    .reduce((acc, item) => {
      const category = item.category || "其他";
      acc[category] = (acc[category] || 0) + item.amount;
      return acc;
    }, {});
}

function getActualIncomeByCategory(year) {
  return state.transactions
    .filter(item => Number(item.year) === year && item.type === "income")
    .reduce((acc, item) => {
      const category = item.category || "其他";
      acc[category] = (acc[category] || 0) + item.amount;
      return acc;
    }, {});
}

function getCategoryBudgetMap(year) {
  return state.categoryBudgets
    .filter(item => Number(item.year) === year)
    .reduce((acc, item) => {
      acc[item.category] = item;
      return acc;
    }, {});
}

function sumAmounts(rows) {
  return rows.reduce((sum, item) => sum + item.amount, 0);
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
  el.txnDate.value = todayString();
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function nowIso() {
  return new Date().toISOString();
}

function safeDate(value) {
  return value || "";
}

function formatMoney(value) {
  const rounded = Math.round(numberOrZero(value));
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0
  }).format(rounded);
}

function formatSignedMoney(value) {
  const number = numberOrZero(value);
  if (number > 0) return `+${formatMoney(number)}`;
  if (number < 0) return `-${formatMoney(Math.abs(number))}`;
  return formatMoney(0);
}

function formatNumber(value) {
  return new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 2 }).format(numberOrZero(value));
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

function dateTimeStamp() {
  const date = new Date();
  const pad = number => String(number).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}
