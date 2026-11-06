(() => {
  const SESSION_KEY = "stargym_session";

  const PLAN_LABELS = {
    essential: { name: "Starter", color: "#b8e83e" },
    elite: { name: "ELITE", color: "#823fef" },
    pro: { name: "CHAMPION", color: "#ffaa28" },
  };

  function getSession() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    } catch {
      return null;
    }
  }

  function money(value) {
    return Number(value || 0).toLocaleString("es-ES", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // ---- Membresía ----
  function renderMembership(user) {
    const badge = document.getElementById("dash-plan-badge");
    const nameEl = document.getElementById("dash-plan-name");
    const statusEl = document.getElementById("dash-plan-status");
    const dateEl = document.getElementById("dash-plan-date");

    const enrollments = Array.isArray(user?.enrollments) ? user.enrollments : [];
    const active = enrollments.find((e) => e.status === "ACTIVE");

    if (active) {
      const planInfo = PLAN_LABELS[active.planId] || { name: active.planName || active.planId, color: "#b8e83e" };
      if (badge) {
        badge.textContent = planInfo.name;
        badge.style.background = planInfo.color + "22";
        badge.style.color = planInfo.color;
        badge.style.borderColor = planInfo.color + "55";
      }
      if (nameEl) nameEl.textContent = planInfo.name;
      if (statusEl) {
        statusEl.textContent = "ACTIVO";
        statusEl.className = "dash-status dash-status--active";
      }
      if (dateEl && active.startedAt) {
        dateEl.textContent = new Date(active.startedAt).toLocaleDateString("es-ES", {
          day: "2-digit", month: "long", year: "numeric"
        });
      }
    } else {
      if (badge) { badge.textContent = "Sin plan"; badge.style.cssText = "background:rgba(255,255,255,.06);color:#888;border-color:rgba(255,255,255,.12)"; }
      if (nameEl) nameEl.textContent = "Sin membresía activa";
      if (statusEl) { statusEl.textContent = "INACTIVO"; statusEl.className = "dash-status dash-status--inactive"; }
      if (dateEl) dateEl.textContent = "—";
    }
  }

  // ---- Rutinas ----
  function renderRoutines(user) {
    const list = document.getElementById("dash-routines-list");
    if (!list) return;
    const routines = Array.isArray(user?.routines) ? user.routines : [];
    if (!routines.length) {
      list.innerHTML = `
        <li class="wallet-tx-item">
          <b>Aún no tienes rutinas asignadas</b>
          <span>Tu coach te asignará una rutina personalizada pronto</span>
          <span class="wallet-amount">—</span>
        </li>`;
      return;
    }
    list.innerHTML = routines.map((r) => `
      <li class="wallet-tx-item">
        <b>${escapeHtml(r.name || "Rutina")}</b>
        <span>${escapeHtml(r.description || "")}</span>
        <span class="wallet-amount">${escapeHtml(r.level || "—")}</span>
      </li>`).join("");
  }

  // ---- Reservas ----
  function renderBookings(user) {
    const list = document.getElementById("dash-bookings-list");
    if (!list) return;
    const bookings = Array.isArray(user?.bookings) ? user.bookings : [];
    if (!bookings.length) {
      list.innerHTML = `
        <li class="wallet-tx-item">
          <b>No tienes clases reservadas</b>
          <span>Reserva una clase para verla aquí</span>
          <span class="wallet-amount">—</span>
        </li>`;
      return;
    }
    list.innerHTML = bookings.map((b) => {
      const date = b.date ? new Date(b.date).toLocaleString("es-ES") : "—";
      return `
        <li class="wallet-tx-item">
          <b>${escapeHtml(b.className || "Clase")}</b>
          <span>${escapeHtml(date)}</span>
          <span class="wallet-amount">${escapeHtml(b.status || "Reservada")}</span>
        </li>`;
    }).join("");
  }

  // ---- Pagos / Cartera ----
  function renderPayments(user) {
    const list = document.getElementById("dash-payments-list");
    const balEl = document.getElementById("dash-wallet-balance");

    const wallet = user?.wallet || { balance: 0, currency: "USD", transactions: [] };
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
    if (!wallet.transactions.some((transaction) => transaction.type === "TOPUP" && Number(transaction.amount) > 0) && Number(wallet.balance) !== 0) {
      wallet.balance = 0;
      walletChanged = true;
    }
    if (walletChanged) {
      const session = getSession();
      if (session?.user?.id === user.id) {
        session.user = user;
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      }
    }
    if (balEl) balEl.textContent = money(wallet.balance);

    if (!list) return;
    const tx = Array.isArray(wallet.transactions)
      ? wallet.transactions.slice(0, 3)
      : [];
    if (!tx.length) {
      list.innerHTML = `
        <li class="wallet-tx-item">
          <b>Sin movimientos</b>
          <span>Recarga tu cartera para empezar</span>
          <span class="wallet-amount">—</span>
        </li>`;
      return;
    }
    list.innerHTML = tx.map((t) => {
      const sign = t.amount >= 0 ? "+" : "−";
      const abs = Math.abs(Number(t.amount || 0));
      const label = t.type === "TOPUP" ? "Recarga" : t.type === "MEMBERSHIP" ? "Membresía" : (t.type || "Pago");
      const meta = t.meta?.planName ? ` · ${t.meta.planName}` : "";
      const date = t.createdAt ? new Date(t.createdAt).toLocaleString("es-ES") : "";
      return `
        <li class="wallet-tx-item">
          <b>${escapeHtml(label + meta)}</b>
          <span>${escapeHtml(date)}</span>
          <span class="wallet-amount">${sign}${money(abs)} ${escapeHtml(t.currency || "USD")}</span>
        </li>`;
    }).join("");
  }

  // ---- Saludo con hora ----
  function renderGreeting(user) {
    const el = document.getElementById("dash-greeting");
    if (!el) return;
    const hour = new Date().getHours();
    const greet = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";
    const name = escapeHtml(user?.name?.split(" ")[0] || "atleta");
    el.textContent = `${greet}, ${name} 👋`;
  }

  // ---- Init ----
  async function initDashboard() {
    const session = getSession();

    // El guardia de session-ui.js redirige si no hay sesión,
    // pero por seguridad también lo verificamos aquí
    if (!session?.user || !session?.token) {
      window.location.replace("login.html?redirect=dashboard.html");
      return;
    }

    let user = session.user;

    // Render inmediato con datos locales
    renderGreeting(user);
    renderMembership(user);
    renderRoutines(user);
    renderBookings(user);
    renderPayments(user);

    // Intentar sincronizar con servidor
    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 2500);
      const headers = { Authorization: `Bearer ${session.token}` };
      const responses = await Promise.all([
        fetch("/api/users/me", { headers, signal: controller.signal }),
        fetch("/api/wallet", { headers, signal: controller.signal }),
        fetch("/api/enrollments", { headers, signal: controller.signal }),
      ]);
      if (responses.some((response) => response.status === 401)) {
        localStorage.removeItem(SESSION_KEY);
        window.location.replace("login.html?redirect=dashboard.html");
        return;
      }
      const [profileResponse, walletResponse, enrollmentsResponse] = responses;
      const [profileData, walletData, enrollmentsData] = await Promise.all(
        responses.map((response) => response.ok ? response.json() : null)
      );
      if (profileData?.user) user = { ...user, ...profileData.user };
      if (walletData?.wallet) user.wallet = walletData.wallet;
      if (Array.isArray(enrollmentsData?.enrollments)) {
        user.enrollments = enrollmentsData.enrollments;
      }

      if (profileResponse.ok || walletResponse.ok || enrollmentsResponse.ok) {
        session.user = user;
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        renderGreeting(user);
        renderMembership(user);
        renderRoutines(user);
        renderBookings(user);
        renderPayments(user);
      }
    } catch {
      // Servidor offline — datos locales ya renderizados
    }
  }

  initDashboard();
})();
