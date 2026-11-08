(() => {
const SESSION_KEY = "stargym_session";
const USERS_STORE_KEY = "stargym_registered_users";

let billingCfgCache = null;
async function getBillingCfg() {
  if (billingCfgCache) return billingCfgCache;
  try {
    const r = await fetch("/api/billing/public-config");
    if (!r.ok) throw new Error("No se pudo consultar la configuración de pagos.");
    billingCfgCache = await r.json();
  } catch {
    billingCfgCache = { paypal: false, binance: false };
  }
  return billingCfgCache;
}

function ensureRevealVisible() {
  const elements = Array.from(document.querySelectorAll(".reveal"));
  if (!elements.length) return;

  window.setTimeout(() => {
    const anyVisible = elements.some((el) => el.classList.contains("is-visible"));
    if (!anyVisible) {
      elements.forEach((el) => el.classList.add("is-visible"));
    }
  }, 150);
}

function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch (error) {
    return null;
  }
}

function updateLocalUserStore(updatedUser) {
  try {
    const stored = localStorage.getItem(USERS_STORE_KEY);
    if (!stored) return;
    const users = JSON.parse(stored);
    const idx = users.findIndex((u) => u.email.toLowerCase() === updatedUser.email.toLowerCase());
    if (idx >= 0) {
      users[idx] = { ...users[idx], ...updatedUser };
      localStorage.setItem(USERS_STORE_KEY, JSON.stringify(users));
    }
  } catch (e) {
    console.error("Error sincronizando usuario local:", e);
  }
}

function setProfileFeedback(message, isError = false) {
  const el = document.getElementById("profile-feedback");
  if (!el) return;
  el.hidden = false;
  el.textContent = message;
  el.classList.toggle("is-error", isError);
}

function clearProfileFeedback() {
  const el = document.getElementById("profile-feedback");
  if (!el) return;
  el.hidden = true;
  el.textContent = "";
  el.classList.remove("is-error");
}

async function fetchMe() {
  const session = getSession();
  if (!session?.token) {
    setProfileFeedback("No has iniciado sesión. Redirigiendo a login...", true);
    window.setTimeout(() => {
      window.location.replace("login.html");
    }, 800);
    return null;
  }

  // Intentar cargar perfil desde el backend si está activo
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const response = await fetch("/api/users/me", {
      headers: { Authorization: `Bearer ${session.token}` },
      signal: controller.signal
    });
    clearTimeout(timer);

    if (response.ok) {
      const result = await response.json();
      if (result.user) {
        session.user = { ...session.user, ...result.user };
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        updateLocalUserStore(session.user);
        return session.user;
      }
    }

    if (response.status === 401) {
      localStorage.removeItem(SESSION_KEY);
      window.setTimeout(() => {
        window.location.replace("login.html");
      }, 800);
      throw new Error("Tu sesión expiró o el token es inválido. Inicia sesión otra vez.");
    }
  } catch (error) {
    // Si no hay backend, continuamos con los datos de sesión local
  }

  // Fallback con datos locales
  if (session?.user) {
    return session.user;
  }
  return null;
}

function renderProfile(user) {
  if (!user) return;
  const nameEl = document.getElementById("profile-name");
  const emailEl = document.getElementById("profile-email");
  const verifiedEl = document.getElementById("profile-verified");
  const verifiedBadge = document.getElementById("profile-verified-badge");
  const dobEl = document.getElementById("profile-dob");
  const phoneEl = document.getElementById("profile-phone");
  const genderEl = document.getElementById("profile-gender");
  const updateForm = document.getElementById("profile-update-form");

  if (nameEl) nameEl.textContent = user.name || "—";
  if (dobEl) dobEl.textContent = user.dateOfBirth || "—";
  if (phoneEl) phoneEl.textContent = user.phoneNumber || "—";
  if (emailEl) emailEl.textContent = user.email || "—";
  if (genderEl) genderEl.textContent = user.gender || "—";
  if (verifiedEl) verifiedEl.textContent = user.emailVerified ? "Sí" : "No";
  if (verifiedBadge) {
    verifiedBadge.hidden = false;
    verifiedBadge.textContent = user.emailVerified ? "Cuenta verificada" : "Verificación pendiente";
    verifiedBadge.classList.toggle("is-ok", Boolean(user.emailVerified));
    verifiedBadge.classList.toggle("is-warn", !user.emailVerified);
  }

  if (updateForm) {
    const nameInput = updateForm.querySelector('input[name="name"]');
    const phoneInput = updateForm.querySelector('input[name="phoneNumber"]');
    if (nameInput && !nameInput.value) nameInput.value = user.name || "";
    if (phoneInput && !phoneInput.value) phoneInput.value = user.phoneNumber || "";
  }
}

