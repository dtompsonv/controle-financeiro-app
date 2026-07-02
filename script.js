const STORAGE_KEY = "controle-financeiro-desktop-v2";
const LOCAL_API_STATE_URL = "/api/state";
const GOOGLE_SHEETS_API_URL = "https://script.google.com/macros/s/AKfycbzSvWW3NfJ5pLjHfizms1E04-4_W7T5xJHcL9ua3cPASv43SO0NnFMt0gxDICNJNa5Y/exec";
const GOOGLE_SHEETS_TOKEN_STORAGE_KEY = "controle-financeiro-token";
const REMOTE_SYNC_INTERVAL_MS = 5000;
const DEFAULT_CATEGORIES = [
  "Alimentacao",
  "Combustivel",
  "Supermercado",
  "Lazer",
  "Vestuario",
  "Eletronicos",
  "Outros"
];
const uiState = {
  fixedCostPaymentDraft: null
};

const state = createInitialState();
let stateSnapshot = "";
let syncIntervalId = null;

const elements = {
  currentMonthLabel: document.querySelector("#currentMonthLabel"),
  selectedMonthLabel: document.querySelector("#selectedMonthLabel"),
  balanceModeLabel: document.querySelector("#balanceModeLabel"),
  balanceModeDescription: document.querySelector("#balanceModeDescription"),
  balanceMenuToggle: document.querySelector("#balanceMenuToggle"),
  balanceMenu: document.querySelector("#balanceMenu"),
  netBalance: document.querySelector("#netBalance"),
  aggregatorTotal: document.querySelector("#aggregatorTotal"),
  fixedCostsTotal: document.querySelector("#fixedCostsTotal"),
  checkingTotal: document.querySelector("#checkingTotal"),
  selectedAggregatorName: document.querySelector("#selectedAggregatorName"),
  selectedAggregatorType: document.querySelector("#selectedAggregatorType"),
  aggregatorFilter: document.querySelector("#aggregatorFilter"),
  aggregatorList: document.querySelector("#aggregatorList"),
  aggregatorDetailsTitle: document.querySelector("#aggregatorDetailsTitle"),
  aggregatorTransactionList: document.querySelector("#aggregatorTransactionList"),
  transactionList: document.querySelector("#transactionList"),
  statementIncome: document.querySelector("#statementIncome"),
  statementExpense: document.querySelector("#statementExpense"),
  statementBalance: document.querySelector("#statementBalance"),
  statementList: document.querySelector("#statementList"),
  allCardsCostChart: document.querySelector("#allCardsCostChart"),
  allCardsCostPie: document.querySelector("#allCardsCostPie"),
  selectedCardCostChart: document.querySelector("#selectedCardCostChart"),
  selectedCardCostPie: document.querySelector("#selectedCardCostPie"),
  selectedCostChartTitle: document.querySelector("#selectedCostChartTitle"),
  checkingExpensePie: document.querySelector("#checkingExpensePie"),
  checkingExpenseChart: document.querySelector("#checkingExpenseChart"),
  checkingIncomePie: document.querySelector("#checkingIncomePie"),
  checkingIncomeChart: document.querySelector("#checkingIncomeChart"),
  allAggregatorCharts: document.querySelector("#allAggregatorCharts"),
  fixedCostsList: document.querySelector("#fixedCostsList"),
  fixedCostsMonthTotal: document.querySelector("#fixedCostsMonthTotal"),
  fixedCostsRemainingTotal: document.querySelector("#fixedCostsRemainingTotal"),
  transactionForm: document.querySelector("#transactionForm"),
  aggregatorForm: document.querySelector("#aggregatorForm"),
  categoryForm: document.querySelector("#categoryForm"),
  transactionId: document.querySelector("#transactionId"),
  fixedCostId: document.querySelector("#fixedCostId"),
  aggregatorId: document.querySelector("#aggregatorId"),
  transactionAggregator: document.querySelector("#transactionAggregator"),
  transactionCategory: document.querySelector("#transactionCategory"),
  transactionBucket: document.querySelector("#transactionBucket"),
  paymentMethod: document.querySelector("#paymentMethod"),
  installments: document.querySelector("#installments"),
  installmentsField: document.querySelector("#installmentsField"),
  futureIncomeMonths: document.querySelector("#futureIncomeMonths"),
  futureIncomeField: document.querySelector("#futureIncomeField"),
  recurrenceLabel: document.querySelector("#recurrenceLabel"),
  transactionSubmit: document.querySelector("#transactionSubmit"),
  cancelEdit: document.querySelector("#cancelEdit"),
  aggregatorSubmit: document.querySelector("#aggregatorSubmit"),
  cancelAggregatorEdit: document.querySelector("#cancelAggregatorEdit"),
  previousMonth: document.querySelector("#previousMonth"),
  nextMonth: document.querySelector("#nextMonth"),
  menuItems: document.querySelectorAll(".menu-item"),
  sections: {
    resumo: document.querySelector("#section-resumo"),
    custos: document.querySelector("#section-custos"),
    extrato: document.querySelector("#section-extrato"),
    fixos: document.querySelector("#section-fixos"),
    movimentacao: document.querySelector("#section-movimentacao"),
    agrupadores: document.querySelector("#section-agrupadores")
  }
};

requestTokenAndBoot();

function getGoogleSheetsToken() {
  return localStorage.getItem(GOOGLE_SHEETS_TOKEN_STORAGE_KEY) || "";
}

function setGoogleSheetsToken(token) {
  localStorage.setItem(GOOGLE_SHEETS_TOKEN_STORAGE_KEY, token);
}

function requestTokenAndBoot() {
  const existingToken = getGoogleSheetsToken();

  if (existingToken) {
    boot();
    return;
  }

  showTokenLockScreen();
}

function showTokenLockScreen() {
  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;background:#111318;color:#f5f5f5;display:flex;align-items:center;justify-content:center;z-index:9999;font-family:system-ui,sans-serif;";
  overlay.innerHTML = `
    <form id="tokenLockForm" style="background:#1e2027;padding:28px;border-radius:10px;display:flex;flex-direction:column;gap:14px;min-width:280px;box-shadow:0 8px 24px rgba(0,0,0,0.4);">
      <label for="tokenLockInput" style="font-size:14px;">Digite a senha de acesso</label>
      <input id="tokenLockInput" type="password" autocomplete="off" style="padding:10px;border-radius:6px;border:1px solid #3a3d46;background:#111318;color:#fff;font-size:14px;" />
      <button type="submit" style="padding:10px;border-radius:6px;border:none;background:#2563eb;color:#fff;font-size:14px;cursor:pointer;">Entrar</button>
      <p id="tokenLockError" style="color:#f87171;font-size:12px;display:none;margin:0;">Senha incorreta ou falha na conexao. Tente novamente.</p>
    </form>
  `;
  document.body.appendChild(overlay);

  const form = overlay.querySelector("#tokenLockForm");
  const input = overlay.querySelector("#tokenLockInput");
  const errorLabel = overlay.querySelector("#tokenLockError");
  input.focus();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const candidate = input.value.trim();

    if (!candidate) {
      return;
    }

    const isValid = await validateToken(candidate);

    if (!isValid) {
      errorLabel.style.display = "block";
      return;
    }

    setGoogleSheetsToken(candidate);
    overlay.remove();
    boot();
  });
}

async function validateToken(candidate) {
  try {
    const url = new URL(GOOGLE_SHEETS_API_URL);
    url.searchParams.set("token", candidate);
    const response = await fetch(url.toString(), { cache: "no-store" });

    if (!response.ok) {
      return false;
    }

    const payload = await response.json();
    return Boolean(payload?.success);
  } catch (error) {
    return false;
  }
}

async function boot() {
  await hydrateState();
  elements.currentMonthLabel.textContent = monthLabel(new Date());
  runMigrations();
  resetTransactionForm();
  wireNavigation();
  wireForms();
  wireMonthNavigation();
  wireGlobalActions();
  wireBalanceMenu();
  renderAll();
  startRemoteSync();
}

function wireNavigation() {
  elements.menuItems.forEach((button) => {
    button.addEventListener("click", () => {
      activateSection(button.dataset.section);
    });
  });
}

function wireForms() {
  elements.transactionBucket.addEventListener("change", syncTransactionFormState);
  elements.paymentMethod.addEventListener("change", syncTransactionFormState);
  elements.transactionForm.kind.addEventListener("change", syncTransactionFormState);
  elements.cancelEdit.addEventListener("click", resetTransactionForm);
  elements.cancelAggregatorEdit.addEventListener("click", resetAggregatorForm);

  elements.aggregatorFilter.addEventListener("change", (event) => {
    state.selectedAggregatorId = event.target.value || null;
    persistState();
    renderSummary();
    renderAggregatorList();
    renderAggregatorTransactionList();
  });

  elements.transactionForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const editingId = String(data.get("transactionId") || "");
    const fixedCostEditingId = String(data.get("fixedCostId") || "");
    const kind = String(data.get("kind"));
    const bucket = String(data.get("bucket"));
    const paymentMethod = kind === "expense" ? String(data.get("paymentMethod")) : "avista";
    const installments = paymentMethod === "credito" ? Math.max(Number(data.get("installments")) || 1, 1) : 1;
    const futureIncomeMonths = ((kind === "income" && bucket === "checking") || bucket === "fixed")
      ? Math.max(Number(data.get("futureIncomeMonths")) || 1, 1)
      : 1;

    const payload = {
      description: String(data.get("description")).trim(),
      kind,
      category: String(data.get("category")),
      bucket,
      amount: Number(data.get("amount")),
      date: String(data.get("date")),
      aggregatorId: bucket === "agrupador" ? String(data.get("aggregatorId") || "") : "",
      paymentMethod,
      installments,
      futureIncomeMonths
    };

    if (bucket === "fixed" && fixedCostEditingId) {
      updateFixedCost(fixedCostEditingId, payload);
    } else if (bucket === "fixed" && !editingId) {
      createFixedCost(payload);
    } else if (editingId) {
      updateTransaction(editingId, payload);
    } else {
      createTransactions(payload);
    }

    persistState();
    resetTransactionForm();
    renderAll();
  });

  elements.aggregatorForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const aggregatorId = String(data.get("aggregatorId") || "");
    const aggregator = {
      id: aggregatorId || crypto.randomUUID(),
      name: String(data.get("name")).trim(),
      type: String(data.get("type"))
    };

    if (aggregatorId) {
      updateAggregator(aggregator);
    } else {
      state.aggregators.push(aggregator);
    }

    state.selectedAggregatorId = aggregator.id;
    persistState();
    resetAggregatorForm();
    renderAll();
  });

  elements.categoryForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name")).trim();

    if (!name) {
      return;
    }

    const exists = state.categories.some((item) => item.toLowerCase() === name.toLowerCase());

    if (!exists) {
      state.categories.push(name);
      state.categories.sort((left, right) => left.localeCompare(right, "pt-BR"));
      persistState();
      renderCategoryOptions();
    }

    event.currentTarget.reset();
  });
}

