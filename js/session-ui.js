/**
 * session-ui.js
 * Sistema completo de sesión y guardia de rutas para Stargym.
 */
(() => {
  const SESSION_KEY = "stargym_session";
  const INACTIVITY_LIMIT = 60 * 1000;
  const WARNING_LIMIT = 15 * 1000;

  // Páginas que requieren sesión activa
  const PRIVATE_PAGES = ["dashboard.html", "profile.html", "checkout.html"];

  /**
   * Obtiene la sesión actual desde localStorage.
   * @returns {Object|null}
   */
  function getSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      const session = raw ? JSON.parse(raw) : null;
      return session?.token && session?.user ? session : null;
    } catch {
      return null;
    }
  }

  /**
   * Revoca la sesión en el servidor cuando hay un JWT y limpia siempre el estado local.
   */
  async function logout() {
    const session = getSession();
    let serverLogoutFailed = false;

    if (session?.token && !session.token.startsWith("stargym-local-token-")) {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 2500);
      try {
        const response = await fetch("/api/auth/logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${session.token}` },
          signal: controller.signal,
        });
        serverLogoutFailed = !response.ok && response.status !== 401;
      } catch {
        serverLogoutFailed = true;
      } finally {
        window.clearTimeout(timeout);
      }
    }

    localStorage.removeItem(SESSION_KEY);
    window.location.replace(`index.html?logout=1${serverLogoutFailed ? "&serverLogout=failed" : ""}`);
  }

  let notificationPermissionRequested = false;
  let idleFallback;

  function requestIdleNotificationPermission() {
    if (notificationPermissionRequested || !getSession() || !("Notification" in window)) return;
    notificationPermissionRequested = true;
    if (Notification.permission !== "default") return;
    try {
      Notification.requestPermission().catch((error) => {
        console.warn("No se pudo solicitar permiso para las notificaciones:", error);
      });
    } catch (error) {
      console.warn("No se pudo solicitar permiso para las notificaciones:", error);
    }
  }

  function closeIdleFallback() {
    if (idleFallback) {
      idleFallback.remove();
      idleFallback = null;
    }
  }

  function showIdleNotification(resetTimers) {
    const message = "Has estado inactivo durante 1 minuto. Haz clic para mantener tu sesión abierta.";
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        const notification = new Notification("Stargym: sesión inactiva", {
          body: message,
          icon: "/assets/logo-stargym.png",
          tag: "stargym-session-idle"
        });
        notification.onclick = () => {
          window.focus();
          notification.close();
          resetTimers();
        };
        return;
      } catch {
        // Si el sistema operativo bloquea la notificación, se usa el aviso de la página.
      }
    }

    closeIdleFallback();
    idleFallback = document.createElement("div");
    idleFallback.className = "session-idle-notification";
    idleFallback.setAttribute("role", "status");
    idleFallback.setAttribute("aria-live", "polite");

    const text = document.createElement("span");
    text.textContent = message;
    const continueButton = document.createElement("button");
    continueButton.type = "button";
    continueButton.textContent = "Mantener sesión";
    continueButton.addEventListener("click", resetTimers);

    idleFallback.append(text, continueButton);
    document.body.append(idleFallback);
  }

  function initInactivitySession() {
    let warningTimeout;
    let logoutTimeout;
    let logoutStarted = false;

    const closeSession = () => {
      if (logoutStarted) return;
      logoutStarted = true;
      void logout();
    };

    const resetTimers = () => {
      if (logoutStarted) return;
      window.clearTimeout(warningTimeout);
      window.clearTimeout(logoutTimeout);
      logoutTimeout = null;
      closeIdleFallback();
      if (!getSession()) return;

      warningTimeout = window.setTimeout(() => {
        logoutTimeout = window.setTimeout(closeSession, WARNING_LIMIT);
        showIdleNotification(resetTimers);
      }, INACTIVITY_LIMIT);
    };

    document.addEventListener("click", requestIdleNotificationPermission, { once: true });
    document.addEventListener("keydown", requestIdleNotificationPermission, { once: true });

    ["mousedown", "mousemove", "keypress", "scroll", "touchstart"].forEach((event) => {
      document.addEventListener(event, resetTimers, { passive: true });
    });

    resetTimers();
  }

  /**
   * Devuelve el nombre del archivo de la página actual (ej: "dashboard.html").
   * @returns {string}
   */
  function getCurrentPage() {
    const parts = window.location.pathname.split("/");
    return parts[parts.length - 1] || "index.html";
  }

  /**
   * Renderiza los elementos de navegación según el estado de sesión.
   * Busca el elemento con id `nav-session-actions` y lo rellena.
   */
  function renderSessionActions() {
    const container = document.getElementById("nav-session-actions") ||
      document.getElementById("session-actions");
    if (!container) return;

    const session = getSession();

    if (session?.user?.name) {
      // Nav autenticado
      container.innerHTML = `
        <span class="nav-greeting">Hola, ${escapeHtml(session.user.name)}</span>
        <a href="dashboard.html" class="nav-link">Dashboard</a>
        <a href="profile.html" class="nav-link">Mi perfil</a>
        <button class="btn-logout" id="btn-logout">Cerrar sesión</button>
      `;
      const btnLogout = document.getElementById("btn-logout");
      if (btnLogout) {
        btnLogout.addEventListener("click", () => { void logout(); });
      }
    } else {
      // Nav público
      container.innerHTML = `
        <a href="login.html" class="btn btn-login">Iniciar sesión</a>
        <a href="register.html" class="btn btn-register">Registrarse</a>
      `;
    }
  }

  /**
   * Escapa caracteres HTML para evitar XSS.
   * @param {string} str
   * @returns {string}
   */
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /**
   * Guardia de rutas: redirige a login si la página es privada y no hay sesión.
   */
  function routeGuard() {
    const currentPage = getCurrentPage();
    const session = getSession();

    if (PRIVATE_PAGES.includes(currentPage) && !session) {
      window.location.href = `login.html?redirect=${encodeURIComponent(currentPage)}`;
      return;
    }
  }

  /**
   * Inicialización principal al cargar el DOM.
   */
  function init() {
    const currentPage = getCurrentPage();

    // Guardia de rutas
    routeGuard();

    // Mostrar el resultado del cierre de sesión en la página pública.
    if (currentPage === "index.html") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("logout") === "1") {
        const msgEl = document.getElementById("global-feedback");
        if (msgEl) {
          msgEl.textContent = params.get("serverLogout") === "failed"
            ? "Sesión cerrada en este dispositivo; no se pudo confirmar la revocación en el servidor."
            : "Has cerrado sesión correctamente.";
          msgEl.hidden = false;
        }
        const cleanUrl = window.location.pathname + window.location.hash;
        history.replaceState(null, "", cleanUrl);
      }
    }

    // Renderizar nav
    renderSessionActions();
    initInactivitySession();
  }

  // Exponer renderSessionActions para uso externo
  window.renderSessionActions = renderSessionActions;
  window.logoutUser = logout;

  // Arrancar cuando el DOM esté listo
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
