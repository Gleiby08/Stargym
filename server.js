const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
const { MongoClient } = require("mongodb");

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const APP_BASE_URL = String(process.env.APP_BASE_URL || `http://localhost:${PORT}`).replace(/\/+$/, "");
const JWT_SECRET = String(process.env.JWT_SECRET || "").trim();
if (JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET debe configurarse con al menos 32 caracteres aleatorios.");
}
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();

const USERS_FILE_PATH = path.join(__dirname, "data", "users.json");
const MONGODB_URI = String(process.env.MONGODB_URI || "").trim();
const MONGODB_DB_NAME = String(process.env.MONGODB_DB_NAME || "Stargym").trim();
const MONGODB_USERS_COLLECTION = String(process.env.MONGODB_USERS_COLLECTION || "users").trim();
const mongoUriMeta = (() => {
  try {
    const u = new URL(MONGODB_URI);
    return { host: u.host, username: u.username || "(empty)", hasPassword: Boolean(u.password), pathDb: u.pathname || "/" };
  } catch {
    return { host: "(local-file-mode)", username: "(none)", hasPassword: false, pathDb: "(none)" };
  }
})();

const mongoClient = MONGODB_URI ? new MongoClient(MONGODB_URI) : null;
let mongoCollectionPromise = null;
if (!MONGODB_URI) {
  console.log("ℹ️ MONGODB_URI no está configurado. Operando con almacenamiento local en data/users.json");
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.use(express.json({
  verify(req, res, buffer) {
    req.rawBody = buffer.toString("utf8");
  }
}));
app.use("/server.js", (req, res) => res.sendStatus(404));
app.use("/data", (req, res) => res.sendStatus(404));

app.use(express.static(__dirname));
app.get("/mi-perfil", (req, res) => res.redirect(302, "/profile.html"));
app.get("/rutinas", (req, res) => res.redirect(302, "/dashboard.html#rutinas"));

function userRowToAppUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.passwordHash,
    emailVerified: Boolean(row.emailVerified),
    verificationTokenHash: row.verificationTokenHash,
    verificationExpiresAt: row.verificationExpiresAt ? new Date(row.verificationExpiresAt).getTime() : null,
    verificationAttempts: Number(row.verificationAttempts || 0),
    verificationSentAt: row.verificationSentAt ? new Date(row.verificationSentAt).getTime() : null,
    wallet: row.wallet || { balance: 0, currency: "USD", transactions: [], topupIntents: [] },
    enrollments: Array.isArray(row.enrollments) ? row.enrollments : [],
    revokedTokens: Array.isArray(row.revokedTokens) ? row.revokedTokens : [],
    paymentOrders: Array.isArray(row.paymentOrders) ? row.paymentOrders : [],
    dateOfBirth: row.dateOfBirth || null, // New field
    phoneNumber: row.phoneNumber || null, // New field
    gender: row.gender || null,
    lastLoginAt: row.lastLoginAt ? new Date(row.lastLoginAt).toISOString() : null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString()
  };
}

function appUserToUserRow(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    passwordHash: user.passwordHash,
    emailVerified: Boolean(user.emailVerified),
    verificationTokenHash: user.verificationTokenHash || null,
    verificationExpiresAt: user.verificationExpiresAt ? new Date(user.verificationExpiresAt).toISOString() : null,
    verificationAttempts: Number(user.verificationAttempts || 0),
    verificationSentAt: user.verificationSentAt ? new Date(user.verificationSentAt).toISOString() : null,
    wallet: user.wallet || { balance: 0, currency: "USD", transactions: [], topupIntents: [] },
    enrollments: Array.isArray(user.enrollments) ? user.enrollments : [],
    revokedTokens: Array.isArray(user.revokedTokens) ? user.revokedTokens : [],
    paymentOrders: Array.isArray(user.paymentOrders) ? user.paymentOrders : [],
    dateOfBirth: user.dateOfBirth || null, // New field
    phoneNumber: user.phoneNumber || null, // New field
    gender: user.gender || null,
    lastLoginAt: user.lastLoginAt || null,
    createdAt: user.createdAt || new Date().toISOString(),
    updatedAt: user.updatedAt || new Date().toISOString()
  };
}

async function getUsersCollection() {
  if (!mongoCollectionPromise) {
    // #region agent log
    fetch("http://127.0.0.1:7348/ingest/11f7fafc-04b0-449f-84d7-872386fdd5f5", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "f7f4b8" },
      body: JSON.stringify({
        sessionId: "f7f4b8",
        runId: "pre-fix",
        hypothesisId: "H1",
        location: "server.js:getUsersCollection:init",
        message: "Creating Mongo collection promise",
        data: { host: mongoUriMeta.host, username: mongoUriMeta.username, hasPassword: mongoUriMeta.hasPassword, envDb: MONGODB_DB_NAME },
        timestamp: Date.now()
      })
    }).catch(() => {});
    // #endregion
    mongoCollectionPromise = mongoClient
      .connect()
      .then(async (client) => {
        // #region agent log
        fetch("http://127.0.0.1:7348/ingest/11f7fafc-04b0-449f-84d7-872386fdd5f5", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "f7f4b8" },
          body: JSON.stringify({
            sessionId: "f7f4b8",
            runId: "pre-fix",
            hypothesisId: "H1",
            location: "server.js:getUsersCollection:connected",
            message: "Mongo connect succeeded on server",
            data: { envDb: MONGODB_DB_NAME, collection: MONGODB_USERS_COLLECTION },
            timestamp: Date.now()
          })
        }).catch(() => {});
        // #endregion
        const db = client.db(MONGODB_DB_NAME);
        const collection = db.collection(MONGODB_USERS_COLLECTION);

        // Forzar la creación de la base de datos y colección creando los índices
        await collection.createIndex({ id: 1 }, { unique: true });
        await collection.createIndex({ email: 1 }, { unique: true });
        
        const count = await collection.countDocuments();

        console.log(`✅ Conexión exitosa a MongoDB Cluster: ${mongoUriMeta.host}`);
        console.log(`✅ Base de Datos: "${MONGODB_DB_NAME}" | Colección: "${MONGODB_USERS_COLLECTION}" | Documentos: ${count}`);
        return collection;
      })
      .catch((error) => {
        // #region agent log
        fetch("http://127.0.0.1:7348/ingest/11f7fafc-04b0-449f-84d7-872386fdd5f5", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "f7f4b8" },
          body: JSON.stringify({
            sessionId: "f7f4b8",
            runId: "pre-fix",
            hypothesisId: "H1",
            location: "server.js:getUsersCollection:error",
            message: "Mongo connect failed on server",
            data: { name: error?.name || "unknown", message: error?.message || "unknown" },
            timestamp: Date.now()
          })
        }).catch(() => {});
        // #endregion
        if (error.message.includes("Authentication failed")) {
          console.error(`❌ ERROR DE AUTENTICACIÓN: El usuario "${mongoUriMeta.username}" no pudo autenticarse en el host ${mongoUriMeta.host}. Revisa tu configuración en MongoDB Atlas.`);
        } else {
          console.error("❌ Error crítico al conectar a MongoDB:", error.message);
        }
        throw error;
      });
  }
  return mongoCollectionPromise;
}