function wireMonthNavigation() {
  elements.previousMonth.addEventListener("click", () => {
    changeSelectedMonth(-1);
  });

  elements.nextMonth.addEventListener("click", () => {
    changeSelectedMonth(1);
  });
}

function wireGlobalActions() {
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".transaction-menu")) {
      closeAllMenus();
    }

    if (!event.target.closest(".balance-header")) {
      elements.balanceMenu.classList.add("hidden");
    }
  });
}

function wireBalanceMenu() {
  elements.balanceMenuToggle.addEventListener("click", (event) => {
    event.stopPropagation();
    elements.balanceMenu.classList.toggle("hidden");
  });

  elements.balanceMenu.querySelectorAll("[data-balance-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.balanceMode = button.dataset.balanceMode;
      persistState();
      elements.balanceMenu.classList.add("hidden");
      renderSummary();
    });
  });
}

function activateSection(target) {
  elements.menuItems.forEach((item) => item.classList.toggle("active", item.dataset.section === target));
  Object.entries(elements.sections).forEach(([key, section]) => {
    section.classList.toggle("visible", key === target);
  });
}

function renderAll() {
  renderCategoryOptions();
  renderAggregatorOptions();
  renderSummary();
  renderCostSummary();
  renderStatement();
  renderFixedCosts();
  renderAggregatorList();
  renderAggregatorTransactionList();
  renderTransactionList();
}

function renderCategoryOptions() {
  const selectedValue = elements.transactionCategory.value;

  elements.transactionCategory.innerHTML = state.categories
    .map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`)
    .join("");

  if (state.categories.includes(selectedValue)) {
    elements.transactionCategory.value = selectedValue;
  }
}

function renderAggregatorOptions() {
  const transactionSelection = elements.transactionAggregator.value;
  const options = state.aggregators
    .map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`)
    .join("");

  elements.aggregatorFilter.innerHTML = state.aggregators.length
    ? options
    : `<option value="">Nenhum cadastrado</option>`;
  elements.transactionAggregator.innerHTML = state.aggregators.length
    ? `<option value="">Selecione</option>${options}`
    : `<option value="">Cadastre primeiro</option>`;

  elements.aggregatorFilter.value = state.selectedAggregatorId || "";

  if (state.aggregators.some((item) => item.id === transactionSelection)) {
    elements.transactionAggregator.value = transactionSelection;
  }

  syncTransactionFormState();
}

function renderSummary() {
  const selectedAggregator = state.aggregators.find((item) => item.id === state.selectedAggregatorId) || null;
  const entries = transactionsForSelectedMonth();
  const aggregatorTotal = aggregatorNetTotalForMonth(state.selectedAggregatorId, entries);
  const fixedCostsTotal = fixedCostsForSelectedMonth()
    .reduce((sum, item) => sum + item.remainingAmount, 0);
  const balances = calculateMonthBalances(state.selectedMonth.year, state.selectedMonth.month);
  const balanceMode = state.balanceMode || "actual";
  const visibleBalance = balanceMode === "predicted"
    ? balances.predicted
    : balances.actual;

  elements.selectedMonthLabel.textContent = monthLabel(selectedMonthDate());
  elements.selectedAggregatorName.textContent = selectedAggregator?.name || "Nenhum cadastrado";
  elements.selectedAggregatorType.textContent = selectedAggregator?.type || "Sem tipo";
  elements.balanceModeLabel.textContent = balanceMode === "predicted" ? "Saldo Previsto" : "Saldo do mes";
  elements.balanceModeDescription.textContent = balanceMode === "predicted"
    ? "Saldo da conta corrente menos o cartao anterior ainda pendente e os custos fixos restantes do mes."
    : "Saldo acumulado da conta corrente ate o mes selecionado.";
  elements.aggregatorTotal.textContent = currency(aggregatorTotal);
  elements.fixedCostsTotal.textContent = currency(fixedCostsTotal);
  elements.checkingTotal.textContent = currency(balances.actual);
  elements.netBalance.textContent = currency(visibleBalance);
}

function renderFixedCosts() {
  const items = fixedCostsForSelectedMonth();
  const monthTotal = items.reduce((sum, item) => sum + item.originalAmount, 0);
  const remainingTotal = items.reduce((sum, item) => sum + item.remainingAmount, 0);
  const cardOptions = state.aggregators
    .filter((item) => item.type === "Cartao")
    .map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`)
    .join("");

  elements.fixedCostsMonthTotal.textContent = currency(monthTotal);
  elements.fixedCostsRemainingTotal.textContent = currency(remainingTotal);

  if (!items.length) {
    elements.fixedCostsList.innerHTML = `<div class="empty-state">Nao ha custos fixos cadastrados no mes selecionado.</div>`;
    return;
  }

  elements.fixedCostsList.innerHTML = items
    .map((item) => {
      const isPaid = item.remainingAmount <= 0;
      const reimbursedAmount = item.reimbursedAmount || 0;
      const draft = uiState.fixedCostPaymentDraft?.fixedCostId === item.id ? uiState.fixedCostPaymentDraft : null;
      const status = fixedCostStatus(item);

      return `
        <div class="list-item fixed-cost-row">
          <div>
            <div class="fixed-cost-head">
              <strong>${escapeHtml(item.description)}</strong>
              <span class="status-pill status-${status.key}">${status.label}</span>
            </div>
            <p class="item-meta">${escapeHtml(item.category)} - Previsto: ${currency(item.originalAmount)} - Valor atual: ${currency(item.remainingAmount)} - Restante: ${currency(item.remainingAmount)}${reimbursedAmount > 0 ? ` - Reembolsado: ${currency(reimbursedAmount)}` : ""}</p>
          </div>
          <div class="item-actions">
            <span class="${isPaid ? "income" : "expense"}">${isPaid ? "Pago" : currency(item.remainingAmount)}</span>
            <div class="menu-anchor">
              <button type="button" class="menu-toggle" data-fixed-cost-menu-toggle="${item.id}" aria-label="Abrir menu do custo fixo">
                <span></span>
                <span></span>
                <span></span>
              </button>
              <div class="dropdown-menu hidden" data-fixed-cost-menu="${item.id}">
                <button type="button" class="dropdown-item" data-edit-fixed-cost="${item.id}">Editar</button>
                <button type="button" class="dropdown-item danger-item" data-delete-fixed-cost="${item.id}">Excluir</button>
                <button
                  type="button"
                  class="dropdown-item${isPaid ? " disabled-item" : ""}"
                  data-fixed-cost-reimburse="${item.id}"
                  ${isPaid ? "disabled" : ""}
                >
                  Reembolso do saldo
                </button>
                <button
                  type="button"
                  class="dropdown-item${isPaid ? " disabled-item" : ""}"
                  data-fixed-cost-action="${item.id}"
                  data-fixed-cost-mode="integral"
                  ${isPaid ? "disabled" : ""}
                >
                  Pagamento integral
                </button>
                <button
                  type="button"
                  class="dropdown-item${isPaid ? " disabled-item" : ""}"
                  data-fixed-cost-action="${item.id}"
                  data-fixed-cost-mode="partial"
                  ${isPaid ? "disabled" : ""}
                >
                  Pagamento parcial
                </button>
              </div>
            </div>
          </div>
          ${draft ? `
            <div class="fixed-cost-payment-box">
              <label>
                Valor pago
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  id="fixed-cost-amount-${item.id}"
                  value="${draft.mode === "integral" ? item.remainingAmount : item.remainingAmount}"
                  ${draft.mode === "integral" ? "readonly" : ""}
                >
              </label>
              <label>
                Destino do pagamento
                <select id="fixed-cost-target-${item.id}">
                  <option value="checking">Conta Corrente</option>
                  <option value="card">Cartao</option>
                </select>
              </label>
              <label>
                Cartao
                <select id="fixed-cost-card-${item.id}" ${cardOptions ? "" : "disabled"}>
                  ${cardOptions || '<option value="">Sem cartao cadastrado</option>'}
                </select>
              </label>
              <div class="form-actions">
                <button type="button" class="primary-button" data-fixed-cost-confirm="${item.id}" data-fixed-cost-mode="${draft.mode}">Confirmar</button>
                <button type="button" class="secondary-button" data-fixed-cost-cancel="${item.id}">Cancelar</button>
              </div>
            </div>
          ` : ""}
        </div>
      `;
    })
    .join("");

  bindFixedCostMenus();
}

function renderAggregatorList() {
  if (!state.aggregators.length) {
    elements.aggregatorList.innerHTML = `<div class="empty-state">Cadastre um cartao ou agrupador para acompanhar os custos por origem.</div>`;
    return;
  }

  const entries = transactionsForSelectedMonth();

  elements.aggregatorList.innerHTML = state.aggregators
    .map((item) => {
      const total = aggregatorNetTotalForMonth(item.id, entries);
      const isSelected = item.id === state.selectedAggregatorId;
      const canPayCard = item.type === "Cartao" && total > 0;
      const alreadyPaid = canPayCard && hasCardPaymentForSelectedMonth(item.id);

      return `
        <div class="list-item aggregator-row${isSelected ? " selected-item" : ""}">
          <button
            type="button"
            class="aggregator-main"
            data-aggregator-id="${item.id}"
          >
            <div>
              <strong>${escapeHtml(item.name)}</strong>
              <p class="item-meta">${escapeHtml(item.type)}</p>
            </div>
            <strong class="expense">${currency(total)}</strong>
          </button>
          <div class="menu-anchor">
            ${(item.type === "Cartao" || item.type === "Agrupador") ? `
              <button type="button" class="menu-toggle" data-card-menu-toggle="${item.id}" aria-label="Abrir menu do cartao">
                <span></span>
                <span></span>
                <span></span>
              </button>
              <div class="dropdown-menu hidden" data-card-menu="${item.id}">
                <button type="button" class="dropdown-item" data-edit-aggregator="${item.id}">Editar</button>
                <button type="button" class="dropdown-item danger-item" data-delete-aggregator="${item.id}">Excluir</button>
                ${item.type === "Cartao" ? `
                  <button
                    type="button"
                    class="dropdown-item${!canPayCard || alreadyPaid ? " disabled-item" : ""}"
                    data-pay-card="${item.id}"
                    ${!canPayCard || alreadyPaid ? "disabled" : ""}
                  >
                    ${alreadyPaid ? "Cartao pago" : "Pagar cartao"}
                  </button>
                ` : ""}
              </div>
            ` : ""}
          </div>
        </div>
      `;
    })
    .join("");

  elements.aggregatorList.querySelectorAll("[data-aggregator-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedAggregatorId = button.dataset.aggregatorId;
      persistState();
      renderSummary();
      renderAggregatorList();
      renderAggregatorTransactionList();
      elements.aggregatorFilter.value = state.selectedAggregatorId || "";
    });
  });

  elements.aggregatorList.querySelectorAll("[data-card-menu-toggle]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleCardMenu(button.dataset.cardMenuToggle);
    });
  });

  elements.aggregatorList.querySelectorAll("[data-pay-card]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      registerCardPayment(button.dataset.payCard);
    });
  });

  elements.aggregatorList.querySelectorAll("[data-edit-aggregator]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      closeAllMenus();
      startEditingAggregator(button.dataset.editAggregator);
    });
  });

  elements.aggregatorList.querySelectorAll("[data-delete-aggregator]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteAggregator(button.dataset.deleteAggregator);
    });
  });
}

function renderAggregatorTransactionList() {
  const selectedAggregator = state.aggregators.find((item) => item.id === state.selectedAggregatorId) || null;

  if (!selectedAggregator) {
    elements.aggregatorDetailsTitle.textContent = "Lancamentos do cartao/agrupador";
    elements.aggregatorTransactionList.innerHTML = `<div class="empty-state">Selecione um cartao ou agrupador para ver os itens adicionados.</div>`;
    return;
  }

  const entries = transactionsForSelectedMonth()
    .filter((item) => item.bucket === "agrupador" && item.aggregatorId === selectedAggregator.id)
    .sort(compareTransactionsDesc);

  elements.aggregatorDetailsTitle.textContent = `Lancamentos de ${selectedAggregator.name}`;

  if (!entries.length) {
    elements.aggregatorTransactionList.innerHTML = `<div class="empty-state">Nao ha itens vinculados a ${escapeHtml(selectedAggregator.name)} neste mes.</div>`;
    return;
  }

  elements.aggregatorTransactionList.innerHTML = entries
    .map((item) => {
      const amountClass = item.kind === "income" ? "income" : "expense";
      const signal = item.kind === "income" ? "+" : "-";

      return `
        <div class="list-item transaction-menu" data-transaction-id="${item.id}">
          <div>
            <strong>${escapeHtml(item.description)}</strong>
            <p class="item-meta">${escapeHtml(item.category)} - ${paymentDetails(item)} - ${dateLabel(item.date)}</p>
          </div>
          <div class="item-actions">
            <strong class="${amountClass}">${signal} ${currency(item.amount)}</strong>
            <div class="menu-anchor">
              <button type="button" class="menu-toggle" data-menu-toggle="${item.id}" aria-label="Abrir menu de acoes">
                <span></span>
                <span></span>
                <span></span>
              </button>
              <div class="dropdown-menu hidden" data-menu="${item.id}">
                <button type="button" class="dropdown-item" data-edit-id="${item.id}">Editar</button>
                <button type="button" class="dropdown-item danger-item" data-delete-id="${item.id}">Excluir</button>
              </div>
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  bindTransactionMenus(elements.aggregatorTransactionList);
}

