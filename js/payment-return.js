const SESSION_KEY = "stargym_session";
const statusElement = document.getElementById("payment-status");
const retryButton = document.getElementById("retry-payment-check");
const params = new URLSearchParams(window.location.search);
const paymentId = params.get("paymentId") || "";

function showStatus(message, isError = false) {
  statusElement.textContent = message;
  statusElement.classList.toggle("is-error", isError);
}

async function postPaymentAction(path) {
  const session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  if (!session?.token) {
    throw new Error("Inicia sesión con la cuenta que comenzó el pago y vuelve a esta página.");
  }
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.token}`
    },
    body: JSON.stringify({ paymentId })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok && response.status !== 202) {
    throw new Error(result.message || "No se pudo consultar el pago.");
  }
  return { response, result };
}

async function confirmPayment(attempt = 0) {
  if (!paymentId) {
    showStatus("Falta el identificador de pago. Si ya pagaste, contacta con Stargym.", true);
    return;
  }

  if (params.get("cancelled") === "1") {
    try {
      await postPaymentAction("/api/billing/cancel");
    } catch (error) {
      showStatus(error.message, true);
      return;
    }
    showStatus("El pago fue cancelado. No se activó la membresía ni se acreditó saldo.", true);
    return;
  }

  try {
    const { response, result } = await postPaymentAction("/api/billing/confirm");
    if (response.status === 202 && attempt < 20) {
      showStatus("El proveedor aún está confirmando el pago. Esperando unos segundos...");
      window.setTimeout(() => void confirmPayment(attempt + 1), 3000);
      return;
    }
    if (response.status === 202) {
      showStatus("El pago sigue pendiente. Puedes volver a verificarlo en unos segundos.", true);
      retryButton.hidden = false;
      return;
    }

    showStatus(result.message || "Pago confirmado. Redirigiendo a tu perfil.");
    window.setTimeout(() => {
      window.location.replace(`profile.html?payment=success&kind=${encodeURIComponent(result.kind || "")}`);
    }, 1400);
  } catch (error) {
    showStatus(error.message || "No se pudo confirmar el pago.", true);
    retryButton.hidden = false;
  }
}

retryButton?.addEventListener("click", () => {
  retryButton.disabled = true;
  void confirmPayment().finally(() => {
    retryButton.disabled = false;
  });
});

void confirmPayment();