function readUsersFromFile() {
  try {
    if (!fs.existsSync(USERS_FILE_PATH)) return [];
    const content = fs.readFileSync(USERS_FILE_PATH, "utf8");
    const parsed = JSON.parse(content || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("Error al leer data/users.json:", err.message);
    return [];
  }
}

function writeUsersToFile(users) {
  try {
    const dir = path.dirname(USERS_FILE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(USERS_FILE_PATH, JSON.stringify(users, null, 2), "utf8");
  } catch (err) {
    console.error("Error al escribir en data/users.json:", err.message);
  }
}

async function readUsers() {
  if (mongoClient) {
    try {
      const collection = await getUsersCollection();
      const rows = await collection.find({}, { sort: { createdAt: 1 } }).toArray();
      return rows.map(userRowToAppUser);
    } catch (err) {
      console.warn("MongoDB no disponible, leyendo desde data/users.json");
    }
  }
  return readUsersFromFile().map(userRowToAppUser);
}

async function writeUsers(users) {
  if (mongoClient) {
    try {
      const collection = await getUsersCollection();
      const rows = (users || []).map(appUserToUserRow);

      if (!rows.length) {
        await collection.deleteMany({});
        return;
      }

      const bulkOps = rows.map((row) => ({
        updateOne: {
          filter: { id: row.id },
          update: { $set: row },
          upsert: true
        }
      }));
      await collection.bulkWrite(bulkOps, { ordered: false });

      const ids = rows.map((row) => row.id);
      await collection.deleteMany({ id: { $nin: ids } });
      return;
    } catch (err) {
      console.warn("MongoDB no disponible, guardando en data/users.json");
    }
  }
  writeUsersToFile(users);
}

function normalizeEmail(email = "") {
  return String(email).trim().toLowerCase();
}

function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: Boolean(user.emailVerified),
    dateOfBirth: user.dateOfBirth, // New field
    phoneNumber: user.phoneNumber, // New field
    gender: user.gender,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function ensureWallet(user) {
  if (!user.wallet) {
    user.wallet = { balance: 0, currency: "USD", transactions: [], topupIntents: [] };
  }
  if (typeof user.wallet.balance !== "number") user.wallet.balance = Number(user.wallet.balance || 0);
  if (!user.wallet.currency) user.wallet.currency = "USD";
  if (!Array.isArray(user.wallet.transactions)) user.wallet.transactions = [];
  if (!Array.isArray(user.wallet.topupIntents)) user.wallet.topupIntents = [];

  const welcomeBonusTransactions = user.wallet.transactions.filter(
    (transaction) => transaction.type === "TOPUP" && transaction.meta?.planName === "Bono de bienvenida"
  );
  if (welcomeBonusTransactions.length) {
    const welcomeBonusTotal = welcomeBonusTransactions.reduce(
      (total, transaction) => total + Math.max(0, Number(transaction.amount) || 0),
      0
    );
    user.wallet.balance = Math.max(0, Math.round((user.wallet.balance - welcomeBonusTotal) * 100) / 100);
    user.wallet.transactions = user.wallet.transactions.filter(
      (transaction) => transaction.type !== "TOPUP" || transaction.meta?.planName !== "Bono de bienvenida"
    );
  }
  const hasCompletedTopup = user.wallet.transactions.some(
    (transaction) => transaction.type === "TOPUP" && Number(transaction.amount) > 0
  );
  if (!hasCompletedTopup) user.wallet.balance = 0;
}

function ensureEnrollments(user) {
  if (!Array.isArray(user.enrollments)) user.enrollments = [];
}

const PLANS = {
  essential: { id: "essential", name: "Starter", price: 39 },
  pro: { id: "pro", name: "CHAMPION", price: 149 },
  elite: { id: "elite", name: "ELITE", price: 79 }
};

const PAYMENT_CURRENCY = "USD";
const PAYPAL_CLIENT_ID = String(process.env.PAYPAL_CLIENT_ID || "").trim();
const PAYPAL_CLIENT_SECRET = String(process.env.PAYPAL_CLIENT_SECRET || "").trim();
const PAYPAL_API_BASE =
  String(process.env.PAYPAL_ENV || "sandbox").toLowerCase() === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
const BINANCE_PAY_API_KEY = String(process.env.BINANCE_PAY_API_KEY || "").trim();
const BINANCE_PAY_SECRET = String(process.env.BINANCE_PAY_SECRET || "").trim();
let paypalAccessTokenCache = null;
let binanceVerificationCertificatesCache = { expiresAt: 0, certificates: [] };

function paymentProviderEnabled(provider) {
  if (provider === "paypal") return Boolean(PAYPAL_CLIENT_ID && PAYPAL_CLIENT_SECRET);
  if (provider === "binance") {
    return Boolean(BINANCE_PAY_API_KEY && BINANCE_PAY_SECRET);
  }
  return false;
}

function getPaymentPublicConfig() {
  return {
    paypal: paymentProviderEnabled("paypal"),
    binance: paymentProviderEnabled("binance"),
    currency: PAYMENT_CURRENCY,
    recurring: false
  };
}

async function fetchProviderJson(url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(result.message || result.error_description || `El proveedor respondió ${response.status}.`);
      error.status = response.status;
      throw error;
    }
    return result;
  } finally {
    clearTimeout(timeout);
  }
}