function renderStatement() {
  const monthEntries = transactionsForSelectedMonth()
    .filter((item) => item.bucket === "checking")
    .sort(compareTransactionsDesc);
  const monthIncome = monthEntries
    .filter((item) => item.kind === "income")
    .reduce((sum, item) => sum + item.amount, 0);
  const monthExpense = monthEntries
    .filter((item) => item.kind === "expense")
    .reduce((sum, item) => sum + item.amount, 0);
  const balanceEntries = transactionsUpToSelectedMonth();
  const balance = balanceEntries
    .filter((item) => item.bucket === "checking")
    .reduce((sum, item) => sum + (item.kind === "income" ? item.amount : -item.amount), 0);

  elements.statementIncome.textContent = currency(monthIncome);
  elements.statementExpense.textContent = currency(monthExpense);
  elements.statementBalance.textContent = currency(balance);

  if (!monthEntries.length) {
    elements.statementList.innerHTML = `<div class="empty-state">Nao ha lancamentos de conta corrente no mes selecionado.</div>`;
    return;
  }

  elements.statementList.innerHTML = monthEntries
    .map((item) => {
      const amountClass = item.kind === "income" ? "income" : "expense";
      const signal = item.kind === "income" ? "+" : "-";

      return `
        <div class="list-item transaction-menu" data-transaction-id="${item.id}">
          <div>
            <strong>${escapeHtml(item.description)}</strong>
            <p class="item-meta">${escapeHtml(item.category)} - ${dateLabel(item.date)}</p>
          </div>
          <div class="item-actions">
            <strong class="${amountClass}">${signal} ${currency(item.amount)}</strong>
            <div class="menu-anchor">
              <button type="button" class="menu-toggle" data-menu-toggle="${item.id}" aria-label="Abrir menu de acoes">
                <span></span>
                <span></span>
                <span></span>
              </button>
              <div class="dropdown-menu hidden" data-menu="${item.id}">
                <button type="button" class="dropdown-item" data-edit-id="${item.id}">Editar</button>
                <button type="button" class="dropdown-item danger-item" data-delete-id="${item.id}">Excluir</button>
              </div>
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  bindTransactionMenus(elements.statementList);
}

function renderCostSummary() {
  const entries = transactionsForSelectedMonth()
    .filter((item) => item.bucket === "agrupador" && item.kind === "expense");
  const checkingEntries = transactionsForSelectedMonth().filter((item) => item.bucket === "checking");
  const selectedAggregator = state.aggregators.find((item) => item.id === state.selectedAggregatorId) || null;
  const allData = summarizeCostsByCategory(entries);
  const selectedData = summarizeCostsByCategory(
    entries.filter((item) => item.aggregatorId === state.selectedAggregatorId)
  );
  const checkingExpenseData = summarizeCostsByCategory(checkingEntries.filter((item) => item.kind === "expense"));
  const checkingIncomeData = summarizeCostsByCategory(checkingEntries.filter((item) => item.kind === "income"));

  elements.selectedCostChartTitle.textContent = selectedAggregator?.name || "Cartao/Agrupador";
  elements.allCardsCostChart.innerHTML = renderChartMarkup(allData, "Nenhum custo de cartao no mes selecionado.");
  elements.allCardsCostPie.innerHTML = renderPieMarkup(allData, "Nenhum custo de cartao no mes selecionado.");
  elements.selectedCardCostChart.innerHTML = selectedAggregator
    ? renderChartMarkup(selectedData, `Nao ha custos em ${selectedAggregator.name} neste mes.`)
    : `<div class="empty-state">Selecione um cartao ou agrupador para ver o resumo por categoria.</div>`;
  elements.selectedCardCostPie.innerHTML = selectedAggregator
    ? renderPieMarkup(selectedData, `Nao ha custos em ${selectedAggregator.name} neste mes.`)
    : `<div class="empty-state">Selecione um cartao ou agrupador para ver o resumo por categoria.</div>`;
  elements.checkingExpenseChart.innerHTML = renderChartMarkup(checkingExpenseData, "Nao ha custos na conta corrente neste mes.");
  elements.checkingExpensePie.innerHTML = renderPieMarkup(checkingExpenseData, "Nao ha custos na conta corrente neste mes.");
  elements.checkingIncomeChart.innerHTML = renderChartMarkup(checkingIncomeData, "Nao ha recebimentos na conta corrente neste mes.");
  elements.checkingIncomePie.innerHTML = renderPieMarkup(checkingIncomeData, "Nao ha recebimentos na conta corrente neste mes.");

  if (!state.aggregators.length) {
    elements.allAggregatorCharts.innerHTML = `<div class="empty-state">Cadastre cartoes ou agrupadores para visualizar o resumo dos custos.</div>`;
    return;
  }

  elements.allAggregatorCharts.innerHTML = state.aggregators
    .map((aggregator) => {
      const aggregatorData = summarizeCostsByCategory(
        entries.filter((item) => item.aggregatorId === aggregator.id)
      );

      return `
        <div class="cost-dashboard-card">
          <div class="panel-head compact-head">
            <div>
              <p class="eyebrow">${escapeHtml(aggregator.type)}</p>
              <h3>${escapeHtml(aggregator.name)}</h3>
            </div>
          </div>
          <div class="pie-chart-block">
            ${renderPieMarkup(aggregatorData, `Nao ha custos em ${aggregator.name} neste mes.`)}
          </div>
          <div class="chart-list">
            ${renderChartMarkup(aggregatorData, `Nao ha custos em ${aggregator.name} neste mes.`)}
          </div>
        </div>
      `;
    })
    .join("");
}

function renderTransactionList() {
  const entries = transactionsForSelectedMonth();

  if (!entries.length) {
    elements.transactionList.innerHTML = `<div class="empty-state">Nao ha movimentacoes no mes selecionado.</div>`;
    return;
  }

  elements.transactionList.innerHTML = entries
    .sort(compareTransactionsDesc)
    .slice(0, 10)
    .map((item) => {
      const aggregator = state.aggregators.find((entry) => entry.id === item.aggregatorId);
      const amountClass = item.kind === "income" ? "income" : "expense";
      const signal = item.kind === "income" ? "+" : "-";

      return `
        <div class="list-item transaction-menu" data-transaction-id="${item.id}">
          <div>
            <strong>${escapeHtml(item.description)}</strong>
            <p class="item-meta">${detailsLabel(item, aggregator)} - ${dateLabel(item.date)}</p>
          </div>
          <div class="item-actions">
            <strong class="${amountClass}">${signal} ${currency(item.amount)}</strong>
            <div class="menu-anchor">
              <button type="button" class="menu-toggle" data-menu-toggle="${item.id}" aria-label="Abrir menu de acoes">
                <span></span>
                <span></span>
                <span></span>
              </button>
              <div class="dropdown-menu hidden" data-menu="${item.id}">
                <button type="button" class="dropdown-item" data-edit-id="${item.id}">Editar</button>
                <button type="button" class="dropdown-item danger-item" data-delete-id="${item.id}">Excluir</button>
              </div>
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  bindTransactionMenus(elements.transactionList);
}

function syncTransactionFormState() {
  const kind = elements.transactionForm.kind.value;
  const bucket = elements.transactionBucket.value;
  const paymentMethod = elements.paymentMethod.value;
  const usesAggregator = bucket === "agrupador";
  const allowsCredit = kind === "expense" && bucket !== "fixed";
  const usesInstallments = allowsCredit && paymentMethod === "credito";
  const allowsFutureIncome = (kind === "income" && bucket === "checking") || bucket === "fixed";

  elements.transactionAggregator.disabled = !usesAggregator;
  elements.paymentMethod.disabled = !allowsCredit;
  elements.installmentsField.classList.toggle("hidden", !usesInstallments);
  elements.installments.disabled = !usesInstallments;
  elements.futureIncomeField.classList.toggle("hidden", !allowsFutureIncome);
  elements.futureIncomeMonths.disabled = !allowsFutureIncome;
  elements.recurrenceLabel.textContent = bucket === "fixed"
    ? "Recorrente por quantos meses"
    : "Repetir recebimento por quantos meses";

  if (!usesAggregator) {
    elements.transactionAggregator.value = "";
  }

  if (!allowsCredit) {
    elements.paymentMethod.value = "avista";
  }

  if (!usesInstallments) {
    elements.installments.value = "1";
  }

  if (!allowsFutureIncome) {
    elements.futureIncomeMonths.value = "1";
  }
}

function createFixedCost(payload) {
  const totalMonths = Math.max(payload.futureIncomeMonths || 1, 1);
  const baseDate = new Date(`${payload.date}T12:00:00`);
  const recurringGroupId = crypto.randomUUID();

  for (let index = 0; index < totalMonths; index += 1) {
    state.fixedCosts.push({
      id: crypto.randomUUID(),
      recurringGroupId,
      description: payload.description,
      category: payload.category,
      originalAmount: payload.amount,
      remainingAmount: payload.amount,
      reimbursedAmount: 0,
      date: toInputDate(addMonthsSafe(baseDate, index)),
      recurrenceIndex: index + 1,
      recurrenceCount: totalMonths
    });
  }
}

function updateFixedCost(fixedCostId, payload) {
  const index = state.fixedCosts.findIndex((item) => item.id === fixedCostId);

  if (index === -1) {
    return;
  }

  const current = state.fixedCosts[index];
  const recurringGroupId = current.recurringGroupId || current.id;
  const relatedItems = state.fixedCosts
    .filter((item) => (item.recurringGroupId || item.id) === recurringGroupId)
    .sort((left, right) => (left.recurrenceIndex || 1) - (right.recurrenceIndex || 1));
  const currentRecurrenceIndex = current.recurrenceIndex || 1;
  const totalMonths = Math.max(payload.futureIncomeMonths || 1, 1);
  const currentDate = new Date(`${payload.date}T12:00:00`);
  const baseDate = addMonthsSafe(currentDate, -(currentRecurrenceIndex - 1));
  const keptFixedCosts = state.fixedCosts.filter((item) => (item.recurringGroupId || item.id) !== recurringGroupId);
  const rebuiltItems = [];

  for (let index = 0; index < totalMonths; index += 1) {
    const recurrenceNumber = index + 1;
    const existing = relatedItems.find((item) => (item.recurrenceIndex || 1) === recurrenceNumber);
    const alreadyPaid = existing
      ? roundCurrency(existing.originalAmount - existing.remainingAmount - (existing.reimbursedAmount || 0))
      : 0;
    const reimbursedAmount = existing?.reimbursedAmount || 0;
    const nextOriginalAmount = payload.amount;
    const nextRemainingAmount = Math.max(roundCurrency(nextOriginalAmount - alreadyPaid - reimbursedAmount), 0);

    rebuiltItems.push({
      ...(existing || {}),
      id: existing?.id || crypto.randomUUID(),
      recurringGroupId,
      description: payload.description,
      category: payload.category,
      originalAmount: nextOriginalAmount,
      remainingAmount: nextRemainingAmount,
      reimbursedAmount,
      date: toInputDate(addMonthsSafe(baseDate, index)),
      recurrenceIndex: recurrenceNumber,
      recurrenceCount: totalMonths
    });
  }

  state.fixedCosts = [...keptFixedCosts, ...rebuiltItems];
}

function updateAggregator(aggregator) {
  const index = state.aggregators.findIndex((item) => item.id === aggregator.id);

  if (index === -1) {
    return;
  }

  const previous = state.aggregators[index];
  state.aggregators[index] = aggregator;

  if (previous.type !== aggregator.type) {
    state.transactions = state.transactions.map((item) => {
      if (item.aggregatorId !== aggregator.id) {
        return item;
      }

      return {
        ...item,
        paymentMethod: aggregator.type === "Agrupador" ? "avista" : item.paymentMethod
      };
    });
  }
}

function createTransactions(payload) {
  const { description, kind, category, bucket, amount, date, aggregatorId, paymentMethod, installments, futureIncomeMonths } = payload;
  const baseDate = new Date(`${date}T12:00:00`);
  const safeInstallments = Math.max(installments, 1);
  const futureMonths = kind === "income" && bucket === "checking" ? Math.max(futureIncomeMonths || 1, 1) : 1;
  const totalEntries = paymentMethod === "credito" ? safeInstallments : futureMonths;
  const groupId = crypto.randomUUID();
  const recurringGroupId = kind === "income" && bucket === "checking" ? crypto.randomUUID() : null;
  const newTransactions = [];

  for (let index = 0; index < totalEntries; index += 1) {
    const installmentDate = addMonthsSafe(baseDate, index);

    newTransactions.push({
      id: crypto.randomUUID(),
      groupId,
      description,
      kind,
      category,
      bucket,
      amount,
      date: toInputDate(installmentDate),
      aggregatorId: bucket === "agrupador" ? aggregatorId || null : null,
      paymentMethod,
      recurringGroupId,
      amountMode: "per_installment",
      installmentIndex: index + 1,
      installmentCount: paymentMethod === "credito" ? safeInstallments : futureMonths
    });
  }

  state.transactions.push(...newTransactions);
}

function bindFixedCostMenus() {
  elements.fixedCostsList.querySelectorAll("[data-fixed-cost-menu-toggle]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleFixedCostMenu(button.dataset.fixedCostMenuToggle);
    });
  });

  elements.fixedCostsList.querySelectorAll("[data-fixed-cost-action]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      uiState.fixedCostPaymentDraft = {
        fixedCostId: button.dataset.fixedCostAction,
        mode: button.dataset.fixedCostMode
      };
      closeAllMenus();
      renderFixedCosts();
    });
  });

  elements.fixedCostsList.querySelectorAll("[data-edit-fixed-cost]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      closeAllMenus();
      startEditingFixedCost(button.dataset.editFixedCost);
    });
  });

  elements.fixedCostsList.querySelectorAll("[data-delete-fixed-cost]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteFixedCost(button.dataset.deleteFixedCost);
    });
  });

  elements.fixedCostsList.querySelectorAll("[data-fixed-cost-reimburse]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      reimburseFixedCost(button.dataset.fixedCostReimburse);
    });
  });

  elements.fixedCostsList.querySelectorAll("[data-fixed-cost-cancel]").forEach((button) => {
    button.addEventListener("click", () => {
      uiState.fixedCostPaymentDraft = null;
      renderFixedCosts();
    });
  });

  elements.fixedCostsList.querySelectorAll("[data-fixed-cost-confirm]").forEach((button) => {
    button.addEventListener("click", () => {
      confirmFixedCostPayment(button.dataset.fixedCostConfirm, button.dataset.fixedCostMode);
    });
  });
}

