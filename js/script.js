function initSmoothScroll() {
  document.querySelectorAll("[data-scroll]").forEach((button) => {
    button.addEventListener("click", () => {
      const targetId = button.getAttribute("data-scroll");
      const target = document.querySelector(targetId);

      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });
}

function initReveal() {
  const prefersReduced =
    typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (prefersReduced) {
    document.querySelectorAll(".reveal").forEach((el) => el.classList.add("is-visible"));
    return;
  }

  const elements = document.querySelectorAll(".reveal");
  if (!elements.length || typeof IntersectionObserver === "undefined") {
    elements.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { root: null, rootMargin: "0px 0px -6% 0px", threshold: 0.06 }
  );

  elements.forEach((el) => observer.observe(el));
}

function initScrollEffects() {
  const prefersReduced =
    typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const root = document.documentElement;
  const header = document.querySelector("header");
  const sections = Array.from(document.querySelectorAll(".scroll-section"));
  const navLinks = Array.from(document.querySelectorAll('.nav a[href^="#"]'));
  const navMap = new Map(
    navLinks
      .map((link) => {
        const targetId = link.getAttribute("href")?.slice(1);
        return targetId ? [targetId, link] : null;
      })
      .filter(Boolean)
  );

  let ticking = false;
  let activeSectionId = "";
  let lastScrollY = window.scrollY || window.pageYOffset || 0;

  const updateOnScroll = () => {
    ticking = false;

    const scrollY = window.scrollY || window.pageYOffset || 0;
    const maxScroll = Math.max(document.body.scrollHeight - window.innerHeight, 1);
    const progressRatio = Math.min(scrollY / maxScroll, 1);
    root.style.setProperty("--scroll-progress-ratio", progressRatio.toFixed(4));

    if (header) {
      header.classList.toggle("is-scrolled", scrollY > 18);
    }

    const delta = scrollY - lastScrollY;
    if (Math.abs(delta) > 2) {
      const isDown = delta > 0;
      document.body.classList.toggle("is-scrolling-down", isDown);
      document.body.classList.toggle("is-scrolling-up", !isDown);
    }
    lastScrollY = scrollY;

    if (typeof IntersectionObserver === "undefined" && sections.length) {
      let bestSection = "";
      let bestVisibility = 0;
      const viewportHeight = window.innerHeight || 1;
      sections.forEach((section) => {
        const rect = section.getBoundingClientRect();
        const visibleHeight = Math.max(0, Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0));
        const visibility = Math.min(visibleHeight / Math.max(Math.min(rect.height, viewportHeight), 1), 1);
        if (visibility > bestVisibility) {
          bestVisibility = visibility;
          bestSection = section.id;
        }
      });
      if (bestSection && bestSection !== activeSectionId) {
        activeSectionId = bestSection;
        navLinks.forEach((link) => link.classList.remove("active-link"));
        navMap.get(bestSection)?.classList.add("active-link");
      }
    }
  };

  const requestTick = () => {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(updateOnScroll);
    }
  };

  updateOnScroll();
  window.addEventListener("scroll", requestTick, { passive: true });
  window.addEventListener("resize", requestTick);

  if (sections.length && typeof IntersectionObserver !== "undefined") {
    const visibleSections = new Map();
    const sectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          entry.target.classList.toggle("is-active-section", entry.isIntersecting);
          if (entry.isIntersecting) {
            visibleSections.set(entry.target, entry.intersectionRatio);
          } else {
            visibleSections.delete(entry.target);
          }
        });
        const activeSection = Array.from(visibleSections.entries()).reduce(
          (best, [section, ratio]) => (ratio > best.ratio ? { section, ratio } : best),
          { section: null, ratio: 0 }
        ).section;
        if (activeSection?.id) {
          navLinks.forEach((link) => link.classList.remove("active-link"));
          navMap.get(activeSection.id)?.classList.add("active-link");
        }
      },
      { root: null, rootMargin: "-15% 0px -15% 0px", threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] }
    );
    sections.forEach((section) => sectionObserver.observe(section));
  } else if (prefersReduced || typeof IntersectionObserver === "undefined") {
    sections.forEach((section) => section.classList.add("is-active-section"));
  }
}

