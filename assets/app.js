(() => {
  const BACKEND_BASE = "https://api.ludens.school";
  const CREATE_PATH = "/create";

  const MAX_TOKENS = 1_000_000;
  const MIN_TOKENS = 1;
  const SLIDER_MAX_TOKENS = 5_000;
  const PRESETS = [10, 50, 100, 500];

  const numberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

  function $(id) {
    return document.getElementById(id);
  }

  function readQuery() {
    const params = new URLSearchParams(window.location.search);
    const acc = params.get("acc") ?? params.get("account") ?? "";
    const rawTokens = params.get("tokens");
    const tokens = rawTokens ? Number(rawTokens) : NaN;
    return { acc, tokens };
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
    if (!Number.isFinite(tokens)) return "Tokens: введи число.";
    if (!Number.isInteger(tokens)) return "Tokens: только целое число.";
    if (tokens < MIN_TOKENS || tokens > MAX_TOKENS)
      return `Tokens: от ${MIN_TOKENS} до ${numberFormatter.format(MAX_TOKENS)}.`;
    return null;
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

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function updateTokensUi(tokens) {
    const clamped = clampTokens(tokens);
    const tokensInput = $("tokensInput");
    const tokensRange = $("tokensRange");
    const tokensPretty = $("tokensPretty");
    if (tokensInput) tokensInput.value = String(clamped);
    if (tokensRange) tokensRange.value = String(Math.min(clamped, SLIDER_MAX_TOKENS));
    if (tokensPretty) tokensPretty.textContent = numberFormatter.format(clamped);
    return clamped;
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
    url.searchParams.set("currency", currency);
    return url.toString();
  }

  function main() {
    const accountInput = $("accountInput");
    const tokensInput = $("tokensInput");
    const tokensRange = $("tokensRange");
    const currencySelect = $("currencySelect");
    const payBtn = $("payBtn");

    if (!accountInput || !tokensInput || !tokensRange || !currencySelect || !payBtn) return;

    const { acc, tokens } = readQuery();
    if (acc) accountInput.value = acc;

    let currentTokens = updateTokensUi(Number.isFinite(tokens) ? tokens : 100);
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
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", main);
  } else {
    main();
  }
})();
