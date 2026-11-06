const form = document.getElementById("verify-page-form");
const statusEl = document.getElementById("verify-status");
const resendButton = document.getElementById("resend-verification");

function showStatus(message, isError = false) {
  if (!statusEl) return;
  statusEl.hidden = false;
  statusEl.textContent = message;
  statusEl.classList.toggle("is-error", isError);
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const result = await response.json().catch(() => ({}));
  return { response, result };
}

if (form && statusEl && resendButton) {
  const emailInput = form.querySelector('input[name="email"]');
  const codeInput = form.querySelector('input[name="code"]');
  const emailFromUrl = new URLSearchParams(window.location.search).get("email");
  if (emailInput && emailFromUrl) emailInput.value = emailFromUrl.trim();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const email = String(emailInput.value || "").trim().toLowerCase();
    const code = String(codeInput.value || "").trim();
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    showStatus("Verificando el código...");

    try {
      const { response, result } = await postJson("/api/auth/verify", { email, code });
      if (!response.ok) {
        showStatus(result.message || "No se pudo verificar el código.", true);
        return;
      }

      showStatus(result.message || "¡Cuenta activada! Redirigiendo al inicio de sesión.");
      setTimeout(() => {
        window.location.replace(`login.html?email=${encodeURIComponent(email)}&registered=1`);
      }, 1200);
    } catch (error) {
      showStatus("No se pudo conectar con el servidor. Inténtalo de nuevo.", true);
    } finally {
      submitButton.disabled = false;
    }
  });

  resendButton.addEventListener("click", async () => {
    if (!emailInput.checkValidity()) {
      emailInput.reportValidity();
      return;
    }

    resendButton.disabled = true;
    showStatus("Solicitando un nuevo código...");
    try {
      const email = String(emailInput.value || "").trim().toLowerCase();
      const { response, result } = await postJson("/api/auth/resend-verification", { email });
      showStatus(result.message || "No se pudo reenviar el código.", !response.ok);
    } catch (error) {
      showStatus("No se pudo conectar con el servidor. Inténtalo de nuevo.", true);
    } finally {
      resendButton.disabled = false;
    }
  });
}