async function getPayPalAccessToken() {
  if (paypalAccessTokenCache && paypalAccessTokenCache.expiresAt > Date.now() + 30000) {
    return paypalAccessTokenCache.value;
  }
  const credentials = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString("base64");
  const result = await fetchProviderJson(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });
  if (!result.access_token) throw new Error("PayPal no devolvió un token de acceso.");
  paypalAccessTokenCache = {
    value: result.access_token,
    expiresAt: Date.now() + Number(result.expires_in || 0) * 1000
  };
  return paypalAccessTokenCache.value;
}

async function paypalRequest(pathname, options = {}) {
  const accessToken = await getPayPalAccessToken();
  return fetchProviderJson(`${PAYPAL_API_BASE}${pathname}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
}

function createBinancePaySignature(timestamp, nonce, body) {
  return crypto
    .createHmac("sha512", BINANCE_PAY_SECRET)
    .update(`${timestamp}\n${nonce}\n${body}\n`)
    .digest("hex")
    .toUpperCase();
}

async function binancePayRequest(pathname, payload) {
  const timestamp = String(Date.now());
  const nonce = crypto.randomBytes(16).toString("hex");
  const body = JSON.stringify(payload);
  return fetchProviderJson(`https://bpay.binanceapi.com${pathname}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "BinancePay-Timestamp": timestamp,
      "BinancePay-Nonce": nonce,
      "BinancePay-Certificate-SN": BINANCE_PAY_API_KEY,
      "BinancePay-Signature": createBinancePaySignature(timestamp, nonce, body)
    },
    body
  });
}

async function getBinanceVerificationCertificate(serialNumber) {
  const cachedCertificate = binanceVerificationCertificatesCache.certificates.find(
    (certificate) => certificate.certSerial === serialNumber
  );
  if (binanceVerificationCertificatesCache.expiresAt <= Date.now() || !cachedCertificate) {
    const response = await binancePayRequest("/binancepay/openapi/certificates", {});
    if (response.status !== "SUCCESS" || !Array.isArray(response.data)) {
      throw new Error("No se pudieron obtener los certificados de Binance Pay.");
    }
    binanceVerificationCertificatesCache = {
      expiresAt: Date.now() + 12 * 60 * 60 * 1000,
      certificates: response.data
    };
  }
  return binanceVerificationCertificatesCache.certificates.find(
    (certificate) => certificate.certSerial === serialNumber
  );
}

async function verifyBinanceWebhook(req) {
  const timestamp = String(req.headers["binancepay-timestamp"] || "");
  const nonce = String(req.headers["binancepay-nonce"] || "");
  const serialNumber = String(req.headers["binancepay-certificate-sn"] || "");
  const signature = String(req.headers["binancepay-signature"] || "");
  const timestampNumber = Number(timestamp);
  if (
    !timestamp ||
    !nonce ||
    !serialNumber ||
    !signature ||
    !req.rawBody ||
    !Number.isFinite(timestampNumber) ||
    Math.abs(Date.now() - timestampNumber) > 5 * 60 * 1000
  ) {
    return false;
  }

  const certificate = await getBinanceVerificationCertificate(serialNumber);
  if (!certificate?.certPublic) return false;
  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(`${timestamp}\n${nonce}\n${req.rawBody}\n`);
  verifier.end();
  return verifier.verify(certificate.certPublic, signature, "base64");
}

function paymentAmountMatches(actual, expected) {
  return Number.isFinite(Number(actual)) && Math.round(Number(actual) * 100) === Math.round(Number(expected) * 100);
}

function addOneMonth(date) {
  const end = new Date(date);
  const day = end.getUTCDate();
  end.setUTCDate(1);
  end.setUTCMonth(end.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
  end.setUTCDate(Math.min(day, lastDay));
  return end;
}

function findMembershipEnrollment(user) {
  for (const enrollment of user.enrollments || []) {
    if (enrollment.type !== "PLAN" || enrollment.status !== "ACTIVE") continue;
    if (!enrollment.currentPeriodEnd && enrollment.startedAt) {
      const startedAt = new Date(enrollment.startedAt);
      if (Number.isFinite(startedAt.getTime())) {
        enrollment.currentPeriodEnd = addOneMonth(startedAt).toISOString();
      }
    }
    if (!enrollment.currentPeriodEnd || new Date(enrollment.currentPeriodEnd).getTime() > Date.now()) {
      return enrollment;
    }
    enrollment.status = "EXPIRED";
  }
  return null;
}

async function createProviderPayment({ provider, kind, amount, plan, user }) {
  const paymentId = crypto.randomUUID();
  const merchantTradeNo = paymentId.replace(/-/g, "");
  const payment = {
    id: paymentId,
    provider,
    kind,
    amount: Math.round(amount * 100) / 100,
    currency: PAYMENT_CURRENCY,
    planId: plan?.id || null,
    status: "PENDING",
    createdAt: new Date().toISOString()
  };

  if (provider === "paypal") {
    const order = await paypalRequest("/v2/checkout/orders", {
      method: "POST",
      headers: { "PayPal-Request-Id": paymentId },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          reference_id: paymentId,
          custom_id: user.id,
          description: kind === "membership" ? `Membresía mensual ${plan.name}` : "Recarga de cartera Stargym",
          amount: { currency_code: PAYMENT_CURRENCY, value: payment.amount.toFixed(2) }
        }],
        application_context: {
          brand_name: "Stargym",
          user_action: "PAY_NOW",
          return_url: `${APP_BASE_URL}/payment-return.html?provider=paypal&paymentId=${encodeURIComponent(paymentId)}`,
          cancel_url: `${APP_BASE_URL}/payment-return.html?provider=paypal&paymentId=${encodeURIComponent(paymentId)}&cancelled=1`
        }
      })
    });
    const approvalUrl = order.links?.find((link) => link.rel === "payer-action" || link.rel === "approve")?.href;
    if (!order.id || !approvalUrl) throw new Error("PayPal no devolvió el enlace de aprobación.");
    payment.providerOrderId = order.id;
    return { payment, url: approvalUrl };
  }

  const callbackUrl = `${APP_BASE_URL}/payment-return.html?provider=binance&paymentId=${encodeURIComponent(paymentId)}`;
  const response = await binancePayRequest("/binancepay/openapi/v2/order", {
    env: { terminalType: "WEB" },
    merchantTradeNo,
    orderAmount: payment.amount.toFixed(2),
    currency: PAYMENT_CURRENCY,
    goods: {
      goodsType: "02",
      goodsCategory: "Z000",
      referenceGoodsId: plan?.id || "wallet-topup",
      goodsName: kind === "membership" ? `Stargym ${plan.name} (1 mes)` : "Recarga de cartera Stargym"
    },
    returnUrl: callbackUrl,
    cancelUrl: `${callbackUrl}&cancelled=1`,
    webhookUrl: `${APP_BASE_URL}/api/payments/binance/webhook`
  });
  if (response.status !== "SUCCESS" || !response.data?.checkoutUrl || !response.data?.prepayId) {
    throw new Error(response.errorMessage || "Binance Pay no pudo crear la orden.");
  }
  payment.providerOrderId = response.data.prepayId;
  payment.merchantTradeNo = merchantTradeNo;
  return { payment, url: response.data.checkoutUrl };
}