function toggleFixedCostMenu(fixedCostId) {
  const menu = document.querySelector(`[data-fixed-cost-menu="${fixedCostId}"]`);

  if (!menu) {
    return;
  }

  const shouldOpen = menu.classList.contains("hidden");
  closeAllMenus();
  menu.classList.toggle("hidden", !shouldOpen);
}

function confirmFixedCostPayment(fixedCostId, mode) {
  const fixedCost = state.fixedCosts.find((item) => item.id === fixedCostId);

  if (!fixedCost) {
    return;
  }

  const amountInput = document.querySelector(`#fixed-cost-amount-${fixedCostId}`);
  const targetInput = document.querySelector(`#fixed-cost-target-${fixedCostId}`);
  const cardInput = document.querySelector(`#fixed-cost-card-${fixedCostId}`);
  const target = targetInput?.value || "checking";
  const requestedAmount = Number(amountInput?.value || 0);
  const amount = mode === "integral" ? fixedCost.remainingAmount : requestedAmount;

  if (!amount || amount <= 0 || amount > fixedCost.remainingAmount) {
    return;
  }

  if (target === "card" && !cardInput?.value) {
    return;
  }

  fixedCost.remainingAmount = roundCurrency(fixedCost.remainingAmount - amount);

  state.transactions.push({
    id: crypto.randomUUID(),
    groupId: crypto.randomUUID(),
    description: fixedCost.description,
    kind: "expense",
    category: fixedCost.category,
    bucket: target === "checking" ? "checking" : "agrupador",
    amount,
    date: toInputDate(selectedMonthDate()),
    aggregatorId: target === "card" ? cardInput.value : null,
    paymentMethod: "avista",
    amountMode: "per_installment",
    installmentIndex: 1,
    installmentCount: 1,
    generatedFromFixedCost: {
      fixedCostId,
      mode
    }
  });

  uiState.fixedCostPaymentDraft = null;
  persistState();
  renderAll();
}

