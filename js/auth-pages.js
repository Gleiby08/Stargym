/**
 * auth-pages.js — Stargym
 * Funciona en dos modos automáticamente:
 *  1. Con servidor Node.js (localhost:3000): usa la API real
 *  2. Sin servidor: el registro requiere el backend para enviar y validar el código
 */

const SESSION_KEY = "stargym_session";
const USERS_STORE_KEY = "stargym_registered_users";

// ─── Redirección si ya hay sesión ────────────────────────────────────────────
(() => {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has("force")) {
      localStorage.removeItem(SESSION_KEY);
      return;
    }
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    if (session && session.token && session.user) {
      window.location.replace(getPostLoginDestination());
    }
  } catch (_) {}
})();

// ─── Helpers de almacenamiento local ─────────────────────────────────────────
function getLocalUsers() {
  try {
    const stored = localStorage.getItem(USERS_STORE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        parsed.forEach(normalizeLocalWallet);
        saveLocalUsers(parsed);
        return parsed;
      }
    }
  } catch (_) {}

  const defaults = [
    {
      id: "usr-gleiby",
      name: "Gleiby Barreto",
      email: "gleiby07@gmail.com",
      password: "123456",
      emailVerified: true,
      gender: "Hombre",
      phoneNumber: "600123456",
      dateOfBirth: "1995-05-15",
      wallet: { balance: 0, currency: "USD", transactions: [], topupIntents: [] },
      enrollments: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: "usr-demo",
      name: "Usuario Demo",
      email: "demo@stargym.com",
      password: "123456",
      emailVerified: true,
      gender: "Otro",
      phoneNumber: "600000000",
      dateOfBirth: "2000-01-01",
      wallet: { balance: 0, currency: "USD", transactions: [], topupIntents: [] },
      enrollments: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  saveLocalUsers(defaults);
  return defaults;
}

function normalizeLocalWallet(user) {
  if (!user.wallet || typeof user.wallet !== "object") {
    user.wallet = { balance: 0, currency: "USD", transactions: [], topupIntents: [] };
  }
  if (!Array.isArray(user.wallet.transactions)) user.wallet.transactions = [];

  const welcomeBonusTotal = user.wallet.transactions
    .filter((transaction) => transaction.type === "TOPUP" && transaction.meta?.planName === "Bono de bienvenida")
    .reduce((total, transaction) => total + Math.max(0, Number(transaction.amount) || 0), 0);
  if (welcomeBonusTotal) {
    user.wallet.balance = Math.max(0, Math.round((Number(user.wallet.balance || 0) - welcomeBonusTotal) * 100) / 100);
    user.wallet.transactions = user.wallet.transactions.filter(
      (transaction) => transaction.type !== "TOPUP" || transaction.meta?.planName !== "Bono de bienvenida"
    );
  }
  if (!user.wallet.transactions.some((transaction) => transaction.type === "TOPUP" && Number(transaction.amount) > 0)) {
    user.wallet.balance = 0;
  }
}

function saveLocalUsers(users) {
  try {
    localStorage.setItem(USERS_STORE_KEY, JSON.stringify(users));
  } catch (_) {}
}

function createLocalSession(user) {
  const sessionUser = {
    id: user.id || ("usr-" + Date.now()),
    name: user.name || "Usuario",
    email: user.email,
    emailVerified: Boolean(user.emailVerified),
    gender: user.gender || "Otro",
    phoneNumber: user.phoneNumber || "",
    dateOfBirth: user.dateOfBirth || "",
    wallet: user.wallet || { balance: 0, currency: "USD", transactions: [], topupIntents: [] },
    enrollments: Array.isArray(user.enrollments) ? user.enrollments : []
  };
  const sessionData = { token: "stargym-local-token-" + sessionUser.id, user: sessionUser };
  localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
  return sessionData;
}

// ─── Feedback UI ──────────────────────────────────────────────────────────────
function setFeedback(message, isError = false) {
  const el = document.getElementById("auth-page-feedback");
  if (!el) return;
  el.hidden = false;
  el.textContent = message;
  el.classList.toggle("is-error", isError);
}

function clearFeedback() {
  const el = document.getElementById("auth-page-feedback");
  if (el) { el.hidden = true; el.textContent = ""; el.classList.remove("is-error"); }
}

function setButtonLoading(form, loading) {
  const btn = form.querySelector("button[type=submit]");
  if (!btn) return;
  btn.disabled = loading;
  btn.textContent = loading ? "Procesando..." : btn.dataset.originalText || btn.textContent;
  if (!loading && btn.dataset.originalText) btn.textContent = btn.dataset.originalText;
}

function getPostLoginDestination() {
  const privatePages = new Set(["dashboard.html", "profile.html", "checkout.html"]);
  const requested = new URLSearchParams(window.location.search).get("redirect");
  return privatePages.has(requested) ? requested : "index.html";
}

// ─── Intento de petición al servidor (con timeout) ────────────────────────────
async function tryServerRequest(url, options, timeoutMs = 3000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return resp;
  } catch (err) {
    clearTimeout(timer);
    return null; // null = servidor no disponible / timeout
  }
}