function applySettledPayment(user, payment) {
  if (payment.status === "SUCCEEDED") return;
  ensureWallet(user);
  ensureEnrollments(user);
  if (payment.kind === "wallet_topup") {
    user.wallet.balance = Math.round((Number(user.wallet.balance || 0) + payment.amount) * 100) / 100;
    user.wallet.transactions.unshift({
      id: crypto.randomUUID(),
      type: "TOPUP",
      amount: payment.amount,
      currency: PAYMENT_CURRENCY,
      meta: { paymentId: payment.id, provider: payment.provider },
      createdAt: new Date().toISOString()
    });
  } else {
    if (findMembershipEnrollment(user)) {
      throw new Error("El usuario ya tiene una membresía activa; el pago requiere revisión.");
    }
    const plan = PLANS[payment.planId];
    if (!plan) throw new Error("El pago hace referencia a un plan inexistente.");
    const startedAt = new Date();
    const currentPeriodEnd = addOneMonth(startedAt);
    user.enrollments.unshift({
      id: crypto.randomUUID(),
      type: "PLAN",
      planId: plan.id,
      planName: plan.name,
      price: payment.amount,
      currency: PAYMENT_CURRENCY,
      status: "ACTIVE",
      source: payment.provider,
      paymentId: payment.id,
      startedAt: startedAt.toISOString(),
      currentPeriodEnd: currentPeriodEnd.toISOString()
    });
  }
  payment.status = "SUCCEEDED";
  payment.succeededAt = new Date().toISOString();
}

async function verifyProviderPayment(payment) {
  if (payment.provider === "paypal") {
    const orderPath = `/v2/checkout/orders/${encodeURIComponent(payment.providerOrderId)}`;
    let result = await paypalRequest(orderPath, { method: "GET" });
    if (result.status === "APPROVED") {
      result = await paypalRequest(`${orderPath}/capture`, {
        method: "POST",
        headers: { "PayPal-Request-Id": `${payment.id}-capture` },
        body: "{}"
      });
    }
    const purchase = result.purchase_units?.find((unit) => unit.reference_id === payment.id);
    const capture = purchase?.payments?.captures?.find((item) => item.status === "COMPLETED");
    if (
      result.status !== "COMPLETED" ||
      !purchase ||
      purchase.custom_id !== payment.userId ||
      !capture ||
      capture.amount?.currency_code !== PAYMENT_CURRENCY ||
      !paymentAmountMatches(capture.amount.value, payment.amount)
    ) {
      return false;
    }
    payment.providerCaptureId = capture.id;
    return true;
  }

  const result = await binancePayRequest("/binancepay/openapi/v2/order/query", {
    merchantTradeNo: payment.merchantTradeNo
  });
  const order = result.data;
  if (
    result.status !== "SUCCESS" ||
    order?.status !== "PAID" ||
    order?.merchantTradeNo !== payment.merchantTradeNo ||
    order?.currency !== PAYMENT_CURRENCY ||
    !paymentAmountMatches(order?.orderAmount, payment.amount)
  ) {
    return false;
  }
  payment.providerCaptureId = order.transactionId || order.prepayId || null;
  return true;
}

async function confirmPaymentForUser(userId, paymentId) {
  const users = await readUsers();
  const user = users.find((item) => item.id === userId);
  if (!user) throw Object.assign(new Error("Usuario no encontrado."), { status: 404 });
  user.paymentOrders = Array.isArray(user.paymentOrders) ? user.paymentOrders : [];
  const payment = user.paymentOrders.find((item) => item.id === paymentId);
  if (!payment) throw Object.assign(new Error("Pago no encontrado."), { status: 404 });
  if (payment.status === "SUCCEEDED") return { user, payment, users };
  if (!["PENDING", "CANCELED"].includes(payment.status) || (payment.status === "CANCELED" && payment.provider !== "binance")) {
    throw Object.assign(new Error("El pago no está pendiente."), { status: 409 });
  }
  if (!paymentProviderEnabled(payment.provider)) {
    throw Object.assign(new Error("El proveedor de pago no está configurado."), { status: 503 });
  }

  payment.userId = user.id;
  const verified = await verifyProviderPayment(payment);
  if (!verified) return { user, payment, users };
  applySettledPayment(user, payment);
  user.updatedAt = new Date().toISOString();
  await writeUsers(users);
  return { user, payment, users };
}

function createVerificationCode() {
  const code = String(crypto.randomInt(100000, 1000000));
  const codeHash = crypto.createHash("sha256").update(code).digest("hex");
  return { code, codeHash };
}

async function requireAuth(req, res, next) {
  const header = String(req.headers.authorization || "");
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) {
    return res.status(401).json({ message: "No autorizado." });
  }

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return res.status(401).json({ message: "Token invalido o expirado." });
  }

  try {
    const users = await readUsers();
    const user = users.find((item) => item.id === String(payload.sub || ""));
    if (!user) {
      return res.status(401).json({ message: "La cuenta asociada a esta sesion ya no existe." });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const isRevoked = Array.isArray(user.revokedTokens) &&
      user.revokedTokens.some((entry) => entry && entry.hash === tokenHash && entry.expiresAt > Date.now());
    if (isRevoked) {
      return res.status(401).json({ message: "La sesion fue cerrada." });
    }

    req.auth = {
      ...payload,
      sub: user.id,
      email: user.email,
      name: user.name,
    };
    req.authToken = token;
    return next();
  } catch (error) {
    console.error("No se pudo validar la sesión:", error);
    return res.status(500).json({ message: "No se pudo validar la sesion." });
  }
}