function initQrAccess() {
  const openBtn = document.getElementById("qr-open");
  const modal = document.getElementById("qr-modal");
  const closeBtn = document.getElementById("qr-close");
  const closeBackdrop = document.getElementById("qr-close-backdrop");
  const qrImage = document.getElementById("qr-image");
  const urlText = document.getElementById("qr-url-text");

  if (!openBtn || !modal || !qrImage) return;

  const closeModal = () => {
    modal.hidden = true;
    document.body.style.overflow = "";
  };

  const openModal = () => {
    const pageUrl = window.location.href;
    const encodedUrl = encodeURIComponent(pageUrl);
    
    // Generar el QR solo si no se ha cargado ya
    qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=420x420&bgcolor=ffffff&color=000000&data=${encodedUrl}`;
    if (urlText) {
      urlText.textContent = pageUrl;
    }

    modal.hidden = false;
    document.body.style.overflow = "hidden";
  };

  openBtn.addEventListener("click", openModal);
  closeBtn?.addEventListener("click", closeModal);
  closeBackdrop?.addEventListener("click", closeModal);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) {
      closeModal();
    }
  });
}

/**
 * Reemplazo personalizado para window.confirm
 * @param {string} message - El mensaje a mostrar
 * @returns {Promise<boolean>}
 */
window.showStargymConfirm = function(message) {
  const modal = document.getElementById("confirm-modal");
  const msgEl = document.getElementById("confirm-modal-message");
  const btnOk = document.getElementById("confirm-modal-ok");
  const btnCancel = document.getElementById("confirm-modal-cancel");
  const backdrop = document.getElementById("confirm-modal-backdrop");

  if (!modal || !msgEl) return Promise.resolve(window.confirm(message));

  return new Promise((resolve) => {
    msgEl.textContent = message;
    modal.hidden = false;
    document.body.style.overflow = "hidden";

    const cleanup = (result) => {
      modal.hidden = true;
      document.body.style.overflow = "";
      btnOk.removeEventListener("click", onOk);
      btnCancel.removeEventListener("click", onCancel);
      backdrop.removeEventListener("click", onCancel);
      resolve(result);
    };

    const onOk = () => cleanup(true);
    const onCancel = () => cleanup(false);

    btnOk.addEventListener("click", onOk);
    btnCancel.addEventListener("click", onCancel);
    backdrop.addEventListener("click", onCancel);
  });
};

/**
 * Navegación con transición suave (Fade Out)
 * @param {string} url - El destino.
 * @param {boolean} useReplace - Si debe usar location.replace en lugar de href.
 */
window.smoothNavigate = function(url, useReplace = false) {
  document.body.classList.add("is-navigating");
  
  // El tiempo (300ms) debe coincidir con la duración de la transición en tu CSS
  window.setTimeout(() => {
    if (useReplace) {
      window.location.replace(url);
    } else {
      window.location.href = url;
    }
  }, 300);
};

function initPlanEnrollment() {
  const buttons = Array.from(document.querySelectorAll("[data-enroll-plan]"));
  const feedback = document.getElementById("global-feedback");
  if (!buttons.length) return;

  const SESSION_KEY = "stargym_session";
  const labels = {
    essential: "Starter",
    pro: "CHAMPION",
    elite: "ELITE"
  };

  const showFeedback = (message, isError = false) => {
    if (!feedback) return;
    feedback.hidden = false;
    feedback.textContent = message;
    feedback.classList.toggle("is-error", isError);
    window.setTimeout(() => {
      feedback.hidden = true;
      feedback.textContent = "";
      feedback.classList.remove("is-error");
    }, 3500);
  };

  const handleEnrollClick = async (button) => {
    const planId = button.getAttribute("data-enroll-plan");
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");

    if (!session?.token) {
      showFeedback("Debes iniciar sesión para inscribirte en un plan.", true);
      window.setTimeout(() => {
        window.location.replace("login.html");
      }, 700);
      return;
    }

    window.location.href = `checkout.html?plan=${planId}`;
  };

  // Delegación global robusta: funciona aunque cambie el DOM.
  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest("[data-enroll-plan]") : null;
    if (!target) return;
    if (!(target instanceof HTMLButtonElement)) return;
    if (target.disabled) return;
    handleEnrollClick(target);
  });
}

function initBackToTop() {
  const btn = document.createElement("button");
  btn.className = "back-to-top";
  btn.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <path d="m18 15-6-6-6 6"/>
    </svg>
  `;
  btn.setAttribute("aria-label", "Volver arriba");
  document.body.appendChild(btn);

  let ticking = false;
  window.addEventListener("scroll", () => {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(() => {
        btn.classList.toggle("is-visible", window.scrollY > 600);
        ticking = false;
      });
    }
  }, { passive: true });

  btn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

function initMobileMenu() {
  const nav = document.querySelector(".nav");
  const menu = nav?.querySelector("ul");
  if (!nav || !menu) return;
  nav.classList.add("nav--has-menu");

  // Crear el botón de hamburguesa
  const btn = document.createElement("button");
  btn.className = "hamburger";
  btn.setAttribute("aria-label", "Abrir menú");
  btn.setAttribute("aria-expanded", "false");
  btn.setAttribute("aria-controls", "main-navigation");
  menu.id = menu.id || "main-navigation";
  btn.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="4" x2="20" y1="12" y2="12" class="line-mid"/>
      <line x1="4" x2="20" y1="6" y2="6" class="line-top"/>
      <line x1="4" x2="20" y1="18" y2="18" class="line-bottom"/>
    </svg>
  `;

  nav.appendChild(btn);

  const toggleMenu = () => {
    nav.classList.toggle("is-open");
    const isOpen = nav.classList.contains("is-open");
    btn.setAttribute("aria-expanded", isOpen);
    btn.setAttribute("aria-label", isOpen ? "Cerrar menú" : "Abrir menú");
    document.body.style.overflow = isOpen ? "hidden" : "";
  };

  btn.addEventListener("click", toggleMenu);

  // Cerrar el menú al hacer clic en cualquier enlace
  nav.querySelectorAll("a, .btn-logout").forEach(link => {
    link.addEventListener("click", () => {
      if (nav.classList.contains("is-open")) toggleMenu();
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && nav.classList.contains("is-open")) toggleMenu();
  });
}

initSmoothScroll();
initReveal();
initScrollEffects();
initQrAccess();
initPlanEnrollment();
initBackToTop();
initMobileMenu();
