(() => {
  const BACKEND_BASE = "https://api.ludens.school";
  const CREATE_PATH = "/pay/api/create";
  const PREMIUM_PLANS_PATH = "/premium/plans";
  const PREMIUM_CREATE_PATH = "/premium/create";
  const PREMIUM_CURRENCY = "UAH";
  const ACCOUNT_STORAGE_KEY = "ludens_pay_account";

  const MAX_TOKENS = 500;
  const MIN_TOKENS = 1;
  const SLIDER_MAX_TOKENS = 500;
  const PRESETS = [10, 50, 100, 500];
  const PREMIUM_DAYS_ORDER = [7, 30, 60];

  const numberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
  const uahFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

  function $(id) {
    return document.getElementById(id);
  }

  function readQuery() {
    const params = new URLSearchParams(window.location.search);
    const acc = params.get("acc") ?? params.get("account") ?? "";
    const rawTokens = params.get("tokens");
    const tokens = rawTokens ? Number(rawTokens) : NaN;
    const tab = params.get("tab") ?? params.get("mode") ?? "";
    return { acc, tokens, tab };
  }

  function clampTokens(value) {
    if (!Number.isFinite(value)) return MIN_TOKENS;
    return Math.min(MAX_TOKENS, Math.max(MIN_TOKENS, Math.trunc(value)));
  }

  function parseTokensFromInput(value) {
    const raw = String(value ?? "").trim();
    if (!raw) return NaN;
    const cleaned = raw.replace(/[\s_]/g, "");
    if (!/^\d+$/.test(cleaned)) return NaN;
    return Number(cleaned);
  }

  function validateAccount(account) {
    const trimmed = account.trim();
    if (trimmed.length < 2 || trimmed.length > 32) return "Имя аккаунта: 2–32 символа.";
    if (!/^[A-Za-z0-9_]+$/.test(trimmed)) return "Имя аккаунта: только A–Z, 0–9 и _.";
    return null;
  }

  function validateTokens(tokens) {
    if (!Number.isFinite(tokens)) return "ТОКЕНЫ: введи число.";
    if (!Number.isInteger(tokens)) return "ТОКЕНЫ: только целое число.";
    if (tokens < MIN_TOKENS || tokens > MAX_TOKENS)
      return `ТОКЕНЫ: от ${MIN_TOKENS} до ${numberFormatter.format(MAX_TOKENS)}.`;
    return null;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function showErrors(messages) {
    const box = $("errors");
    const list = $("errorsList");
    if (!box || !list) return;

    if (!messages.length) {
      box.classList.remove("show");
      list.innerHTML = "";
      return;
    }

    box.classList.add("show");
    list.innerHTML = messages.map((m) => `<li>${escapeHtml(m)}</li>`).join("");
  }

  function showPremiumErrors(messages) {
    const box = $("premiumErrors");
    const list = $("premiumErrorsList");
    if (!box || !list) return;

    if (!messages.length) {
      box.classList.remove("show");
      list.innerHTML = "";
      return;
    }

    box.classList.add("show");
    list.innerHTML = messages.map((m) => `<li>${escapeHtml(m)}</li>`).join("");
  }

  function updateTokensUi(tokens) {
    const clamped = clampTokens(tokens);
    const tokensInput = $("tokensInput");
    const tokensRange = $("tokensRange");
    if (tokensInput) tokensInput.value = String(clamped);
    if (tokensRange) tokensRange.value = String(Math.min(clamped, SLIDER_MAX_TOKENS));
    return clamped;
  }

  function setButtonDisabled(button, disabled) {
    if (!button) return;
    button.disabled = Boolean(disabled);
  }

  function getStoredAccount() {
    try {
      return window.localStorage.getItem(ACCOUNT_STORAGE_KEY) || "";
    } catch {
      return "";
    }
  }

  function setStoredAccount(value) {
    try {
      window.localStorage.setItem(ACCOUNT_STORAGE_KEY, value);
    } catch {
      // ignore
    }
  }

  function setTab(tab) {
    const premiumPanel = $("tabPremium");
    const tokensPanel = $("tabTokens");
    const premiumBtn = $("tabPremiumBtn");
    const tokensBtn = $("tabTokensBtn");
    const asidePremium = $("asidePremium");
    const asideTokens = $("asideTokens");

    const isPremium = tab === "premium";

    if (premiumPanel) premiumPanel.hidden = !isPremium;
    if (tokensPanel) tokensPanel.hidden = isPremium;

    if (premiumBtn) {
      premiumBtn.classList.toggle("active", isPremium);
      premiumBtn.setAttribute("aria-selected", String(isPremium));
      premiumBtn.tabIndex = isPremium ? 0 : -1;
    }
    if (tokensBtn) {
      tokensBtn.classList.toggle("active", !isPremium);
      tokensBtn.setAttribute("aria-selected", String(!isPremium));
      tokensBtn.tabIndex = isPremium ? -1 : 0;
    }

    if (asidePremium) asidePremium.hidden = !isPremium;
    if (asideTokens) asideTokens.hidden = isPremium;

    if (isPremium) {
      showErrors([]);
    } else {
      showPremiumErrors([]);
    }

    return isPremium;
  }

  function normalizePlans(data) {
    const list =
      (Array.isArray(data) && data) ||
      (data && Array.isArray(data.plans) && data.plans) ||
      (data && Array.isArray(data.data) && data.data) ||
      [];

    return list
      .map((plan) => {
        if (!plan || typeof plan !== "object") return null;
        const code = String(plan.code ?? plan.plan ?? plan.plan_code ?? plan.id ?? "").trim();
        const amountMinor = Number(plan.amount_minor ?? plan.amountMinor ?? plan.amount ?? plan.price_minor ?? plan.priceMinor);
        const days = Number(plan.days ?? plan.duration_days ?? plan.durationDays);
        return { code, amountMinor, days, raw: plan };
      })
      .filter(Boolean);
  }

  function inferDays(plan) {
    if (Number.isFinite(plan.days) && plan.days > 0) return plan.days;
    const match = /(\d{1,3})/.exec(plan.code);
    if (!match) return NaN;
    const parsed = Number(match[1]);
    return Number.isFinite(parsed) ? parsed : NaN;
  }

  function formatAmountMinor(amountMinor) {
    if (!Number.isFinite(amountMinor)) return "-";
    return `${uahFormatter.format(amountMinor / 100)} грн`;
  }

  function renderPlans({ plansByDays, selectedPlanCode, loading, errorMessage }) {
    const status = $("plansStatus");
    const grid = $("plansGrid");
    if (!status || !grid) return;

    if (loading) {
      status.textContent = "Загружаем планы...";
    } else if (errorMessage) {
      status.textContent = "Не удалось загрузить планы";
    } else {
      status.textContent = "";
    }

    status.classList.toggle("hintError", Boolean(errorMessage));

    const cards = PREMIUM_DAYS_ORDER.map((days) => {
      const plan = plansByDays.get(days) || null;
      const code = plan?.code || `PREM_${days}`;
      const isSelected = code && code === selectedPlanCode;
      const disabled = false;
      const price = plan ? formatAmountMinor(plan.amountMinor) : loading ? "..." : "-";
      const title = `Премиум на ${days} дней`;

      return `
        <button
          type="button"
          class="planCard${isSelected ? " selected" : ""}"
          data-plan-code="${escapeHtml(code)}"
          ${disabled ? "disabled" : ""}
          aria-pressed="${isSelected ? "true" : "false"}"
        >
          <div class="planTitle">${escapeHtml(title)}</div>
          <div class="planPrice">${escapeHtml(price)}</div>
        </button>
      `;
    }).join("");

    grid.innerHTML = cards;
  }

  function buildPremiumCreateUrl({ account, planCode, currency }) {
    const url = new URL(PREMIUM_CREATE_PATH, BACKEND_BASE);
    url.searchParams.set("account", account);
    url.searchParams.set("plan", planCode);
    url.searchParams.set("currency", currency || PREMIUM_CURRENCY);
    return url.toString();
  }

  function initPresets(setTokens) {
    const root = $("presets");
    if (!root) return;
    root.innerHTML = PRESETS.map(
      (p) =>
        `<button type="button" class="chip" data-value="${p}">${numberFormatter.format(p)}</button>`,
    ).join("");
    root.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      const button = target.closest("[data-value]");
      if (!(button instanceof HTMLElement)) return;
      const next = Number(button.getAttribute("data-value"));
      if (!Number.isFinite(next)) return;
      setTokens(next);
    });
  }

  function buildRedirectUrl({ account, tokens, currency }) {
    const url = new URL(CREATE_PATH, BACKEND_BASE);
    url.searchParams.set("account", account);
    url.searchParams.set("tokens", String(tokens));
    url.searchParams.set("currency", currency || "UAH");
    return url.toString();
  }

  function main() {
    const accountInput = $("accountInput");
    const tokensInput = $("tokensInput");
    const tokensRange = $("tokensRange");
    const currencySelect = $("currencySelect");
    const payBtn = $("payBtn");
    const payPremiumBtn = $("payPremiumBtn");
    const plansGrid = $("plansGrid");
    const tabPremiumBtn = $("tabPremiumBtn");
    const tabTokensBtn = $("tabTokensBtn");
    const premiumPanel = $("tabPremium");
    const tokensPanel = $("tabTokens");

    if (!accountInput || !tokensInput || !tokensRange || !currencySelect || !payBtn || !payPremiumBtn) return;

    let activeTab = "premium";
    let plansLoading = false;
    let plansLoaded = false;
    let plansError = "";
    let selectedPlanCode = "";
    const plansByDays = new Map();

    const { acc, tokens, tab } = readQuery();
    const storedAcc = getStoredAccount();
    const initialAccount = acc || storedAcc;
    if (initialAccount) accountInput.value = initialAccount;
    if (acc) setStoredAccount(acc);

    const normalizedTab = String(tab || "")
      .trim()
      .toLowerCase();
    const hasTokensQuery = Number.isFinite(tokens);
    activeTab =
      normalizedTab === "tokens" || normalizedTab === "token"
        ? "tokens"
        : normalizedTab === "premium" || normalizedTab === "subscription" || normalizedTab === "sub"
          ? "premium"
          : hasTokensQuery
            ? "tokens"
            : "premium";

    let currentTokens = updateTokensUi(Number.isFinite(tokens) ? tokens : 1);
    initPresets((next) => {
      currentTokens = updateTokensUi(next);
      showErrors([]);
    });

    tokensInput.addEventListener("input", () => {
      const parsed = parseTokensFromInput(tokensInput.value);
      if (!Number.isFinite(parsed)) return;
      currentTokens = updateTokensUi(parsed);
      showErrors([]);
    });

    tokensRange.addEventListener("input", () => {
      const next = Number(tokensRange.value);
      currentTokens = updateTokensUi(next);
      showErrors([]);
    });

    function updateButtons() {
      const account = accountInput.value.trim();
      const hasAccount = Boolean(account);

      setButtonDisabled(payBtn, !hasAccount);
      setButtonDisabled(payPremiumBtn, !hasAccount || !selectedPlanCode);
    }

    function measurePanelHeight(panel, width) {
      if (!panel) return 0;
      if (!panel.hidden) return panel.offsetHeight;

      const prevWidth = panel.style.width;
      panel.hidden = false;
      panel.classList.add("measureHidden");
      panel.style.width = `${width}px`;
      const height = panel.offsetHeight;
      panel.classList.remove("measureHidden");
      panel.style.width = prevWidth;
      panel.hidden = true;
      return height;
    }

    let syncRaf = 0;
    function queueSyncTabPanelHeights() {
      window.cancelAnimationFrame(syncRaf);
      syncRaf = window.requestAnimationFrame(() => {
        syncRaf = 0;
        syncTabPanelHeights();
      });
    }

    function syncTabPanelHeights() {
      if (!premiumPanel || !tokensPanel) return;
      const container = premiumPanel.parentElement;
      const width = (container?.getBoundingClientRect().width || premiumPanel.getBoundingClientRect().width || 0);
      if (!width) return;

      const premiumHeight = measurePanelHeight(premiumPanel, width);
      const tokensHeight = measurePanelHeight(tokensPanel, width);
      const minHeight = Math.max(premiumHeight, tokensHeight, 0);
      if (!minHeight) return;

      premiumPanel.style.minHeight = `${minHeight}px`;
      tokensPanel.style.minHeight = `${minHeight}px`;
    }

    accountInput.addEventListener("input", () => {
      setStoredAccount(accountInput.value.trim());
      updateButtons();
    });

    payBtn.addEventListener("click", () => {
      const account = accountInput.value.trim();
      const currency = currencySelect.value;
      const rawTokens = parseTokensFromInput(tokensInput.value);
      const tokensValue = clampTokens(rawTokens);

      const errors = [validateAccount(account), validateTokens(rawTokens)].filter(Boolean);
      showErrors(errors);
      if (errors.length) return;

      const redirectUrl = buildRedirectUrl({ account, tokens: tokensValue, currency });
      window.location.href = redirectUrl;
    });

    async function ensurePlansLoaded() {
      if (plansLoaded || plansLoading) return;
      plansLoading = true;
      plansError = "";
      showPremiumErrors([]);
      renderPlans({ plansByDays, selectedPlanCode, loading: true, errorMessage: "" });
      queueSyncTabPanelHeights();

      try {
        const url = new URL(PREMIUM_PLANS_PATH, BACKEND_BASE);
        url.searchParams.set("currency", PREMIUM_CURRENCY);

        const response = await fetch(url.toString(), {
          method: "GET",
          credentials: "omit",
          cache: "no-store",
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const normalized = normalizePlans(data);

        plansByDays.clear();
        for (const plan of normalized) {
          if (!plan.code) continue;
          const days = inferDays(plan);
          if (!PREMIUM_DAYS_ORDER.includes(days)) continue;
          if (!plansByDays.has(days)) plansByDays.set(days, plan);
        }

        plansLoaded = true;
      } catch {
        plansError = "Не удалось загрузить планы";
      } finally {
        plansLoading = false;
        renderPlans({ plansByDays, selectedPlanCode, loading: false, errorMessage: plansError });
        queueSyncTabPanelHeights();
        updateButtons();
      }
    }

    if (plansGrid) {
      plansGrid.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      const button = target.closest("[data-plan-code]");
      if (!(button instanceof HTMLElement)) return;
      if (button.hasAttribute("disabled")) return;
      const planCode = button.getAttribute("data-plan-code") || "";
      if (!planCode) return;

      selectedPlanCode = planCode;
      renderPlans({ plansByDays, selectedPlanCode, loading: plansLoading, errorMessage: plansError });
      queueSyncTabPanelHeights();
      updateButtons();
      });
    }

    payPremiumBtn.addEventListener("click", async () => {
      const account = accountInput.value.trim();
      const errors = [];
      if (!account) errors.push("Укажи имя аккаунта.");
      if (!selectedPlanCode) errors.push("Выбери срок Премиум подписки.");

      showPremiumErrors(errors);
      if (errors.length) return;

      const createUrl = buildPremiumCreateUrl({ account, planCode: selectedPlanCode, currency: PREMIUM_CURRENCY });

      try {
        setButtonDisabled(payPremiumBtn, true);
        payPremiumBtn.textContent = "Открываем оплату...";

        const response = await fetch(createUrl, {
          method: "GET",
          credentials: "omit",
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const pageUrl = typeof data?.page_url === "string" ? data.page_url.trim() : "";
        if (!pageUrl) throw new Error("Missing page_url");

        window.location.href = pageUrl;
      } catch {
        showPremiumErrors(["Не удалось открыть оплату. Попробуй ещё раз."]);
        updateButtons();
      } finally {
        payPremiumBtn.textContent = "Оплатить Премиум";
        updateButtons();
      }
    });

    function applyTab(tab) {
      activeTab = tab === "tokens" ? "tokens" : "premium";
      const isPremium = setTab(activeTab);
      if (isPremium) void ensurePlansLoaded();
      updateButtons();
      queueSyncTabPanelHeights();
    }

    if (tabPremiumBtn) tabPremiumBtn.addEventListener("click", () => applyTab("premium"));
    if (tabTokensBtn) tabTokensBtn.addEventListener("click", () => applyTab("tokens"));

    applyTab(activeTab);

    let resizeTimer = 0;
    window.addEventListener("resize", () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(queueSyncTabPanelHeights, 80);
    });

    window.setTimeout(queueSyncTabPanelHeights, 0);
    if (document.fonts?.ready) {
      document.fonts.ready.then(queueSyncTabPanelHeights).catch(() => {});
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", main);
  } else {
    main();
  }
})();
