(() => {
  const SESSION_KEY = "stargym_session";

  const labels = {
    essential: { 
      name: "Starter", 
      price: 39,
      benefits: ["Acceso a zona de pesas", "Zona cardio ilimitada", "Vestuarios premium", "App STAR GYM"]
    },
    elite: { 
      name: "ELITE", 
      price: 79,
      benefits: ["Todo en Starter", "Clases grupales ilimitadas", "2 sesiones con entrenador", "Acceso zona SPA", "Nutrición básica incluida", "Prioridad en reservas"]
    },
    pro: { 
      name: "CHAMPION", 
      price: 149,
      benefits: ["Todo en Elite", "Coaching privado semanal", "Plan nutricional completo", "Acceso 24/7 VIP", "Análisis corporal mensual", "Locker personal", "Servicio de toalla"]
    }
  };

  const benefitIcons = {
    "pesas": '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6.5 6.5 11 11"/><path d="m21 21-4.5-4.5"/><path d="m3 3 4.5 4.5"/><path d="m18 22 4-4"/><path d="m2 6 4-4"/><path d="m3 10 7-7"/><path d="m14 21 7-7"/></svg>',
    "cardio": '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
    "vestuarios": '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.62 1.96v14.16a2 2 0 0 0 1.62 1.96L8 23a4 4 0 0 0 8 0l4.38-1.46a2 2 0 0 0 1.62-1.96V5.42a2 2 0 0 0-1.62-1.96Z"/><path d="M12 2v21"/></svg>',
    "app": '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>',
    "clases": '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    "entrenador": '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    "spa": '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/></svg>',
    "nutrición": '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20.94c1.88-1.1 3.24-2.49 4.07-4.14 1.14-2.28.93-4.63-.57-6.3-1.5-1.67-3.5-1.67-5 0-1.5-1.67-3.5-1.67-5 0-1.5 1.67-1.71 4.02-.57 6.3.83 1.65 2.19 3.04 4.07 4.14Z"/><path d="M12 5.51c0-1.39-1.21-2.51-2.7-2.51H8.7"/><path d="M12 8.51c0-1.39 1.21-2.51 2.7-2.51h.6"/></svg>',
    "reservas": '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>',
    "vip": '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/></svg>',
    "análisis": '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>',
    "locker": '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    "toalla": '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 11h20"/><path d="M2 15h20"/><path d="M2 19h20"/><path d="M12 2v9"/></svg>',
    "default": '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
  };

  const getIconForBenefit = (text) => {
    const lower = text.toLowerCase();
    if (lower.includes("pesas")) return benefitIcons.pesas;
    if (lower.includes("cardio")) return benefitIcons.cardio;
    if (lower.includes("vestuarios")) return benefitIcons.vestuarios;
    if (lower.includes("app")) return benefitIcons.app;
    if (lower.includes("clases")) return benefitIcons.clases;
    if (lower.includes("entrenador") || lower.includes("coaching")) return benefitIcons.entrenador;
    if (lower.includes("spa")) return benefitIcons.spa;
    if (lower.includes("nutrición")) return benefitIcons.nutrición;
    if (lower.includes("reservas")) return benefitIcons.reservas;
    if (lower.includes("vip") || lower.includes("24/7")) return benefitIcons.vip;
    if (lower.includes("análisis")) return benefitIcons.análisis;
    if (lower.includes("locker")) return benefitIcons.locker;
    if (lower.includes("toalla")) return benefitIcons.toalla;
    return benefitIcons.default;
  };

  const setFeedback = (msg, isError = false) => {
    const el = document.getElementById("checkout-feedback");
    if (!el) return;
    el.hidden = false;
    el.textContent = msg;
    el.classList.toggle("is-error", isError);
  };

  async function initCheckout() {
    const urlParams = new URLSearchParams(window.location.search);
    const planId = urlParams.get("plan");
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");

    if (!session?.token) {
      window.location.replace("login.html");
      return;
    }

    if (!planId || !labels[planId]) {
      window.location.replace("index.html#planes");
      return;
    }

    const plan = labels[planId];
    document.getElementById("checkout-plan-name").textContent = plan.name;
    document.getElementById("checkout-plan-price").textContent = `$${plan.price}.00 USD`;

    // Mostrar lista de beneficios
    const benefitsList = document.getElementById("checkout-plan-benefits");
    if (benefitsList) {
      benefitsList.innerHTML = plan.benefits
        .map(b => `<li style="display: flex; align-items: center; gap: 0.75rem;"><span style="color: var(--primary-lime); display: flex; align-items: center; opacity: 0.9;">${getIconForBenefit(b)}</span> ${b}</li>`)
        .join("");
    }

    // Cargar saldo del usuario
    let currentBalance = Number(session.user?.wallet?.balance || 0);
    try {
      const res = await fetch("/api/wallet", {
        headers: { Authorization: `Bearer ${session.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        currentBalance = Number(data.wallet?.balance ?? currentBalance);
      }
    } catch (e) {
      setFeedback("No se pudo consultar la cartera. Comprueba tu conexión e inténtalo de nuevo.", true);
      return;
    }

    document.getElementById("user-balance").textContent = `${currentBalance} USD`;
    if (currentBalance < plan.price) {
      const walletBtn = document.getElementById("pay-wallet-btn");
      if (walletBtn) {
        walletBtn.disabled = true;
        walletBtn.style.opacity = "0.5";
        walletBtn.title = "Saldo insuficiente en tu cartera. Recarga para continuar.";
      }
    }

    document.getElementById("pay-wallet-btn")?.addEventListener("click", async () => {
      setFeedback("Procesando pago con cartera...");
      try {
        await apiPost("/api/enrollments/plan", { planId });
        setFeedback("¡Inscripción completada con éxito!");
        window.setTimeout(() => window.location.replace("profile.html"), 1000);
      } catch (error) {
        setFeedback(error.message || "Error al procesar el pago.", true);
      }
    });

    document.getElementById("pay-paypal-btn")?.addEventListener("click", (event) => {
      void startProviderPayment("paypal", planId, event.currentTarget);
    });
    document.getElementById("pay-binance-btn")?.addEventListener("click", (event) => {
      void startProviderPayment("binance", planId, event.currentTarget);
    });
  }

  async function startProviderPayment(provider, planId, button) {
    if (button.disabled) return;
    button.disabled = true;
    setFeedback(`Conectando con ${provider === "paypal" ? "PayPal" : "Binance Pay"}...`);
    try {
      const result = await apiPost("/api/billing/checkout", {
        provider,
        kind: "membership",
        planId
      });
      if (!result.url) throw new Error("El proveedor no devolvió el enlace de pago.");
      window.location.assign(result.url);
    } catch (error) {
      setFeedback(error.message || "No se pudo iniciar el pago.", true);
    } finally {
      button.disabled = false;
    }
  }

  async function apiPost(path, body) {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    const response = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.token || ""}`
      },
      body: JSON.stringify(body || {})
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "Error de servidor.");
    return result;
  }

  async function disableUnconfiguredProviders() {
    try {
      const response = await fetch("/api/billing/public-config");
      if (!response.ok) throw new Error("No se pudo consultar la configuración de pagos.");
      const config = await response.json();
      const paypalButton = document.getElementById("pay-paypal-btn");
      const binanceButton = document.getElementById("pay-binance-btn");
      if (paypalButton) {
        paypalButton.disabled = !config.paypal;
        if (!config.paypal) paypalButton.title = "Configura PAYPAL_CLIENT_ID y PAYPAL_CLIENT_SECRET en .env.";
      }
      if (binanceButton) {
        binanceButton.disabled = !config.binance;
        if (!config.binance) binanceButton.title = "Configura las credenciales de Binance Pay en .env.";
      }
    } catch (error) {
      const paypalButton = document.getElementById("pay-paypal-btn");
      const binanceButton = document.getElementById("pay-binance-btn");
      if (paypalButton) paypalButton.disabled = true;
      if (binanceButton) binanceButton.disabled = true;
    }
  }

  void disableUnconfiguredProviders();
  initCheckout();
})();