function requireAdmin(req, res, next) {
  const email = String(req.auth?.email || "").toLowerCase();
  if (!ADMIN_EMAIL || email !== ADMIN_EMAIL) {
    return res.status(403).json({ message: "No autorizado (admin requerido)." });
  }
  return next();
}

function hasSmtpConfig() {
  const required = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "FROM_EMAIL"];
  return required.every((key) => Boolean(process.env[key]));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

async function sendVerificationEmail({ email, name, code }) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: String(process.env.SMTP_SECURE || "false") === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  await transporter.sendMail({
    from: process.env.FROM_EMAIL,
    to: email,
    subject: "Tu código para activar tu cuenta de Stargym",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h2>Bienvenido/a a Stargym, ${escapeHtml(name)}</h2>
        <p>Ingresa este código en la página de verificación para activar tu cuenta:</p>
        <p style="font-size:28px;font-weight:700;letter-spacing:8px;">${code}</p>
        <p>El código vence en 10 minutos.</p>
        <p>Si no solicitaste esta cuenta, ignora este mensaje.</p>
      </div>
    `
  });
}

app.post("/api/auth/register", async (req, res) => {
  try {
    if (!hasSmtpConfig()) {
      return res.status(503).json({
        message: "El envío de correos no está configurado. Contacta al administrador para completar el registro."
      });
    }

    const name = String(req.body?.name || "").trim();
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");
    const dateOfBirth = typeof req.body?.dateOfBirth === "string" ? req.body.dateOfBirth.trim() : "";
    const phoneNumber = typeof req.body?.phoneNumber === "string" ? req.body.phoneNumber.trim() : "";
    const gender = typeof req.body?.gender === "string" ? req.body.gender.trim() : "";

    if (!name || !email || password.length < 6 || !dateOfBirth || !gender) {
      return res.status(400).json({ message: "Datos invalidos o incompletos." });
    }

    if (dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
      return res.status(400).json({ message: "Formato de fecha inválido." });
    }

    const cleanedPhone = phoneNumber.replace(/\D/g, '');
    if (phoneNumber && (cleanedPhone.length < 7 || cleanedPhone.length > 15)) {
      return res.status(400).json({ message: "Datos invalidos. Verifica nombre, correo y contrasena." });
    }

    const users = await readUsers();
    const existing = users.find((user) => user.email === email);
    const passwordHash = await bcrypt.hash(password, 10);
    const { code, codeHash } = createVerificationCode();
    const verificationSentAt = Date.now();
    const verificationExpiresAt = verificationSentAt + 1000 * 60 * 10;

    if (existing && existing.emailVerified) {
      return res.status(409).json({ message: "Este correo ya esta registrado." });
    }

    let targetUser = existing;
    if (existing) {
      existing.name = name;
      existing.passwordHash = passwordHash;
      existing.verificationTokenHash = codeHash;
      existing.verificationExpiresAt = verificationExpiresAt;
      existing.verificationAttempts = 0;
      existing.verificationSentAt = verificationSentAt;
      existing.emailVerified = false;
      existing.dateOfBirth = dateOfBirth || null;
      existing.phoneNumber = phoneNumber || null;
      existing.gender = gender || null;
      ensureWallet(existing);
      ensureEnrollments(existing);
      existing.updatedAt = new Date().toISOString();
    } else {
      targetUser = {
        id: crypto.randomUUID(),
        name,
        email,
        passwordHash,
        emailVerified: false,
        verificationTokenHash: codeHash,
        verificationExpiresAt,
        verificationAttempts: 0,
        verificationSentAt,
        wallet: {
          balance: 0,
          currency: "USD",
          transactions: [],
          topupIntents: []
        },
        enrollments: [],
        dateOfBirth: dateOfBirth || null,
        phoneNumber: phoneNumber || null,
        gender: gender || null,
        lastLoginAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      users.push(targetUser);
    }

    await writeUsers(users);
    try {
      await sendVerificationEmail({ email, name, code });
    } catch (error) {
      console.error("No se pudo enviar el código de verificación:", error);
      return res.status(502).json({
        message: "No se pudo enviar el código a tu correo. Revisa la configuración del correo e inténtalo de nuevo."
      });
    }

    return res.status(201).json({ message: "Cuenta creada. Te enviamos un código de verificación a tu correo." });
  } catch (error) {
    return res.status(500).json({ message: `No se pudo registrar: ${error.message}` });
  }
});

app.post("/api/auth/verify", async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const code = String(req.body?.code || "").trim();
    if (!email || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ message: "Ingresa el correo y el código de seis dígitos." });
    }

    const users = await readUsers();
    const user = users.find((item) => item.email === email);

    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado." });
    }

    if (user.emailVerified) {
      return res.json({ message: "Tu cuenta ya estaba verificada." });
    }

    if (Number(user.verificationAttempts || 0) >= 5) {
      return res.status(429).json({ message: "Se agotaron los intentos. Registra de nuevo el correo para recibir otro código." });
    }

    if (Date.now() > Number(user.verificationExpiresAt || 0)) {
      return res.status(400).json({ message: "El código expiró. Usa «Reenviar código» para solicitar otro." });
    }

    const codeHash = crypto.createHash("sha256").update(code).digest("hex");
    const validCode = user.verificationTokenHash
      && crypto.timingSafeEqual(Buffer.from(user.verificationTokenHash, "hex"), Buffer.from(codeHash, "hex"));
    if (!validCode) {
      user.verificationAttempts = Number(user.verificationAttempts || 0) + 1;
      await writeUsers(users);
      const attemptsLeft = Math.max(0, 5 - user.verificationAttempts);
      return res.status(user.verificationAttempts >= 5 ? 429 : 400).json({
        message: attemptsLeft
          ? `El código no es correcto. Te quedan ${attemptsLeft} intentos.`
          : "Se agotaron los intentos. Registra de nuevo el correo para recibir otro código."
      });
    }

    user.emailVerified = true;
    user.verificationTokenHash = null;
    user.verificationExpiresAt = null;
    user.verificationAttempts = 0;
    user.verificationSentAt = null;
    user.updatedAt = new Date().toISOString();

    await writeUsers(users);
    return res.json({ message: "Correo verificado correctamente." });
  } catch (error) {
    return res.status(500).json({ message: `No se pudo verificar: ${error.message}` });
  }
});

app.post("/api/auth/resend-verification", async (req, res) => {
  try {
    if (!hasSmtpConfig()) {
      return res.status(503).json({ message: "El envío de correos no está configurado." });
    }

    const email = normalizeEmail(req.body?.email);
    if (!email) return res.status(400).json({ message: "Correo requerido." });

    const users = await readUsers();
    const user = users.find((item) => item.email === email);
    if (!user || user.emailVerified) {
      return res.json({ message: "Si existe una cuenta pendiente para ese correo, recibirás un código." });
    }

    const resendWait = 60 * 1000 - (Date.now() - Number(user.verificationSentAt || 0));
    if (resendWait > 0) {
      return res.status(429).json({
        message: `Espera ${Math.ceil(resendWait / 1000)} segundos antes de solicitar otro código.`
      });
    }

    const { code, codeHash } = createVerificationCode();
    user.verificationTokenHash = codeHash;
    user.verificationExpiresAt = Date.now() + 1000 * 60 * 10;
    user.verificationAttempts = 0;
    user.verificationSentAt = Date.now();
    user.updatedAt = new Date().toISOString();
    await writeUsers(users);

    try {
      await sendVerificationEmail({ email, name: user.name, code });
    } catch (error) {
      console.error("No se pudo reenviar el código de verificación:", error);
      return res.status(502).json({ message: "No se pudo enviar el código. Inténtalo de nuevo más tarde." });
    }

    return res.json({ message: "Te enviamos un nuevo código de verificación." });
  } catch (error) {
    return res.status(500).json({ message: `No se pudo reenviar el código: ${error.message}` });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");
    if (!email || !password) {
      return res.status(400).json({ message: "Correo y contrasena requeridos." });
    }

    const users = await readUsers();
    const user = users.find((item) => item.email === email);
    if (!user) {
      return res.status(401).json({ message: "Credenciales invalidas." });
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ message: "Credenciales invalidas." });
    }

    if (!user.emailVerified) {
      return res.status(403).json({ message: "Debes verificar tu correo antes de iniciar sesion." });
    }

    user.lastLoginAt = new Date().toISOString();
    user.updatedAt = new Date().toISOString();
    await writeUsers(users);

    const token = jwt.sign({ sub: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: "7d" });
    return res.json({
      message: "Inicio de sesion correcto.",
      token,
      user: sanitizeUser(user)
    });
  } catch (error) {
    return res.status(500).json({ message: `No se pudo iniciar sesion: ${error.message}` });
  }
});

app.post("/api/auth/logout", requireAuth, async (req, res) => {
  try {
    const users = await readUsers();
    const user = users.find((item) => item.id === String(req.auth.sub || ""));
    if (!user) {
      return res.status(401).json({ message: "La cuenta asociada a esta sesion ya no existe." });
    }

    const expiresAt = Number(req.auth.exp || 0) * 1000;
    if (expiresAt > Date.now()) {
      const tokenHash = crypto.createHash("sha256").update(req.authToken).digest("hex");
      user.revokedTokens = Array.isArray(user.revokedTokens)
        ? user.revokedTokens.filter((entry) => entry && entry.expiresAt > Date.now())
        : [];
      user.revokedTokens.push({ hash: tokenHash, expiresAt });
      await writeUsers(users);
    }
    return res.json({ message: "Sesion cerrada correctamente." });
  } catch (error) {
    console.error("No se pudo cerrar la sesión:", error);
    return res.status(500).json({ message: "No se pudo cerrar la sesion." });
  }
});

// CRUD (usuario autenticado): perfil propio
app.get("/api/users/me", requireAuth, async (req, res) => {
  try {
    const userId = String(req.auth.sub || "");
    const users = await readUsers();
    const user = users.find((u) => u.id === userId);
    if (!user) return res.status(404).json({ message: "Usuario no encontrado." });
    ensureWallet(user);
    ensureEnrollments(user);
    await writeUsers(users);
    return res.json({ user: sanitizeUser(user) });
  } catch (error) {
    return res.status(500).json({ message: `No se pudo obtener el perfil: ${error.message}` });
  }
});

app.put("/api/users/me", requireAuth, async (req, res) => {
  try {
    const userId = String(req.auth.sub || "");
    const users = await readUsers();
    const user = users.find((u) => u.id === userId);
    if (!user) return res.status(404).json({ message: "Usuario no encontrado." });
    ensureWallet(user);
    ensureEnrollments(user);

    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const phoneNumber = typeof req.body?.phoneNumber === "string" ? req.body.phoneNumber.trim() : "";

    let changesMade = false;

    if (name) user.name = name;
    if (password) {
      if (password.length < 6) return res.status(400).json({ message: "La contraseña debe tener al menos 6 caracteres." });
      user.passwordHash = await bcrypt.hash(password, 10);
    }

    // Handle phoneNumber
    if (phoneNumber) {
      // Basic validation for phone number (e.g., only digits, min length)
      const cleanedPhoneNumber = phoneNumber.replace(/\D/g, '');
      if (cleanedPhoneNumber.length < 7 || cleanedPhoneNumber.length > 15) { // Common phone number length range
        return res.status(400).json({ message: "Número de teléfono inválido." });
      }
      if (user.phoneNumber !== phoneNumber) {
        user.phoneNumber = phoneNumber;
        changesMade = true;
      }
    } else if (user.phoneNumber !== null) { // Allow clearing the field
      user.phoneNumber = null;
      changesMade = true;
    }

    if (!changesMade && !name && !password) { // Check if any actual changes were made
      return res.status(200).json({ message: "No hay cambios para guardar.", user: sanitizeUser(user) });
    }
    user.updatedAt = new Date().toISOString();
    await writeUsers(users);

    return res.json({ message: "Perfil actualizado.", user: sanitizeUser(user) });
  } catch (error) {
    return res.status(500).json({ message: `No se pudo actualizar el perfil: ${error.message}` });
  }
});

app.delete("/api/users/me", requireAuth, async (req, res) => {
  try {
    const userId = String(req.auth.sub || "");
    const users = await readUsers();
    const idx = users.findIndex((u) => u.id === userId);
    if (idx === -1) return res.status(404).json({ message: "Usuario no encontrado." });

    users.splice(idx, 1);
    await writeUsers(users);
    return res.json({ message: "Cuenta eliminada." });
  } catch (error) {
    return res.status(500).json({ message: `No se pudo eliminar la cuenta: ${error.message}` });
  }
});

// Cartera (wallet)
app.get("/api/wallet", requireAuth, async (req, res) => {
  try {
    const userId = String(req.auth.sub || "");
    const users = await readUsers();
    const user = users.find((u) => u.id === userId);
    if (!user) return res.status(404).json({ message: "Usuario no encontrado." });
    ensureWallet(user);
    await writeUsers(users);
    return res.json({ wallet: user.wallet });
  } catch (error) {
    return res.status(500).json({ message: `No se pudo cargar la cartera: ${error.message}` });
  }
});

app.get("/api/wallet/destinations", requireAuth, async (req, res) => {
  try {
    const config = getPaymentPublicConfig();
    const destinations = [
      {
        id: "binance-pay",
        label: "Binance Pay",
        type: "Pago en línea",
        maskedAccount: config.binance ? "Disponible" : "No configurado"
      },
      {
        id: "paypal",
        label: "PayPal",
        type: "Pago en línea",
        maskedAccount: config.paypal ? "Disponible" : "No configurado"
      }
    ];
    return res.json({ destinations });
  } catch (error) {
    return res.status(500).json({ message: `No se pudo cargar destinos: ${error.message}` });
  }
});

app.post("/api/wallet/topup", requireAuth, async (req, res) => {
  return res.status(410).json({
    message: "Los pagos directos por tarjeta se desactivaron. Inicia una recarga con Binance Pay o PayPal."
  });
});

app.post("/api/wallet/topup-intents", requireAuth, (req, res) => res.status(410).json({
  message: "Las recargas ahora se procesan con Binance Pay o PayPal."
}));

app.post("/api/wallet/topup-intents/:id/confirm", requireAuth, (req, res) => res.status(410).json({
  message: "La confirmación simulada de pagos está desactivada."
}));

// Inscripción a planes (cobro desde cartera)
app.get("/api/enrollments", requireAuth, async (req, res) => {
  try {
    const userId = String(req.auth.sub || "");
    const users = await readUsers();
    const user = users.find((u) => u.id === userId);
    if (!user) return res.status(404).json({ message: "Usuario no encontrado." });
    ensureEnrollments(user);
    findMembershipEnrollment(user);
    await writeUsers(users);
    return res.json({ enrollments: user.enrollments });
  } catch (error) {
    return res.status(500).json({ message: `No se pudieron cargar inscripciones: ${error.message}` });
  }
});

app.post("/api/enrollments/plan", requireAuth, async (req, res) => {
  try {
    const planId = String(req.body?.planId || "").toLowerCase();
    const plan = PLANS[planId];
    if (!plan) {
      return res.status(400).json({ message: "Plan inválido." });
    }

    const userId = String(req.auth.sub || "");
    const users = await readUsers();
    const user = users.find((u) => u.id === userId);
    if (!user) return res.status(404).json({ message: "Usuario no encontrado." });
    ensureWallet(user);
    ensureEnrollments(user);

    const hasActive = findMembershipEnrollment(user);
    if (hasActive) {
      return res.status(409).json({ message: "Ya tienes una membresía activa." });
    }

    if (user.wallet.balance < plan.price) {
      return res.status(402).json({ message: "Saldo insuficiente. Recarga tu cartera." });
    }

    user.wallet.balance = Math.round((user.wallet.balance - plan.price) * 100) / 100;
    user.wallet.transactions.unshift({
      id: crypto.randomUUID(),
      type: "MEMBERSHIP",
      amount: -plan.price,
      currency: user.wallet.currency,
      meta: { planId: plan.id, planName: plan.name },
      createdAt: new Date().toISOString()
    });

    const startedAt = new Date();
    const currentPeriodEnd = addOneMonth(startedAt);
    const enrollment = {
      id: crypto.randomUUID(),
      type: "PLAN",
      planId: plan.id,
      planName: plan.name,
      price: plan.price,
      currency: PAYMENT_CURRENCY,
      status: "ACTIVE",
      startedAt: startedAt.toISOString(),
      currentPeriodEnd: currentPeriodEnd.toISOString()
    };
    user.enrollments.unshift(enrollment);
    user.updatedAt = new Date().toISOString();
    await writeUsers(users);
    return res.json({ message: "Inscripción completada.", enrollment, wallet: user.wallet });
  } catch (error) {
    return res.status(500).json({ message: `No se pudo inscribir: ${error.message}` });
  }
});

app.get("/api/billing/public-config", (req, res) => {
  res.json(getPaymentPublicConfig());
});

app.post("/api/billing/checkout", requireAuth, async (req, res) => {
  try {
    const provider = String(req.body?.provider || "").toLowerCase();
    const kind = String(req.body?.kind || "").toLowerCase();
    if (!["paypal", "binance"].includes(provider)) {
      return res.status(400).json({ message: "Selecciona PayPal o Binance Pay." });
    }
    if (!paymentProviderEnabled(provider)) {
      const label = provider === "paypal" ? "PayPal" : "Binance Pay";
      return res.status(503).json({ message: `${label} no está configurado en el servidor.` });
    }

    let amount;
    let plan = null;
    if (kind === "membership") {
      const planId = String(req.body?.planId || "").toLowerCase();
      plan = PLANS[planId];
      if (!plan) return res.status(400).json({ message: "Plan inválido." });
      amount = plan.price;
    } else if (kind === "wallet_topup") {
      amount = Number(req.body?.amount);
      if (!Number.isFinite(amount) || amount < 1 || amount > 1000) {
        return res.status(400).json({ message: "La recarga debe estar entre 1 y 1000 USD." });
      }
      amount = Math.round(amount * 100) / 100;
    } else {
      return res.status(400).json({ message: "Tipo de pago inválido." });
    }

    const users = await readUsers();
    const user = users.find((item) => item.id === String(req.auth.sub || ""));
    if (!user) return res.status(404).json({ message: "Usuario no encontrado." });
    user.paymentOrders = Array.isArray(user.paymentOrders) ? user.paymentOrders : [];
    let pendingPayment = null;
    if (kind === "membership") {
      ensureEnrollments(user);
      if (findMembershipEnrollment(user)) {
        return res.status(409).json({ message: "Ya tienes una membresía activa." });
      }
      pendingPayment = user.paymentOrders.find(
        (payment) => payment.kind === kind && payment.status === "PENDING"
      );
    } else {
      pendingPayment = user.paymentOrders.find(
        (payment) => payment.kind === kind && payment.amount === amount && payment.status === "PENDING"
      );
    }
    if (pendingPayment) {
      if (
        pendingPayment.provider === provider &&
        pendingPayment.checkoutUrl &&
        (kind !== "membership" || pendingPayment.planId === plan.id)
      ) {
        return res.json({
          paymentId: pendingPayment.id,
          url: pendingPayment.checkoutUrl,
          currency: pendingPayment.currency
        });
      }
      return res.status(409).json({
        message: "Tienes un pago pendiente para esta compra. Continúalo con el método elegido anteriormente o cancélalo."
      });
    }

    const { payment, url } = await createProviderPayment({ provider, kind, amount, plan, user });
    payment.userId = user.id;
    payment.checkoutUrl = url;
    user.paymentOrders.unshift(payment);
    user.paymentOrders = user.paymentOrders.slice(0, 100);
    user.updatedAt = new Date().toISOString();
    await writeUsers(users);
    return res.status(201).json({ paymentId: payment.id, url, currency: PAYMENT_CURRENCY });
  } catch (error) {
    console.error("No se pudo iniciar el pago:", error);
    return res.status(error.status && error.status < 500 ? error.status : 502).json({
      message: "No se pudo iniciar el pago con el proveedor. Inténtalo de nuevo más tarde."
    });
  }
});

app.post("/api/billing/confirm", requireAuth, async (req, res) => {
  try {
    const paymentId = String(req.body?.paymentId || "");
    if (!paymentId) return res.status(400).json({ message: "Falta el identificador del pago." });
    const result = await confirmPaymentForUser(String(req.auth.sub || ""), paymentId);
    if (result.payment.status !== "SUCCEEDED") {
      return res.status(202).json({ status: result.payment.status, message: "El proveedor aún no confirma el pago." });
    }
    return res.json({
      status: result.payment.status,
      kind: result.payment.kind,
      message: result.payment.kind === "membership"
        ? "Pago confirmado. Tu membresía está activa durante un mes."
        : "Pago confirmado. Tu recarga fue acreditada en la cartera.",
      wallet: result.user.wallet,
      enrollments: result.user.enrollments
    });
  } catch (error) {
    if (!error.status || error.status >= 500) console.error("No se pudo confirmar el pago:", error);
    return res.status(error.status || 502).json({
      message: error.status ? error.message : "No se pudo confirmar el pago. Inténtalo de nuevo."
    });
  }
});

app.post("/api/payments/binance/webhook", async (req, res) => {
  try {
    if (!paymentProviderEnabled("binance")) return res.sendStatus(503);
    if (!(await verifyBinanceWebhook(req))) return res.sendStatus(401);

    let data = req.body?.data;
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch (error) {
        return res.status(400).json({ message: "Evento Binance Pay inválido." });
      }
    }
    if (req.body?.bizStatus !== "PAY_SUCCESS") {
      return res.json({ received: true });
    }
    const merchantTradeNo = String(data?.merchantTradeNo || "");
    if (!merchantTradeNo) return res.status(400).json({ message: "Falta la referencia de la orden." });

    const users = await readUsers();
    const user = users.find((item) =>
      (item.paymentOrders || []).some((payment) => payment.merchantTradeNo === merchantTradeNo)
    );
    if (!user) return res.sendStatus(404);
    const payment = user.paymentOrders.find((item) => item.merchantTradeNo === merchantTradeNo);
    if (payment.status === "SUCCEEDED") return res.json({ received: true });

    const result = await confirmPaymentForUser(user.id, payment.id);
    if (result.payment.status !== "SUCCEEDED") return res.sendStatus(503);
    return res.json({ received: true });
  } catch (error) {
    console.error("No se pudo procesar la notificación de Binance Pay:", error);
    return res.sendStatus(500);
  }
});

app.post("/api/billing/cancel", requireAuth, async (req, res) => {
  try {
    const paymentId = String(req.body?.paymentId || "");
    const users = await readUsers();
    const user = users.find((item) => item.id === String(req.auth.sub || ""));
    if (!user) return res.status(404).json({ message: "Usuario no encontrado." });
    const payment = (user.paymentOrders || []).find((item) => item.id === paymentId);
    if (!payment) return res.status(404).json({ message: "Pago no encontrado." });
    if (payment.status === "PENDING") {
      payment.status = "CANCELED";
      payment.updatedAt = new Date().toISOString();
      await writeUsers(users);
    }
    return res.json({ status: payment.status });
  } catch (error) {
    console.error("No se pudo cancelar el intento de pago:", error);
    return res.status(500).json({ message: "No se pudo actualizar el estado del pago." });
  }
});

// CRUD (admin): listar/ver/eliminar usuarios
app.get("/api/admin/users", requireAuth, requireAdmin, async (req, res) => {
  try {
    const users = await readUsers();
    return res.json({ users: users.map(sanitizeUser) });
  } catch (error) {
    return res.status(500).json({ message: `No se pudo listar usuarios: ${error.message}` });
  }
});

app.get("/api/admin/users/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = String(req.params.id || "");
    const users = await readUsers();
    const user = users.find((u) => u.id === id);
    if (!user) return res.status(404).json({ message: "Usuario no encontrado." });
    return res.json({ user: sanitizeUser(user) });
  } catch (error) {
    return res.status(500).json({ message: `No se pudo obtener usuario: ${error.message}` });
  }
});

app.delete("/api/admin/users/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = String(req.params.id || "");
    const users = await readUsers();
    const idx = users.findIndex((u) => u.id === id);
    if (idx === -1) return res.status(404).json({ message: "Usuario no encontrado." });
    users.splice(idx, 1);
    await writeUsers(users);
    return res.json({ message: "Usuario eliminado." });
  } catch (error) {
    return res.status(500).json({ message: `No se pudo eliminar usuario: ${error.message}` });
  }
});

app.listen(PORT, async () => {
  console.log(`Stargym server listo en ${APP_BASE_URL}`);
  console.log(`Storage: MongoDB (${MONGODB_DB_NAME}.${MONGODB_USERS_COLLECTION})`);

  // Intentar conectar a MongoDB inmediatamente al iniciar el servidor
  try {
    await getUsersCollection();
  } catch (err) {
    // El error ya se maneja y loguea dentro de getUsersCollection
  }
});