function startEditingFixedCost(fixedCostId) {
  const fixedCost = state.fixedCosts.find((item) => item.id === fixedCostId);

  if (!fixedCost) {
    return;
  }

  activateSection("movimentacao");
  elements.fixedCostId.value = fixedCost.id;
  elements.transactionId.value = "";
  elements.transactionForm.description.value = fixedCost.description;
  elements.transactionForm.kind.value = "expense";
  elements.transactionCategory.value = fixedCost.category;
  elements.transactionBucket.value = "fixed";
  elements.transactionForm.amount.value = fixedCost.originalAmount;
  elements.transactionForm.date.value = fixedCost.date;
  elements.transactionAggregator.value = "";
  elements.paymentMethod.value = "avista";
  elements.installments.value = "1";
  elements.futureIncomeMonths.value = String(fixedCost.recurrenceCount || 1);
  syncTransactionFormState();
  elements.transactionSubmit.textContent = "Salvar custo fixo";
  elements.cancelEdit.classList.remove("hidden");
  elements.transactionForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function deleteFixedCost(fixedCostId) {
  state.fixedCosts = state.fixedCosts.filter((item) => item.id !== fixedCostId);

  if (elements.fixedCostId.value === fixedCostId) {
    resetTransactionForm();
  }

  uiState.fixedCostPaymentDraft = null;
  persistState();
  closeAllMenus();
  renderAll();
}

function reimburseFixedCost(fixedCostId) {
  const fixedCost = state.fixedCosts.find((item) => item.id === fixedCostId);

  if (!fixedCost || fixedCost.remainingAmount <= 0) {
    return;
  }

  fixedCost.reimbursedAmount = roundCurrency((fixedCost.reimbursedAmount || 0) + fixedCost.remainingAmount);
  fixedCost.remainingAmount = 0;
  uiState.fixedCostPaymentDraft = null;
  persistState();
  closeAllMenus();
  renderAll();
}

function startEditingAggregator(aggregatorId) {
  const aggregator = state.aggregators.find((item) => item.id === aggregatorId);

  if (!aggregator) {
    return;
  }

  activateSection("agrupadores");
  elements.aggregatorId.value = aggregator.id;
  elements.aggregatorForm.name.value = aggregator.name;
  elements.aggregatorForm.type.value = aggregator.type;
  elements.aggregatorSubmit.textContent = "Salvar alteracoes";
  elements.cancelAggregatorEdit.classList.remove("hidden");
  elements.aggregatorForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function deleteAggregator(aggregatorId) {
  state.aggregators = state.aggregators.filter((item) => item.id !== aggregatorId);
  state.transactions = state.transactions.map((item) => {
    if (item.aggregatorId !== aggregatorId) {
      return item;
    }

    return {
      ...item,
      aggregatorId: null
    };
  });

  if (state.selectedAggregatorId === aggregatorId) {
    state.selectedAggregatorId = state.aggregators[0]?.id || null;
  }

  if (elements.aggregatorId.value === aggregatorId) {
    resetAggregatorForm();
  }

  persistState();
  closeAllMenus();
  renderAll();
}

function updateTransaction(transactionId, payload) {
  const index = state.transactions.findIndex((item) => item.id === transactionId);

  if (index === -1) {
    return;
  }

  const current = state.transactions[index];
  const currentInstallmentIndex = current.installmentIndex || 1;
  const nextInstallmentCount = payload.paymentMethod === "credito" ? Math.max(payload.installments, 1) : 1;

  if (current.paymentMethod === "credito" || payload.paymentMethod === "credito") {
    updateCreditTransactionGroup(current, payload, currentInstallmentIndex, nextInstallmentCount);
    return;
  }

  if (current.kind === "income" && current.bucket === "checking") {
    updateRecurringIncomeGroup(current, payload);
    return;
  }

  state.transactions[index] = {
    ...current,
    description: payload.description,
    kind: payload.kind,
    category: payload.category,
    bucket: payload.bucket,
    amount: payload.amount,
    date: payload.date,
    aggregatorId: payload.bucket === "agrupador" ? payload.aggregatorId || null : null,
    paymentMethod: payload.paymentMethod,
    amountMode: "per_installment",
    installmentIndex: 1,
    installmentCount: 1
  };
}

function updateRecurringIncomeGroup(current, payload) {
  const recurringGroupId = current.recurringGroupId || current.id;
  const relatedTransactions = state.transactions
    .filter((item) => (item.recurringGroupId || item.id) === recurringGroupId)
    .sort((left, right) => (left.installmentIndex || 1) - (right.installmentIndex || 1));
  const currentIndex = current.installmentIndex || 1;
  const totalMonths = Math.max(payload.futureIncomeMonths || 1, 1);
  const currentDate = new Date(`${payload.date}T12:00:00`);
  const baseDate = addMonthsSafe(currentDate, -(currentIndex - 1));
  const keptTransactions = state.transactions.filter((item) => (item.recurringGroupId || item.id) !== recurringGroupId);
  const rebuiltTransactions = [];

  for (let index = 0; index < totalMonths; index += 1) {
    const installmentNumber = index + 1;
    const existing = relatedTransactions.find((item) => (item.installmentIndex || 1) === installmentNumber);

    rebuiltTransactions.push({
      ...(existing || {}),
      id: existing?.id || crypto.randomUUID(),
      recurringGroupId,
      description: payload.description,
      kind: payload.kind,
      category: payload.category,
      bucket: payload.bucket,
      amount: payload.amount,
      date: toInputDate(addMonthsSafe(baseDate, index)),
      aggregatorId: null,
      paymentMethod: "avista",
      amountMode: "per_installment",
      installmentIndex: installmentNumber,
      installmentCount: totalMonths
    });
  }

  state.transactions = [...keptTransactions, ...rebuiltTransactions];
}

function updateCreditTransactionGroup(current, payload, currentInstallmentIndex, nextInstallmentCount) {
  const groupId = current.groupId || current.id;
  const currentDate = new Date(`${payload.date}T12:00:00`);
  const baseDate = addMonthsSafe(currentDate, -(currentInstallmentIndex - 1));
  const relatedTransactions = state.transactions
    .filter((item) => (item.groupId || item.id) === groupId)
    .sort((left, right) => (left.installmentIndex || 1) - (right.installmentIndex || 1));
  const relatedIds = new Set(relatedTransactions.map((item) => item.id));
  const keptTransactions = state.transactions.filter((item) => !relatedIds.has(item.id));
  const rebuiltTransactions = [];

  for (let index = 0; index < nextInstallmentCount; index += 1) {
    const installmentNumber = index + 1;
    const existing = relatedTransactions.find((item) => (item.installmentIndex || 1) === installmentNumber);

    rebuiltTransactions.push({
      ...(existing || {}),
      id: existing?.id || crypto.randomUUID(),
      groupId,
      description: payload.description,
      kind: payload.kind,
      category: payload.category,
      bucket: payload.bucket,
      amount: payload.amount,
      date: toInputDate(addMonthsSafe(baseDate, index)),
      aggregatorId: payload.bucket === "agrupador" ? payload.aggregatorId || null : null,
      paymentMethod: payload.paymentMethod,
      amountMode: "per_installment",
      installmentIndex: installmentNumber,
      installmentCount: nextInstallmentCount
    });
  }

  state.transactions = [...keptTransactions, ...rebuiltTransactions];
}

function deleteTransaction(transactionId) {
  const index = state.transactions.findIndex((item) => item.id === transactionId);

  if (index === -1) {
    return;
  }

  state.transactions.splice(index, 1);

  if (elements.transactionId.value === transactionId) {
    resetTransactionForm();
  }

  persistState();
  closeAllMenus();
  renderAll();
}

function startEditingTransaction(transactionId) {
  const transaction = state.transactions.find((item) => item.id === transactionId);

  if (!transaction) {
    return;
  }

  activateSection("movimentacao");
  elements.transactionId.value = transaction.id;
  elements.transactionForm.description.value = transaction.description;
  elements.transactionForm.kind.value = transaction.kind;
  elements.transactionCategory.value = transaction.category;
  elements.transactionBucket.value = transaction.bucket;
  elements.transactionForm.amount.value = transaction.amount;
  elements.transactionForm.date.value = transaction.date;
  elements.transactionAggregator.value = transaction.aggregatorId || "";
  elements.paymentMethod.value = transaction.paymentMethod || "avista";
  elements.installments.value = String(transaction.installmentCount || 1);
  elements.futureIncomeMonths.value = String(
    transaction.kind === "income" && transaction.bucket === "checking"
      ? transaction.installmentCount || 1
      : 1
  );
  syncTransactionFormState();
  elements.transactionSubmit.textContent = "Salvar alteracoes";
  elements.cancelEdit.classList.remove("hidden");
  elements.transactionForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetTransactionForm() {
  elements.transactionForm.reset();
  elements.transactionId.value = "";
  elements.fixedCostId.value = "";
  elements.transactionForm.date.value = today();
  elements.installments.value = "1";
  elements.futureIncomeMonths.value = "1";
  elements.paymentMethod.value = "avista";
  elements.transactionSubmit.textContent = "Salvar movimentacao";
  elements.cancelEdit.classList.add("hidden");
  syncTransactionFormState();
}

function resetAggregatorForm() {
  elements.aggregatorForm.reset();
  elements.aggregatorId.value = "";
  elements.aggregatorSubmit.textContent = "Salvar cartao/agrupador";
  elements.cancelAggregatorEdit.classList.add("hidden");
}

function toggleMenu(transactionId) {
  const menu = document.querySelector(`[data-menu="${transactionId}"]`);

  if (!menu) {
    return;
  }

  const shouldOpen = menu.classList.contains("hidden");
  closeAllMenus();
  menu.classList.toggle("hidden", !shouldOpen);
}

function closeAllMenus() {
  document.querySelectorAll(".dropdown-menu").forEach((menu) => {
    menu.classList.add("hidden");
  });
}

function toggleCardMenu(aggregatorId) {
  const menu = document.querySelector(`[data-card-menu="${aggregatorId}"]`);

  if (!menu) {
    return;
  }

  const shouldOpen = menu.classList.contains("hidden");
  closeAllMenus();
  menu.classList.toggle("hidden", !shouldOpen);
}

function bindTransactionMenus(container) {
  container.querySelectorAll("[data-menu-toggle]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleMenu(button.dataset.menuToggle);
    });
  });

  container.querySelectorAll("[data-edit-id]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      closeAllMenus();
      startEditingTransaction(button.dataset.editId);
    });
  });

  container.querySelectorAll("[data-delete-id]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteTransaction(button.dataset.deleteId);
    });
  });
}

function transactionsForSelectedMonth() {
  return state.transactions.filter((item) => isInSelectedMonth(item.date));
}

function transactionsUpToSelectedMonth() {
  return state.transactions.filter((item) => isOnOrBeforeSelectedMonth(item.date));
}