async function updateProfile({ name, password, phoneNumber }) {
  const session = getSession();
  if (!session?.token) {
    window.location.replace("login.html");
    return null;
  }

  // Intentar en servidor
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const response = await fetch("/api/users/me", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.token}`
      },
      body: JSON.stringify({
        ...(name ? { name } : {}),
        ...(password ? { password } : {}),
        ...(phoneNumber ? { phoneNumber } : {})
      }),
      signal: controller.signal
    });
    clearTimeout(timer);

    if (response.ok) {
      const result = await response.json();
      session.user = { ...session.user, ...result.user };
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      updateLocalUserStore(session.user);
      return session.user;
    }
  } catch (error) {
    // Modo local
  }

  // Fallback local
  if (name) session.user.name = name;
  if (phoneNumber) session.user.phoneNumber = phoneNumber;
  if (password) session.user.password = password;
  session.user.updatedAt = new Date().toISOString();

  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  updateLocalUserStore(session.user);
  return session.user;
}

async function deleteAccount() {
  const session = getSession();
  if (!session?.token) {
    window.location.replace("login.html");
    return;
  }

  try {
    await fetch("/api/users/me", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session.token}` }
    });
  } catch (error) {
    // Si falla el servidor, eliminamos localmente
  }

  try {
    const stored = localStorage.getItem(USERS_STORE_KEY);
    if (stored) {
      const users = JSON.parse(stored).filter((u) => u.email.toLowerCase() !== session.user?.email?.toLowerCase());
      localStorage.setItem(USERS_STORE_KEY, JSON.stringify(users));
    }
  } catch (e) {
    // ignore
  }

  localStorage.removeItem(SESSION_KEY);
  if (typeof window.smoothNavigate === "function") {
    window.smoothNavigate("login.html?logout=1", true);
  } else {
    window.location.replace("login.html?logout=1");
  }
}

async function apiGet(path) {
  const session = getSession();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const response = await fetch(path, {
      headers: { Authorization: `Bearer ${session?.token || ""}` },
      signal: controller.signal
    });
    clearTimeout(timer);

    if (response.ok) {
      return await response.json();
    }
  } catch (e) {
    // Servidor offline, usar fallbacks
  }

  if (path === "/api/wallet") {
    return {
      wallet: session?.user?.wallet || {
        balance: 0,
        currency: "USD",
        transactions: []
      }
    };
  }

  if (path === "/api/enrollments") {
    return {
      enrollments: Array.isArray(session?.user?.enrollments) ? session.user.enrollments : []
    };
  }

  if (path === "/api/wallet/destinations") {
    return {
      destinations: [
        {
          id: "binance-pay",
          label: "Binance Pay",
          type: "Pago en línea",
          maskedAccount: "Consulta la configuración del servidor"
        },
        {
          id: "paypal",
          label: "PayPal",
          type: "Pago en línea",
          maskedAccount: "Consulta la configuración del servidor"
        }
      ]
    };
  }

  return {};
}