// ─── Redirección tras login ───────────────────────────────────────────────────
function redirectAfterLogin(delay = 700) {
  setTimeout(() => {
    const destination = getPostLoginDestination();
    if (typeof window.smoothNavigate === "function") {
      window.smoothNavigate(destination, true);
    } else {
      window.location.replace(destination);
    }
  }, delay);
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════════════════════════════════════════
function initLoginPage() {
  const form = document.getElementById("login-page-form");
  if (!form) return;

  // Guardar texto original del botón
  const btn = form.querySelector("button[type=submit]");
  if (btn) btn.dataset.originalText = btn.textContent;

  // Pre-rellenar email si viene por parámetro URL
  const urlParams = new URLSearchParams(window.location.search);
  const emailParam = urlParams.get("email");
  if (emailParam) {
    const emailInput = form.querySelector('input[name="email"]');
    if (emailInput) emailInput.value = emailParam.trim();
  }
  if (urlParams.get("registered") === "1") {
    setFeedback("¡Cuenta creada! Ya puedes iniciar sesión.", false);
  }
  if (urlParams.get("logout") === "1") {
    setFeedback(
      urlParams.get("serverLogout") === "failed"
        ? "Sesión cerrada en este dispositivo; no se pudo confirmar la revocación en el servidor."
        : "Has cerrado sesión correctamente.",
      false
    );
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }

    const email = String(new FormData(form).get("email") || "").trim().toLowerCase();
    const password = String(new FormData(form).get("password") || "");

    clearFeedback();
    setFeedback("Verificando credenciales...");
    setButtonLoading(form, true);

    try {
      // 1. Intentar con el servidor Node.js
      const resp = await tryServerRequest("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      if (resp !== null) {
        // El servidor respondió — confiamos en él
        let result = {};
        try { result = await resp.json(); } catch (_) {}

        if (resp.ok && result.token && result.user) {
          localStorage.setItem(SESSION_KEY, JSON.stringify({ token: result.token, user: result.user }));
          setFeedback("¡Inicio de sesión exitoso! Redirigiendo...", false);
          redirectAfterLogin();
          return;
        }

        // Error de servidor con mensaje claro (credenciales, cuenta no verificada, etc.)
        setFeedback(result.message || "Credenciales incorrectas.", true);
        return;
      }

      // 2. Servidor no disponible → modo local
      const users = getLocalUsers();
      const user = users.find((u) => u.email.toLowerCase() === email);

      if (!user) {
        setFeedback("No existe ninguna cuenta con este correo. Puedes crear una en la página de registro.", true);
        return;
      }

      if (user.password !== password) {
        setFeedback("Contraseña incorrecta. Revisa tus datos e inténtalo de nuevo.", true);
        return;
      }

      createLocalSession(user);
      setFeedback("¡Inicio de sesión exitoso! Redirigiendo...", false);
      redirectAfterLogin();

    } finally {
      setButtonLoading(form, false);
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// REGISTRO
// ═══════════════════════════════════════════════════════════════════════════════
function initRegisterPage() {
  const form = document.getElementById("register-page-form");
  if (!form) return;

  const btn = form.querySelector("button[type=submit]");
  if (btn) btn.dataset.originalText = btn.textContent;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }

    const fd = new FormData(form);
    const name = String(fd.get("name") || "").trim();
    const email = String(fd.get("email") || "").trim().toLowerCase();
    const password = String(fd.get("password") || "");
    const phoneNumber = String(fd.get("phoneNumber") || "").trim();
    const dateOfBirth = String(fd.get("dateOfBirth") || "").trim();
    const gender = String(fd.get("gender") || "").trim();

    clearFeedback();
    setFeedback("Creando tu cuenta...");
    setButtonLoading(form, true);

    try {
      // 1. Intentar con el servidor Node.js
      const resp = await tryServerRequest("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, phoneNumber, dateOfBirth, gender })
      }, 20000);

      if (resp !== null) {
        let result = {};
        try { result = await resp.json(); } catch (_) {}

        if (!resp.ok) {
          setFeedback(result.message || "No se pudo crear la cuenta.", true);
          return;
        }

        setFeedback(result.message || "Cuenta creada. Revisa tu correo para obtener el código de activación.", false);
        setTimeout(() => {
          window.location.replace(`verify.html?email=${encodeURIComponent(email)}`);
        }, 500);
        return;
      }

      setFeedback("No se pudo conectar con el servidor. Inicia la aplicación desde el servidor Stargym para crear tu cuenta.", true);

    } finally {
      setButtonLoading(form, false);
    }
  });
}

// ─── Inicializar ──────────────────────────────────────────────────────────────
initLoginPage();
initRegisterPage();