function fixedCostsForSelectedMonth() {
  return state.fixedCosts.filter((item) => isInSelectedMonth(item.date));
}

function fixedCostsRemainingForMonth(year, month) {
  return state.fixedCosts
    .filter((item) => isInMonth(item.date, year, month))
    .reduce((sum, item) => sum + (item.remainingAmount || 0), 0);
}

function transactionsForPreviousMonth() {
  return state.transactions.filter((item) => isInPreviousMonth(item.date));
}

function calculateMonthBalances(targetYear, targetMonth) {
  const current = currentMonthState();
  const selectedKey = monthKey(targetYear, targetMonth);
  const currentKey = monthKey(current.year, current.month);

  if (selectedKey <= currentKey) {
    const actual = calculateActualBalanceThroughMonth(targetYear, targetMonth);
    const previousCardCosts = cardCostsForMonth(...previousMonthFor(targetYear, targetMonth));
    const paidPreviousCards = paidCardCostsForMonth(targetYear, targetMonth);
    const pendingPreviousCards = Math.max(previousCardCosts - paidPreviousCards, 0);
    const remainingFixedCosts = fixedCostsRemainingForMonth(targetYear, targetMonth);

    return {
      actual,
      predicted: actual - pendingPreviousCards - remainingFixedCosts
    };
  }

  let cursorYear = current.year;
  let cursorMonth = current.month;
  let rollingPredicted = calculateMonthBalances(cursorYear, cursorMonth).predicted;

  while (cursorYear < targetYear || (cursorYear === targetYear && cursorMonth < targetMonth)) {
    const next = nextMonthFor(cursorYear, cursorMonth);
    const monthNetChecking = checkingNetForMonth(next.year, next.month);
    const actual = rollingPredicted + monthNetChecking;
    const previousCardCosts = cardCostsForMonth(...previousMonthFor(next.year, next.month));
    const paidPreviousCards = paidCardCostsForMonth(next.year, next.month);
    const pendingPreviousCards = Math.max(previousCardCosts - paidPreviousCards, 0);
    const remainingFixedCosts = fixedCostsRemainingForMonth(next.year, next.month);
    const predicted = actual - pendingPreviousCards - remainingFixedCosts;

    cursorYear = next.year;
    cursorMonth = next.month;
    rollingPredicted = predicted;

    if (cursorYear === targetYear && cursorMonth === targetMonth) {
      return {
        actual,
        predicted
      };
    }
  }

  return {
    actual: rollingPredicted,
    predicted: rollingPredicted
  };
}

function previousMonthState() {
  const previous = selectedMonthDate();
  previous.setMonth(previous.getMonth() - 1);
  return {
    year: previous.getFullYear(),
    month: previous.getMonth()
  };
}

function changeSelectedMonth(offset) {
  const date = selectedMonthDate();
  date.setMonth(date.getMonth() + offset);
  state.selectedMonth = {
    year: date.getFullYear(),
    month: date.getMonth()
  };
  persistState();
  renderAll();
}

function selectedMonthDate() {
  return new Date(state.selectedMonth.year, state.selectedMonth.month, 1);
}

function currentMonthDate() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function monthKey(year, month) {
  return year * 12 + month;
}

function previousMonthFor(year, month) {
  const date = new Date(year, month, 1);
  date.setMonth(date.getMonth() - 1);
  return [date.getFullYear(), date.getMonth()];
}

function nextMonthFor(year, month) {
  const date = new Date(year, month, 1);
  date.setMonth(date.getMonth() + 1);
  return {
    year: date.getFullYear(),
    month: date.getMonth()
  };
}

function calculateActualBalanceThroughMonth(year, month) {
  return state.transactions
    .filter((item) => item.bucket === "checking")
    .filter((item) => isOnOrBeforeMonth(item.date, year, month))
    .reduce((sum, item) => sum + (item.kind === "income" ? item.amount : -item.amount), 0);
}

function checkingNetForMonth(year, month) {
  return state.transactions
    .filter((item) => item.bucket === "checking")
    .filter((item) => isInMonth(item.date, year, month))
    .reduce((sum, item) => sum + (item.kind === "income" ? item.amount : -item.amount), 0);
}

function cardCostsForMonth(year, month) {
  return state.transactions
    .filter((item) => item.bucket === "agrupador")
    .filter((item) => isInMonth(item.date, year, month))
    .filter((item) => state.aggregators.find((aggregator) => aggregator.id === item.aggregatorId)?.type === "Cartao")
    .reduce((sum, item) => sum + (item.kind === "income" ? -item.amount : item.amount), 0);
}

function paidCardCostsForMonth(year, month) {
  const [billingYear, billingMonth] = previousMonthFor(year, month);

  return state.transactions
    .filter((item) => item.bucket === "checking" && item.kind === "expense")
    .filter((item) => isInMonth(item.date, year, month))
    .filter((item) => item.generatedFromCardPayment)
    .filter((item) => item.generatedFromCardPayment.billingYear === billingYear)
    .filter((item) => item.generatedFromCardPayment.billingMonth === billingMonth)
    .reduce((sum, item) => sum + item.amount, 0);
}

function aggregatorNetTotalForMonth(aggregatorId, entries) {
  return entries
    .filter((item) => item.bucket === "agrupador" && item.aggregatorId === aggregatorId)
    .reduce((sum, item) => sum + (item.kind === "income" ? -item.amount : item.amount), 0);
}

function registerCardPayment(aggregatorId) {
  const aggregator = state.aggregators.find((item) => item.id === aggregatorId && item.type === "Cartao");

  if (!aggregator) {
    return;
  }

  const monthEntries = transactionsForSelectedMonth();
  const total = aggregatorNetTotalForMonth(aggregatorId, monthEntries);

  if (total <= 0 || hasCardPaymentForSelectedMonth(aggregatorId)) {
    closeAllMenus();
    return;
  }

  const paymentDate = addMonthsSafe(selectedMonthDate(), 1);

  state.transactions.push({
    id: crypto.randomUUID(),
    groupId: crypto.randomUUID(),
    description: `Pagamento ${aggregator.name}`,
    kind: "expense",
    category: "Pagamento Cartao",
    bucket: "checking",
    amount: total,
    date: toInputDate(paymentDate),
    aggregatorId: null,
    paymentMethod: "avista",
    amountMode: "per_installment",
    installmentIndex: 1,
    installmentCount: 1,
    generatedFromCardPayment: {
      aggregatorId,
      billingYear: state.selectedMonth.year,
      billingMonth: state.selectedMonth.month
    }
  });

  persistState();
  closeAllMenus();
  renderAll();
}

function hasCardPaymentForSelectedMonth(aggregatorId) {
  return state.transactions.some((item) => {
    if (!item.generatedFromCardPayment) {
      return false;
    }

    return item.generatedFromCardPayment.aggregatorId === aggregatorId
      && item.generatedFromCardPayment.billingYear === state.selectedMonth.year
      && item.generatedFromCardPayment.billingMonth === state.selectedMonth.month;
  });
}

function detailsLabel(item, aggregator) {
  const installment = item.installmentCount > 1 ? ` - ${item.installmentIndex}/${item.installmentCount}` : "";
  const aggregatorLabel = item.bucket === "agrupador" && aggregator ? ` - ${aggregator.name}` : "";
  return `${item.category} - ${bucketLabel(item.bucket)} - ${paymentLabel(item)}${installment}${aggregatorLabel}`;
}

function paymentDetails(item) {
  const installment = item.installmentCount > 1 ? ` ${item.installmentIndex}/${item.installmentCount}` : "";
  return `${paymentLabel(item)}${installment}`;
}

function paymentLabel(item) {
  return item.paymentMethod === "credito" ? "Credito" : "A vista";
}

function bucketLabel(bucket) {
  if (bucket === "agrupador") {
    return "Cartao/Agrupador";
  }

  if (bucket === "fixed") {
    return "Custo Fixo";
  }

  return "Conta Corrente";
}

function persistState() {
  touchStateTimestamp();
  const snapshot = serializeState();
  stateSnapshot = snapshot;
  localStorage.setItem(STORAGE_KEY, snapshot);
  void saveRemoteState(snapshot);
}

async function hydrateState() {
  const localState = loadLocalState();
  const remoteState = await fetchRemoteState();

  if (!remoteState) {
    replaceState(localState);
    stateSnapshot = serializeState();
    localStorage.setItem(STORAGE_KEY, stateSnapshot);

    if (hasMeaningfulData(localState)) {
      touchStateTimestamp();
      stateSnapshot = serializeState();
      localStorage.setItem(STORAGE_KEY, stateSnapshot);
      await saveRemoteState(stateSnapshot);
    }
  } else {
    const normalizedRemoteState = normalizeState(remoteState);
    const preferredState = pickPreferredState(localState, normalizedRemoteState);

    replaceState(preferredState);
    stateSnapshot = serializeState();
    localStorage.setItem(STORAGE_KEY, stateSnapshot);

    if (preferredState !== normalizedRemoteState) {
      await saveRemoteState(stateSnapshot);
    }
  }

  if (!state.selectedAggregatorId && state.aggregators.length) {
    state.selectedAggregatorId = state.aggregators[0].id;
  }
}

function startRemoteSync() {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
  }

  syncIntervalId = setInterval(async () => {
    const remoteState = await fetchRemoteState();

    if (!remoteState) {
      return;
    }

    const normalized = normalizeState(remoteState);
    const remoteSnapshot = JSON.stringify(normalized);

    if (remoteSnapshot === stateSnapshot) {
      return;
    }

    if (!shouldApplyRemoteState(normalized)) {
      await saveRemoteState(stateSnapshot);
      return;
    }

    replaceState(normalized);
    stateSnapshot = remoteSnapshot;
    localStorage.setItem(STORAGE_KEY, stateSnapshot);
    renderAll();
  }, REMOTE_SYNC_INTERVAL_MS);
}

function loadLocalState() {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (!saved) {
    return createInitialState();
  }

  try {
    return normalizeState(JSON.parse(saved));
  } catch (error) {
    console.error("Falha ao carregar dados locais.", error);
    return createInitialState();
  }
}