async function apiPost(path, body) {
  const session = getSession();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const response = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.token || ""}`
      },
      body: JSON.stringify(body || {}),
      signal: controller.signal
    });
    clearTimeout(timer);

    if (response.ok) {
      return await response.json();
    }
    const errData = await response.json().catch(() => ({}));
    if (errData.message) throw new Error(errData.message);
  } catch (err) {
    if (err.message && !err.message.includes("fetch") && !err.message.includes("abort")) {
      throw err;
    }
  }

  throw new Error("Operación no disponible en este momento.");
}

function money(value) {
  const n = Number(value || 0);
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function renderWallet(wallet) {
  if (!Array.isArray(wallet.transactions)) wallet.transactions = [];
  const welcomeBonusTotal = wallet.transactions
    .filter((transaction) => transaction.type === "TOPUP" && transaction.meta?.planName === "Bono de bienvenida")
    .reduce((total, transaction) => total + Math.max(0, Number(transaction.amount) || 0), 0);
  let walletChanged = false;
  if (welcomeBonusTotal) {
    wallet.balance = Math.max(0, Math.round((Number(wallet.balance || 0) - welcomeBonusTotal) * 100) / 100);
    wallet.transactions = wallet.transactions.filter(
      (transaction) => transaction.type !== "TOPUP" || transaction.meta?.planName !== "Bono de bienvenida"
    );
    walletChanged = true;
  }
  const hasBalanceSource = wallet.transactions.some((transaction) =>
    (transaction.type === "TOPUP" && Number(transaction.amount) > 0) ||
    (transaction.type === "ADMIN_ADJUSTMENT" && Number(transaction.amount) !== 0)
  );
  if (!hasBalanceSource && Number(wallet.balance) !== 0) {
    wallet.balance = 0;
    walletChanged = true;
  }
  if (walletChanged) {
    const session = getSession();
    if (session?.user) {
      session.user.wallet = wallet;
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      updateLocalUserStore(session.user);
    }
  }
  const bal = document.getElementById("wallet-balance");
  const cur = document.getElementById("wallet-currency");
  const list = document.getElementById("wallet-tx-list");
  if (bal) bal.textContent = money(wallet.balance);
  if (cur) cur.textContent = wallet.currency || "USD";
  if (list) {
    const tx = Array.isArray(wallet.transactions) ? wallet.transactions.slice(0, 15) : [];
    if (!tx.length) {
      list.innerHTML = `<li class="wallet-tx-item"><b>Sin movimientos</b><span>Realiza una recarga</span><span class="wallet-amount">—</span></li>`;
      return;
    }
    list.innerHTML = tx
      .map((t) => {
        const sign = t.amount >= 0 ? "+" : "−";
        const abs = Math.abs(Number(t.amount || 0));
        const label = t.type === "TOPUP" ? "Recarga" : t.type === "MEMBERSHIP" ? "Membresía" : t.type === "ADMIN_ADJUSTMENT" ? "Ajuste administrativo" : t.type;
        const meta = t.meta?.reason ? ` · ${t.meta.reason}` : t.meta?.planName ? ` · ${t.meta.planName}` : "";
        const date = t.createdAt ? new Date(t.createdAt).toLocaleString("es-ES") : "";
        return `<li class="wallet-tx-item"><b>${escapeHtml(label + meta)}</b><span>${escapeHtml(date)}</span><span class="wallet-amount">${sign}${money(abs)} ${escapeHtml(t.currency || "USD")}</span></li>`;
      })
      .join("");
  }
}

function renderEnrollments(enrollments) {
  const list = document.getElementById("enrollments-list");
  if (!list) return;
  const items = Array.isArray(enrollments) ? enrollments : [];
  if (!items.length) {
    list.innerHTML = `<li class="wallet-tx-item"><b>Sin inscripciones</b><span>Elige un plan para empezar</span><span class="wallet-amount">—</span></li>`;
    return;
  }
  list.innerHTML = items
    .slice(0, 6)
    .map((e) => {
      const date = e.startedAt ? new Date(e.startedAt).toLocaleString("es-ES") : "";
      const status = e.status || "—";
      const via = e.source === "paypal" ? " · PayPal" : e.source === "binance" ? " · Binance Pay" : "";
      return `<li class="wallet-tx-item"><b>${e.planName || e.planId}${via}</b><span>${date}</span><span class="wallet-amount">${status}</span></li>`;
    })
    .join("");
}

function initProfilePage() {
  const logoutBtn = document.getElementById("logout-btn");
  const updateForm = document.getElementById("profile-update-form");
  const deleteBtn = document.getElementById("delete-account-btn");
  const planButtons = Array.from(document.querySelectorAll("[data-plan]"));
  const openDestinationsBtn = document.getElementById("open-destinations-btn");
  const destinationsModal = document.getElementById("destinations-modal");
  const destinationsList = document.getElementById("destinations-list");
  const closeDestinationsBtn = document.getElementById("destinations-close");
  const closeDestinationsBackdrop = document.getElementById("destinations-close-backdrop");
  const walletTopupForm = document.getElementById("wallet-topup-form");

  const closeDestinations = () => {
    if (!destinationsModal) return;
    destinationsModal.hidden = true;
    document.body.style.overflow = "";
  };

  const openDestinations = async () => {
    if (!destinationsModal) return;
    try {
      const result = await apiGet("/api/wallet/destinations");
      if (destinationsList) {
        const items = Array.isArray(result.destinations) ? result.destinations : [];
        destinationsList.innerHTML = items
          .map(
            (d) => `
            <li class="destination-item">
              <b>${d.label}</b>
              <span>${d.type}</span>
              <span>${d.maskedAccount}</span>
            </li>
          `
          )
          .join("");
      }
      destinationsModal.hidden = false;
      document.body.style.overflow = "hidden";
    } catch (error) {
      setProfileFeedback(error.message, true);
    }
  };

  openDestinationsBtn?.addEventListener("click", openDestinations);
  closeDestinationsBtn?.addEventListener("click", closeDestinations);
  closeDestinationsBackdrop?.addEventListener("click", closeDestinations);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && destinationsModal && !destinationsModal.hidden) {
      closeDestinations();
    }
  });

  logoutBtn?.addEventListener("click", () => {
    if (typeof window.logoutUser === "function") {
      void window.logoutUser();
      return;
    }
    localStorage.removeItem(SESSION_KEY);
    window.location.replace("index.html?logout=1");
  });

  walletTopupForm?.addEventListener("submit", (event) => event.preventDefault());
  walletTopupForm?.querySelectorAll("[data-wallet-payment]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (button.disabled) return;
      clearProfileFeedback();
      if (!walletTopupForm.checkValidity()) {
        walletTopupForm.reportValidity();
        return;
      }

      const amount = Number(new FormData(walletTopupForm).get("amount") || 0);
      if (amount < 1 || amount > 1000) {
        setProfileFeedback("La recarga debe estar entre 1 y 1000 USD.", true);
        return;
      }

      const provider = button.dataset.walletPayment;
      button.disabled = true;
      try {
        setProfileFeedback(`Conectando con ${provider === "paypal" ? "PayPal" : "Binance Pay"}...`);
        const { url } = await apiPost("/api/billing/checkout", {
          provider,
          kind: "wallet_topup",
          amount
        });
        if (!url) throw new Error("El proveedor no devolvió el enlace de pago.");
        window.location.assign(url);
      } catch (error) {
        setProfileFeedback(error.message || "No se pudo iniciar el pago.", true);
      } finally {
        button.disabled = false;
      }
    });
  });

  updateForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearProfileFeedback();

    if (!updateForm.checkValidity()) {
      updateForm.reportValidity();
      return;
    }

    const data = new FormData(updateForm);
    const name = String(data.get("name") || "").trim();
    const password = String(data.get("password") || "").trim();
    const phoneNumber = String(data.get("phoneNumber") || "").trim();

    const cleanedPhone = phoneNumber.replace(/\D/g, "");
    if (phoneNumber && (cleanedPhone.length < 7 || cleanedPhone.length > 15)) {
      setProfileFeedback("Número de teléfono inválido.", true);
      return;
    }

    if (!name && !password && !phoneNumber) {
      setProfileFeedback("No hay cambios para guardar.", false);
      return;
    }

    try {
      const user = await updateProfile({ name, password, phoneNumber });
      renderProfile(user);
      setProfileFeedback("Perfil actualizado correctamente.", false);
      updateForm.reset();
    } catch (error) {
      setProfileFeedback(error.message, true);
    }
  });

  deleteBtn?.addEventListener("click", async () => {
    clearProfileFeedback();
    const message = "¿Seguro que quieres eliminar tu cuenta? Esta acción no se puede deshacer.";
    const ok = typeof window.showStargymConfirm === "function" 
      ? await window.showStargymConfirm(message)
      : window.confirm(message);
      
    if (!ok) return;
    try {
      await deleteAccount();
    } catch (error) {
      setProfileFeedback(error.message, true);
    }
  });

  planButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      clearProfileFeedback();
      const planId = btn.dataset.plan;
      window.location.href = `checkout.html?plan=${encodeURIComponent(planId)}`;
    });
  });

  (async () => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("payment") === "success") {
        setProfileFeedback(
          params.get("kind") === "membership"
            ? "Pago confirmado: tu membresía está activa por un mes."
            : "Pago confirmado: el saldo se acreditó en tu cartera.",
          false
        );
        window.history.replaceState({}, "", window.location.pathname || "profile.html");
      } else if (params.get("payment") === "cancelled") {
        setProfileFeedback("Pago cancelado. No se ha realizado ningún cargo.", true);
        window.history.replaceState({}, "", window.location.pathname || "profile.html");
      }

      const billingConfig = await getBillingCfg();
      walletTopupForm?.querySelectorAll("[data-wallet-payment]").forEach((button) => {
        button.disabled = !billingConfig[button.dataset.walletPayment];
        if (button.disabled) {
          button.title = button.dataset.walletPayment === "paypal"
            ? "Configura PAYPAL_CLIENT_ID y PAYPAL_CLIENT_SECRET en .env."
            : "Configura las credenciales de Binance Pay en .env.";
        }
      });

      // Render inicial inmediato con datos de sesión
      const session = getSession();
      if (session?.user) {
        renderProfile(session.user);
        if (session.user.wallet) renderWallet(session.user.wallet);
        if (session.user.enrollments) renderEnrollments(session.user.enrollments);
      }

      const user = await fetchMe();
      if (user) renderProfile(user);

      const walletResult = await apiGet("/api/wallet");
      if (walletResult.wallet) renderWallet(walletResult.wallet);

      const enrollResult = await apiGet("/api/enrollments");
      if (enrollResult.enrollments) renderEnrollments(enrollResult.enrollments);
    } catch (error) {
      setProfileFeedback(error.message, true);
    }
  })();
}

initProfilePage();
ensureRevealVisible();
})();
