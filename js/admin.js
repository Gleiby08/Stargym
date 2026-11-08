(() => {
  const SESSION_KEY = "stargym_session";
  const PLAN_LABELS = {
    essential: "Starter",
    elite: "ELITE",
    pro: "CHAMPION"
  };
  const state = { users: [], selectedId: "" };
  const feedback = document.getElementById("admin-feedback");
  const userList = document.getElementById("admin-user-list");
  const searchInput = document.getElementById("admin-user-search");
  const detail = document.getElementById("admin-user-content");
  const emptyState = document.getElementById("admin-empty");

  function getSession() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    } catch {
      return null;
    }
  }

  function showFeedback(message, isError = false) {
    feedback.hidden = false;
    feedback.textContent = message;
    feedback.classList.toggle("is-error", isError);
  }

  function clearFeedback() {
    feedback.hidden = true;
    feedback.textContent = "";
    feedback.classList.remove("is-error");
  }

  function dateLabel(value) {
    if (!value) return "—";
    const assignedExpiry = typeof value === "string" && /^(\d{4}-\d{2}-\d{2})T23:59:59\.999Z$/.exec(value);
    const date = new Date(assignedExpiry ? `${assignedExpiry[1]}T12:00:00` : value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  }

  function dateTimeLabel(value) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("es-ES");
  }

  function money(value, currency = "USD") {
    return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(Number(value || 0));
  }

  function appendHistory(list, title, detailText, amount = "") {
    const item = document.createElement("li");
    item.className = "admin-history-item";
    const heading = document.createElement("strong");
    heading.textContent = title;
    const description = document.createElement("span");
    description.textContent = detailText;
    item.append(heading, description);
    if (amount) {
      const value = document.createElement("b");
      value.textContent = amount;
      item.append(value);
    }
    list.append(item);
  }

  async function api(path, options = {}) {
    const session = getSession();
    const response = await fetch(path, {
      ...options,
      headers: {
        Authorization: `Bearer ${session?.token || ""}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers
      }
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(result.message || "No se pudo completar la operación.");
      error.status = response.status;
      throw error;
    }
    return result;
  }

  function isMembershipActive(enrollment) {
    return enrollment.status === "ACTIVE" &&
      (!enrollment.currentPeriodEnd || new Date(enrollment.currentPeriodEnd).getTime() > Date.now());
  }

  function currentMembership(user) {
    return user.enrollments.find((enrollment) => enrollment.type === "PLAN" && isMembershipActive(enrollment));
  }

  function renderStats() {
    document.getElementById("admin-total-users").textContent = String(state.users.length);
    document.getElementById("admin-active-memberships").textContent =
      String(state.users.filter((user) => user.enrollments.some((enrollment) => isMembershipActive(enrollment))).length);
  }

  function renderUsers() {
    const query = searchInput.value.trim().toLocaleLowerCase();
    const users = state.users.filter((user) =>
      `${user.name} ${user.email}`.toLocaleLowerCase().includes(query)
    );
    userList.replaceChildren();
    document.getElementById("admin-user-count").textContent =
      `${users.length} ${users.length === 1 ? "usuario" : "usuarios"}`;

    users.forEach((user) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "admin-user-button";
      button.classList.toggle("is-selected", user.id === state.selectedId);
      const name = document.createElement("strong");
      name.textContent = user.name || "Sin nombre";
      const email = document.createElement("span");
      email.textContent = user.email;
      const membership = currentMembership(user);
      const status = document.createElement("small");
      status.textContent = membership ? (membership.planName || PLAN_LABELS[membership.planId] || "Activa") : "Sin membresía activa";
      button.append(name, email, status);
      button.addEventListener("click", () => selectUser(user.id));
      item.append(button);
      userList.append(item);
    });
  }

  function renderUser(user) {
    if (!user) {
      detail.hidden = false;
      document.getElementById("admin-user-content").hidden = true;
      emptyState.hidden = false;
      return;
    }
    detail.hidden = false;
    emptyState.hidden = true;
    document.getElementById("admin-user-content").hidden = false;
    document.getElementById("admin-selected-name").textContent = user.name || "Sin nombre";
    document.getElementById("admin-selected-email").textContent = user.email;

    const profileForm = document.getElementById("admin-profile-form");
    profileForm.elements.name.value = user.name || "";
    profileForm.elements.phoneNumber.value = user.phoneNumber || "";
    profileForm.elements.dateOfBirth.value = user.dateOfBirth || "";
    profileForm.elements.gender.value = user.gender || "";
    document.getElementById("admin-account-dates").textContent =
      `Cuenta creada: ${dateLabel(user.createdAt)} · Último acceso: ${dateTimeLabel(user.lastLoginAt)}`;

    const active = currentMembership(user);
    const membershipStatus = document.getElementById("admin-membership-status");
    membershipStatus.textContent = active ? "ACTIVA" : "INACTIVA";
    membershipStatus.classList.toggle("is-success", Boolean(active));
    membershipStatus.classList.toggle("is-warning", !active);
    document.getElementById("admin-membership-summary").textContent = active
      ? `${active.planName || PLAN_LABELS[active.planId] || active.planId} · vence ${dateLabel(active.currentPeriodEnd)}`
      : "No tiene una membresía activa.";
    const cancelButton = document.getElementById("admin-cancel-membership");
    const renewButton = document.getElementById("admin-renew-membership");
    cancelButton.disabled = !active;
    renewButton.disabled = !active;
    const expiryInput = document.querySelector("#admin-membership-form [name=expiresAt]");
    const nextMonth = new Date();
    const preferredDay = nextMonth.getDate();
    nextMonth.setDate(1);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(Math.min(preferredDay, new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate()));
    expiryInput.value = nextMonth.toISOString().slice(0, 10);

    const membershipHistory = document.getElementById("admin-membership-history");
    membershipHistory.replaceChildren();
    user.enrollments.forEach((enrollment) => {
      appendHistory(
        membershipHistory,
        `${enrollment.planName || PLAN_LABELS[enrollment.planId] || enrollment.planId || "Membresía"} · ${enrollment.status || "—"}`,
        `${dateLabel(enrollment.startedAt)} – ${dateLabel(enrollment.currentPeriodEnd)} · ${enrollment.source || "—"}`
      );
    });
    if (!user.enrollments.length) appendHistory(membershipHistory, "Sin historial de membresías", "");

    const balance = user.wallet?.balance || 0;
    document.getElementById("admin-wallet-balance").textContent = money(balance, user.wallet?.currency || "USD");
    const walletHistory = document.getElementById("admin-wallet-history");
    walletHistory.replaceChildren();
    (user.wallet?.transactions || []).slice(0, 30).forEach((transaction) => {
      const reason = transaction.meta?.reason ? ` · ${transaction.meta.reason}` : "";
      const label = transaction.type === "ADMIN_ADJUSTMENT"
        ? `Ajuste administrativo${reason}`
        : transaction.meta?.planName || transaction.type || "Movimiento";
      appendHistory(
        walletHistory,
        label,
        dateTimeLabel(transaction.createdAt),
        money(transaction.amount, transaction.currency || "USD")
      );
    });
    if (!user.wallet?.transactions?.length) appendHistory(walletHistory, "Sin movimientos", "");

    const paymentHistory = document.getElementById("admin-payment-history");
    paymentHistory.replaceChildren();
    (user.paymentOrders || []).slice().reverse().forEach((payment) => {
      appendHistory(
        paymentHistory,
        `${payment.provider || "Pago"} · ${payment.kind || "—"} · ${payment.status || "—"}`,
        `${dateTimeLabel(payment.createdAt)}${payment.planId ? ` · ${PLAN_LABELS[payment.planId] || payment.planId}` : ""}`,
        money(payment.amount, payment.currency || "USD")
      );
    });
    if (!user.paymentOrders?.length) appendHistory(paymentHistory, "Sin pagos externos registrados", "");
  }

  function selectUser(id) {
    state.selectedId = id;
    renderUsers();
    renderUser(state.users.find((user) => user.id === id));
    clearFeedback();
  }

  function updateUser(updatedUser) {
    const index = state.users.findIndex((user) => user.id === updatedUser.id);
    if (index >= 0) state.users[index] = updatedUser;
    renderStats();
    renderUsers();
    renderUser(updatedUser);
  }

  async function refreshUsers(selectId = state.selectedId) {
    const result = await api("/api/admin/users");
    state.users = Array.isArray(result.users) ? result.users : [];
    renderStats();
    renderUsers();
    const selected = state.users.find((user) => user.id === selectId) || state.users[0];
    if (selected) selectUser(selected.id);
    else renderUser(null);
  }

  document.getElementById("admin-profile-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const user = state.users.find((item) => item.id === state.selectedId);
    if (!user) return;
    const form = event.currentTarget;
    try {
      const result = await api(`/api/admin/users/${encodeURIComponent(user.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: form.elements.name.value,
          phoneNumber: form.elements.phoneNumber.value,
          dateOfBirth: form.elements.dateOfBirth.value || null,
          gender: form.elements.gender.value
        })
      });
      updateUser(result.user);
      showFeedback(result.message);
    } catch (error) {
      showFeedback(error.message, true);
    }
  });

  document.getElementById("admin-membership-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const user = state.users.find((item) => item.id === state.selectedId);
    if (!user) return;
    const form = event.currentTarget;
    try {
      const result = await api(`/api/admin/users/${encodeURIComponent(user.id)}/membership`, {
        method: "PATCH",
        body: JSON.stringify({
          action: "assign",
          planId: form.elements.planId.value,
          expiresAt: form.elements.expiresAt.value
        })
      });
      updateUser(result.user);
      showFeedback(result.message);
    } catch (error) {
      showFeedback(error.message, true);
    }
  });

  async function changeMembership(action) {
    const user = state.users.find((item) => item.id === state.selectedId);
    if (!user) return;
    try {
      const result = await api(`/api/admin/users/${encodeURIComponent(user.id)}/membership`, {
        method: "PATCH",
        body: JSON.stringify({ action })
      });
      updateUser(result.user);
      showFeedback(result.message);
    } catch (error) {
      showFeedback(error.message, true);
    }
  }

  document.getElementById("admin-renew-membership").addEventListener("click", () => {
    void changeMembership("renew");
  });
  document.getElementById("admin-cancel-membership").addEventListener("click", () => {
    if (window.confirm("¿Cancelar la membresía activa de este usuario?")) void changeMembership("cancel");
  });

  document.getElementById("admin-wallet-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const user = state.users.find((item) => item.id === state.selectedId);
    if (!user) return;
    const form = event.currentTarget;
    try {
      const result = await api(`/api/admin/users/${encodeURIComponent(user.id)}/wallet-adjustments`, {
        method: "POST",
        body: JSON.stringify({
          amount: Number(form.elements.amount.value),
          reason: form.elements.reason.value
        })
      });
      form.reset();
      updateUser(result.user);
      showFeedback(result.message);
    } catch (error) {
      showFeedback(error.message, true);
    }
  });

  document.getElementById("admin-delete-user").addEventListener("click", async () => {
    const user = state.users.find((item) => item.id === state.selectedId);
    if (!user) return;
    const confirmation = window.prompt(`Esta acción es irreversible. Escribe el correo exacto para eliminar la cuenta:\n${user.email}`);
    if (confirmation === null) return;
    try {
      const result = await api(`/api/admin/users/${encodeURIComponent(user.id)}`, {
        method: "DELETE",
        body: JSON.stringify({ confirmEmail: confirmation })
      });
      state.users = state.users.filter((item) => item.id !== user.id);
      state.selectedId = state.users[0]?.id || "";
      renderStats();
      renderUsers();
      renderUser(state.users[0] || null);
      showFeedback(result.message);
    } catch (error) {
      showFeedback(error.message, true);
    }
  });

  searchInput.addEventListener("input", renderUsers);

  const session = getSession();
  if (!session?.token) {
    window.location.replace("login.html?redirect=admin.html");
    return;
  }

  refreshUsers().catch((error) => {
    if (error.status === 401) {
      localStorage.removeItem(SESSION_KEY);
      window.location.replace("login.html?redirect=admin.html");
      return;
    }
    showFeedback(
      error.status === 403
        ? "Esta cuenta no tiene permisos de administración. Configura ADMIN_EMAIL con el correo administrador."
        : error.message,
      true
    );
  });
})();