function normalizeState(parsed) {
  return {
    aggregators: Array.isArray(parsed.aggregators) ? parsed.aggregators : [],
    categories: Array.isArray(parsed.categories) && parsed.categories.length ? parsed.categories : [...DEFAULT_CATEGORIES],
    fixedCosts: Array.isArray(parsed.fixedCosts)
      ? parsed.fixedCosts.map((item) => ({
          ...item,
          reimbursedAmount: item.reimbursedAmount || 0
        }))
      : [],
    transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
    selectedAggregatorId: parsed.selectedAggregatorId || null,
    selectedMonth: parsed.selectedMonth || currentMonthState(),
    balanceMode: parsed.balanceMode || "actual",
    migrations: parsed.migrations || {},
    meta: {
      lastUpdatedAt: parsed.meta?.lastUpdatedAt || ""
    }
  };
}

function replaceState(nextState) {
  state.aggregators = nextState.aggregators;
  state.categories = nextState.categories;
  state.fixedCosts = nextState.fixedCosts;
  state.transactions = nextState.transactions;
  state.selectedAggregatorId = nextState.selectedAggregatorId;
  state.selectedMonth = nextState.selectedMonth;
  state.balanceMode = nextState.balanceMode;
  state.migrations = nextState.migrations;
  state.meta = nextState.meta;
}

function serializeState() {
  return JSON.stringify(state);
}

function hasMeaningfulData(candidateState) {
  return candidateState.aggregators.length > 0
    || candidateState.fixedCosts.length > 0
    || candidateState.transactions.length > 0;
}

function touchStateTimestamp() {
  state.meta.lastUpdatedAt = new Date().toISOString();
}

function pickPreferredState(localState, remoteState) {
  if (hasMeaningfulData(localState) && !hasMeaningfulData(remoteState)) {
    return localState;
  }

  if (!hasMeaningfulData(localState) && hasMeaningfulData(remoteState)) {
    return remoteState;
  }

  const localUpdatedAt = stateTimestamp(localState);
  const remoteUpdatedAt = stateTimestamp(remoteState);

  if (localUpdatedAt && remoteUpdatedAt && localUpdatedAt !== remoteUpdatedAt) {
    return localUpdatedAt > remoteUpdatedAt ? localState : remoteState;
  }

  if (localUpdatedAt && !remoteUpdatedAt && hasMeaningfulData(localState)) {
    return localState;
  }

  if (!localUpdatedAt && remoteUpdatedAt && hasMeaningfulData(remoteState)) {
    return remoteState;
  }

  return stateDataScore(localState) >= stateDataScore(remoteState) ? localState : remoteState;
}

function shouldApplyRemoteState(remoteState) {
  const localState = normalizeState(state);
  const preferredState = pickPreferredState(localState, remoteState);
  return preferredState === remoteState;
}

function stateTimestamp(candidateState) {
  const rawValue = candidateState?.meta?.lastUpdatedAt;

  if (!rawValue) {
    return "";
  }

  const timestamp = new Date(rawValue).getTime();
  return Number.isNaN(timestamp) ? "" : rawValue;
}

function stateDataScore(candidateState) {
  const categoryBonus = Math.max((candidateState.categories || []).length - DEFAULT_CATEGORIES.length, 0);
  return (candidateState.transactions?.length || 0) * 100
    + (candidateState.fixedCosts?.length || 0) * 20
    + (candidateState.aggregators?.length || 0) * 10
    + categoryBonus;
}

async function fetchRemoteState() {
  if (isGoogleSheetsStorageEnabled()) {
    return fetchGoogleSheetsState();
  }

  try {
    const response = await fetch(LOCAL_API_STATE_URL, { cache: "no-store" });

    if (!response.ok) {
      return null;
    }

    const text = await response.text();

    if (!text || text.trim() === "" || text.trim() === "{}") {
      return null;
    }

    return JSON.parse(text);
  } catch (error) {
    console.warn("Nao foi possivel carregar o estado remoto.", error);
    return null;
  }
}

async function saveRemoteState(snapshot) {
  if (isGoogleSheetsStorageEnabled()) {
    await saveGoogleSheetsState(snapshot);
    return;
  }

  try {
    await fetch(LOCAL_API_STATE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: snapshot
    });
  } catch (error) {
    console.warn("Nao foi possivel salvar o estado remoto.", error);
  }
}

function isGoogleSheetsStorageEnabled() {
  return Boolean(GOOGLE_SHEETS_API_URL && getGoogleSheetsToken());
}

function googleSheetsUrl() {
  const url = new URL(GOOGLE_SHEETS_API_URL);
  url.searchParams.set("token", getGoogleSheetsToken());
  return url.toString();
}

async function fetchGoogleSheetsState() {
  try {
    const payload = await fetchGoogleSheetsJson();

    if (!payload?.success || !payload.state) {
      return null;
    }

    return normalizeRemoteStatePayload(payload.state);
  } catch (error) {
    console.warn("Nao foi possivel carregar o estado do Google Sheets.", error);
    return null;
  }
}

function normalizeRemoteStatePayload(remoteState) {
  let parsedState = remoteState;

  while (typeof parsedState === "string") {
    parsedState = JSON.parse(parsedState);
  }

  if (parsedState?.value) {
    return normalizeRemoteStatePayload(parsedState.value);
  }

  return parsedState;
}

async function fetchGoogleSheetsJson() {
  try {
    const response = await fetch(googleSheetsUrl(), { cache: "no-store" });

    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch (error) {
    return fetchGoogleSheetsJsonp();
  }
}

function fetchGoogleSheetsJsonp() {
  return new Promise((resolve, reject) => {
    const callbackName = `controleFinanceiroCallback${Date.now()}${Math.round(Math.random() * 100000)}`;
    const url = new URL(googleSheetsUrl());
    const script = document.createElement("script");
    const cleanup = () => {
      delete window[callbackName];
      script.remove();
    };

    window[callbackName] = (payload) => {
      cleanup();
      resolve(payload);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("Falha ao carregar dados via JSONP."));
    };

    url.searchParams.set("callback", callbackName);
    script.src = url.toString();
    document.body.appendChild(script);
  });
}

async function saveGoogleSheetsState(snapshot) {
  try {
    await fetch(googleSheetsUrl(), {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({ state: snapshot })
    });
  } catch (error) {
    console.warn("Nao foi possivel salvar o estado no Google Sheets.", error);
  }
}

function createInitialState() {
  return {
    aggregators: [],
    categories: [...DEFAULT_CATEGORIES],
    fixedCosts: [],
    transactions: [],
    selectedAggregatorId: null,
    selectedMonth: currentMonthState(),
    balanceMode: "actual",
    migrations: {},
    meta: {
      lastUpdatedAt: ""
    }
  };
}

function currentMonthState() {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth()
  };
}

function currency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value);
}

function monthLabel(date) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric"
  }).format(date);
}

function dateLabel(value) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(`${value}T12:00:00`));
}

function today() {
  return toInputDate(new Date());
}

function toInputDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function addMonthsSafe(date, amount) {
  const targetMonth = date.getMonth() + amount;
  const targetYear = date.getFullYear() + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;
  const lastDay = new Date(targetYear, normalizedMonth + 1, 0).getDate();
  return new Date(targetYear, normalizedMonth, Math.min(date.getDate(), lastDay), 12);
}

function isInSelectedMonth(value) {
  const date = new Date(`${value}T12:00:00`);
  return date.getMonth() === state.selectedMonth.month && date.getFullYear() === state.selectedMonth.year;
}

function isOnOrBeforeSelectedMonth(value) {
  const date = new Date(`${value}T12:00:00`);
  const selected = selectedMonthDate();
  return date.getFullYear() < selected.getFullYear()
    || (date.getFullYear() === selected.getFullYear() && date.getMonth() <= selected.getMonth());
}

function isInPreviousMonth(value) {
  const date = new Date(`${value}T12:00:00`);
  const previous = selectedMonthDate();
  previous.setMonth(previous.getMonth() - 1);
  return date.getMonth() === previous.getMonth() && date.getFullYear() === previous.getFullYear();
}

function isInMonth(value, year, month) {
  const date = new Date(`${value}T12:00:00`);
  return date.getFullYear() === year && date.getMonth() === month;
}

function isOnOrBeforeMonth(value, year, month) {
  const date = new Date(`${value}T12:00:00`);
  return date.getFullYear() < year
    || (date.getFullYear() === year && date.getMonth() <= month);
}

function compareTransactionsDesc(left, right) {
  const dateCompare = new Date(`${right.date}T12:00:00`) - new Date(`${left.date}T12:00:00`);

  if (dateCompare !== 0) {
    return dateCompare;
  }

  const installmentCompare = (right.installmentIndex || 0) - (left.installmentIndex || 0);

  if (installmentCompare !== 0) {
    return installmentCompare;
  }

  return String(right.id || "").localeCompare(String(left.id || ""));
}

function summarizeCostsByCategory(entries) {
  const totals = new Map();

  entries.forEach((item) => {
    const category = item.category || "Outros";
    totals.set(category, (totals.get(category) || 0) + item.amount);
  });

  return [...totals.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((left, right) => right.amount - left.amount);
}

function renderChartMarkup(data, emptyMessage) {
  if (!data.length) {
    return `<div class="empty-state">${escapeHtml(emptyMessage)}</div>`;
  }

  const max = Math.max(...data.map((item) => item.amount), 0);
  const total = data.reduce((sum, item) => sum + item.amount, 0);

  return data
    .map((item) => {
      const width = max > 0 ? Math.max((item.amount / max) * 100, 6) : 0;
      const color = categoryColor(item.category);
      const percentage = total > 0 ? ((item.amount / total) * 100).toFixed(1) : "0.0";

      return `
        <div class="chart-row">
          <div class="chart-row-head">
            <span>${escapeHtml(item.category)}</span>
            <strong>${currency(item.amount)} (${percentage}%)</strong>
          </div>
          <div class="chart-track">
            <div class="chart-bar" style="width: ${width}%; background: ${color};"></div>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderPieMarkup(data, emptyMessage) {
  if (!data.length) {
    return `<div class="empty-state">${escapeHtml(emptyMessage)}</div>`;
  }

  const total = data.reduce((sum, item) => sum + item.amount, 0);
  let accumulated = 0;
  const segments = data
    .map((item) => {
      const start = accumulated;
      const percentage = total > 0 ? (item.amount / total) * 100 : 0;
      accumulated += percentage;
      return `${categoryColor(item.category)} ${start.toFixed(2)}% ${accumulated.toFixed(2)}%`;
    })
    .join(", ");
  const legend = data
    .map((item) => {
      const color = categoryColor(item.category);
      const percentage = total > 0 ? ((item.amount / total) * 100).toFixed(1) : "0.0";
      return `
        <div class="pie-legend-item">
          <span class="pie-legend-color" style="background:${color};"></span>
          <span>${escapeHtml(item.category)}</span>
          <strong>${percentage}%</strong>
        </div>
      `;
    })
    .join("");

  return `
    <div class="pie-chart-wrap">
      <div class="pie-chart" style="background: conic-gradient(${segments});"></div>
      <div class="pie-legend">${legend}</div>
    </div>
  `;
}

function categoryColor(category) {
  const palette = {
    Alimentacao: "#c96f3a",
    Combustivel: "#2d7a6d",
    Supermercado: "#c0a04a",
    Lazer: "#8d5ea8",
    Vestuario: "#c2577d",
    Eletronicos: "#4d72c9",
    Outros: "#6f6a63"
  };

  return palette[category] || "#1f6f5f";
}

function fixedCostStatus(item) {
  const reimbursedAmount = item.reimbursedAmount || 0;
  const paidAmount = roundCurrency(item.originalAmount - item.remainingAmount - reimbursedAmount);

  if (item.remainingAmount <= 0 && reimbursedAmount > 0 && paidAmount <= 0) {
    return { key: "reimbursed", label: "Reembolsado" };
  }

  if (item.remainingAmount <= 0 && paidAmount > 0 && reimbursedAmount <= 0) {
    return { key: "paid", label: "Pago" };
  }

  if (item.remainingAmount <= 0 && paidAmount > 0 && reimbursedAmount > 0) {
    return { key: "mixed", label: "Pago Parcial + Reembolso" };
  }

  if (paidAmount > 0 || reimbursedAmount > 0) {
    return { key: "partial", label: "Parcial" };
  }

  return { key: "open", label: "Aberto" };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function runMigrations() {
  let changed = false;

  if (!state.migrations.creditInstallmentsPerValueV1) {
    migrateLegacyCreditInstallments();
    state.migrations.creditInstallmentsPerValueV1 = true;
    changed = true;
  }

  if (!state.migrations.marchCreditReplicationV1) {
    migrateMarchCreditReplications();
    state.migrations.marchCreditReplicationV1 = true;
    changed = true;
  }

  if (!state.migrations.marchCreditReplicationV2) {
    migrateMarchCreditReplicationsV2();
    state.migrations.marchCreditReplicationV2 = true;
    changed = true;
  }

  if (!state.migrations.rebuildFromMarchV1) {
    rebuildFutureAggregatorInstallmentsFromMarch();
    state.migrations.rebuildFromMarchV1 = true;
    changed = true;
  }

  if (changed) {
    persistState();
  }
}

function migrateLegacyCreditInstallments() {
  const creditGroups = new Map();

  state.transactions.forEach((transaction) => {
    if (transaction.paymentMethod !== "credito") {
      return;
    }

    if (transaction.installmentCount > 1) {
      const groupKey = transaction.groupId || transaction.id;

      if (!creditGroups.has(groupKey)) {
        creditGroups.set(groupKey, []);
      }

      creditGroups.get(groupKey).push(transaction);
      return;
    }

    if (!transaction.amountMode) {
      transaction.amountMode = "per_installment";
    }
  });

  creditGroups.forEach((group) => {
    const alreadyMigrated = group.every((item) => item.amountMode === "per_installment");

    if (alreadyMigrated) {
      return;
    }

    const intendedInstallmentValue = roundCurrency(group.reduce((sum, item) => sum + Number(item.amount || 0), 0));

    group.forEach((item) => {
      item.amount = intendedInstallmentValue;
      item.amountMode = "per_installment";
    });
  });
}

function migrateMarchCreditReplications() {
  const marchTransactions = state.transactions.filter((transaction) => {
    if (transaction.paymentMethod !== "credito" || transaction.installmentCount <= 1) {
      return false;
    }

    const date = new Date(`${transaction.date}T12:00:00`);
    return date.getFullYear() === 2026 && date.getMonth() === 2;
  });
  const grouped = new Map();

  marchTransactions.forEach((transaction) => {
    const groupKey = transaction.groupId || transaction.id;

    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, []);
    }

    grouped.get(groupKey).push(transaction);
  });

  grouped.forEach((group, groupId) => {
    const allGroupTransactions = state.transactions
      .filter((transaction) => (transaction.groupId || transaction.id) === groupId)
      .sort((left, right) => (left.installmentIndex || 1) - (right.installmentIndex || 1));
    const template = allGroupTransactions[0];

    if (!template) {
      return;
    }

    const anchor = allGroupTransactions.reduce((best, current) => {
      if (!best) {
        return current;
      }

      return (current.installmentIndex || 1) < (best.installmentIndex || 1) ? current : best;
    }, null);
    const anchorDate = new Date(`${anchor.date}T12:00:00`);
    const baseDate = addMonthsSafe(anchorDate, -((anchor.installmentIndex || 1) - 1));

    for (let index = 1; index <= (template.installmentCount || 1); index += 1) {
      const existing = allGroupTransactions.find((transaction) => (transaction.installmentIndex || 1) === index);

      if (existing) {
        continue;
      }

      state.transactions.push({
        id: crypto.randomUUID(),
        groupId,
        description: template.description,
        kind: template.kind,
        category: template.category,
        bucket: template.bucket,
        amount: template.amount,
        date: toInputDate(addMonthsSafe(baseDate, index - 1)),
        aggregatorId: template.aggregatorId || null,
        paymentMethod: "credito",
        amountMode: "per_installment",
        installmentIndex: index,
        installmentCount: template.installmentCount || 1
      });
    }
  });
}

function migrateMarchCreditReplicationsV2() {
  const marchCreditTransactions = state.transactions.filter((transaction) => {
    if (transaction.paymentMethod !== "credito") {
      return false;
    }

    if ((transaction.installmentCount || 1) <= 1) {
      return false;
    }

    const date = new Date(`${transaction.date}T12:00:00`);
    return date.getFullYear() === 2026 && date.getMonth() === 2;
  });
  const processedGroups = new Set();

  marchCreditTransactions.forEach((transaction) => {
    const groupId = transaction.groupId || transaction.id;

    if (processedGroups.has(groupId)) {
      return;
    }

    processedGroups.add(groupId);

    const relatedTransactions = state.transactions
      .filter((item) => (item.groupId || item.id) === groupId)
      .sort((left, right) => (left.installmentIndex || 1) - (right.installmentIndex || 1));
    const reference = relatedTransactions[0] || transaction;
    const referenceInstallmentIndex = reference.installmentIndex || 1;
    const referenceDate = new Date(`${reference.date}T12:00:00`);
    const baseDate = addMonthsSafe(referenceDate, -(referenceInstallmentIndex - 1));
    const installmentCount = reference.installmentCount || transaction.installmentCount || 1;

    for (let installmentIndex = 1; installmentIndex <= installmentCount; installmentIndex += 1) {
      const existing = relatedTransactions.find((item) => (item.installmentIndex || 1) === installmentIndex);

      if (existing) {
        existing.groupId = groupId;
        existing.amountMode = "per_installment";
        continue;
      }

      state.transactions.push({
        id: crypto.randomUUID(),
        groupId,
        description: reference.description,
        kind: reference.kind,
        category: reference.category,
        bucket: reference.bucket,
        amount: reference.amount,
        date: toInputDate(addMonthsSafe(baseDate, installmentIndex - 1)),
        aggregatorId: reference.aggregatorId || null,
        paymentMethod: "credito",
        amountMode: "per_installment",
        installmentIndex,
        installmentCount
      });
    }
  });
}

function rebuildFutureAggregatorInstallmentsFromMarch() {
  const cutoffYear = 2026;
  const cutoffMonth = 3;
  const futureTransactions = state.transactions.filter((transaction) => {
    const date = new Date(`${transaction.date}T12:00:00`);
    return date.getFullYear() > cutoffYear
      || (date.getFullYear() === cutoffYear && date.getMonth() >= cutoffMonth);
  });
  const futureIds = new Set(futureTransactions.map((transaction) => transaction.id));

  state.transactions = state.transactions.filter((transaction) => !futureIds.has(transaction.id));

  const marchAggregatorCredits = state.transactions.filter((transaction) => {
    if (transaction.bucket !== "agrupador") {
      return false;
    }

    if (transaction.kind !== "expense") {
      return false;
    }

    if (transaction.paymentMethod !== "credito") {
      return false;
    }

    if ((transaction.installmentCount || 1) <= 1) {
      return false;
    }

    const date = new Date(`${transaction.date}T12:00:00`);
    return date.getFullYear() === 2026 && date.getMonth() === 2;
  });
  const processedGroups = new Set();

  marchAggregatorCredits.forEach((transaction) => {
    const groupId = transaction.groupId || transaction.id;

    if (processedGroups.has(groupId)) {
      return;
    }

    processedGroups.add(groupId);

    const groupTransactions = state.transactions
      .filter((item) => (item.groupId || item.id) === groupId)
      .sort((left, right) => (left.installmentIndex || 1) - (right.installmentIndex || 1));
    const anchor = groupTransactions.find((item) => {
      const date = new Date(`${item.date}T12:00:00`);
      return date.getFullYear() === 2026 && date.getMonth() === 2;
    }) || transaction;
    const amount = anchor.amount;
    const installmentCount = anchor.installmentCount || 1;
    const anchorInstallmentIndex = anchor.installmentIndex || 1;
    const anchorDate = new Date(`${anchor.date}T12:00:00`);
    const baseDate = addMonthsSafe(anchorDate, -(anchorInstallmentIndex - 1));

    for (let installmentIndex = 1; installmentIndex <= installmentCount; installmentIndex += 1) {
      const targetDate = addMonthsSafe(baseDate, installmentIndex - 1);
      const isMarch2026 = targetDate.getFullYear() === 2026 && targetDate.getMonth() === 2;

      if (isMarch2026) {
        continue;
      }

      state.transactions.push({
        id: crypto.randomUUID(),
        groupId,
        description: anchor.description,
        kind: "expense",
        category: anchor.category,
        bucket: "agrupador",
        amount,
        date: toInputDate(targetDate),
        aggregatorId: anchor.aggregatorId || null,
        paymentMethod: "credito",
        amountMode: "per_installment",
        installmentIndex,
        installmentCount
      });
    }
  });
}

function roundCurrency(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
