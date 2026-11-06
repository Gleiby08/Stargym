const { MongoClient } = require("mongodb");
require("dotenv").config();

const APP_BASE_URL = process.env.APP_BASE_URL || "http://localhost:3000";
const MONGODB_URI = String(process.env.MONGODB_URI || "").trim();
const MONGODB_DB_NAME = String(process.env.MONGODB_DB_NAME || "Stargym").trim();
const MONGODB_USERS_COLLECTION = String(process.env.MONGODB_USERS_COLLECTION || "users").trim();
const mongoUriMeta = (() => {
  try {
    const u = new URL(MONGODB_URI);
    return { host: u.host, username: u.username || "(empty)", hasPassword: Boolean(u.password), pathDb: u.pathname || "/" };
  } catch {
    return { host: "(invalid-uri)", username: "(unknown)", hasPassword: false, pathDb: "(unknown)" };
  }
})();

async function api(path, { method = "GET", token, body } = {}) {
  const response = await fetch(`${APP_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

async function main() {
  if (!MONGODB_URI) {
    throw new Error("Falta MONGODB_URI en .env");
  }

  // #region agent log
  fetch("http://127.0.0.1:7348/ingest/11f7fafc-04b0-449f-84d7-872386fdd5f5", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "f7f4b8" },
    body: JSON.stringify({
      sessionId: "f7f4b8",
      runId: "pre-fix",
      hypothesisId: "H2",
      location: "validate-mongodb-flow.js:main:init",
      message: "Validation script starting with env values",
      data: { appBaseUrl: APP_BASE_URL, envDb: MONGODB_DB_NAME, collection: MONGODB_USERS_COLLECTION, uriHost: mongoUriMeta.host, uriUser: mongoUriMeta.username, uriPathDb: mongoUriMeta.pathDb, hasPassword: mongoUriMeta.hasPassword },
      timestamp: Date.now()
    })
  }).catch(() => {});
  // #endregion

  const mongoClient = new MongoClient(MONGODB_URI);
  try {
    await mongoClient.connect();
    // #region agent log
    fetch("http://127.0.0.1:7348/ingest/11f7fafc-04b0-449f-84d7-872386fdd5f5", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "f7f4b8" },
      body: JSON.stringify({
        sessionId: "f7f4b8",
        runId: "pre-fix",
        hypothesisId: "H1",
        location: "validate-mongodb-flow.js:main:connected",
        message: "Validation script connected to Mongo",
        data: { envDb: MONGODB_DB_NAME, collection: MONGODB_USERS_COLLECTION },
        timestamp: Date.now()
      })
    }).catch(() => {});
    // #endregion
  } catch (error) {
    // #region agent log
    fetch("http://127.0.0.1:7348/ingest/11f7fafc-04b0-449f-84d7-872386fdd5f5", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "f7f4b8" },
      body: JSON.stringify({
        sessionId: "f7f4b8",
        runId: "pre-fix",
        hypothesisId: "H1",
        location: "validate-mongodb-flow.js:main:connect_error",
        message: "Validation script Mongo connect failed",
        data: { name: error?.name || "unknown", message: error?.message || "unknown" },
        timestamp: Date.now()
      })
    }).catch(() => {});
    // #endregion
    throw error;
  }
  const usersCollection = mongoClient.db(MONGODB_DB_NAME).collection(MONGODB_USERS_COLLECTION);

  try {
    const stamp = Date.now();
    const email = `mongodb-check-${stamp}@stargym.local`;
    const password = "Mongo123!";
    const name = "Mongo Check";

    const reg = await api("/api/auth/register", {
      method: "POST",
      body: { name, email, password, gender: "Otro", dateOfBirth: "2000-01-01" }
    });
    // #region agent log
    fetch("http://127.0.0.1:7348/ingest/11f7fafc-04b0-449f-84d7-872386fdd5f5", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "f7f4b8" },
      body: JSON.stringify({
        sessionId: "f7f4b8",
        runId: "pre-fix",
        hypothesisId: "H3",
        location: "validate-mongodb-flow.js:main:register_response",
        message: "Register API response captured",
        data: { status: reg.status, ok: reg.ok, hasMessage: Boolean(reg.data?.message) },
        timestamp: Date.now()
      })
    }).catch(() => {});
    // #endregion
    if (!reg.ok) throw new Error(`Registro falló (${reg.status}): ${reg.data.message || "sin detalle"}`);

    const created = await usersCollection.findOne({ email });
    // #region agent log
    fetch("http://127.0.0.1:7348/ingest/11f7fafc-04b0-449f-84d7-872386fdd5f5", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "f7f4b8" },
      body: JSON.stringify({
        sessionId: "f7f4b8",
        runId: "pre-fix",
        hypothesisId: "H4",
        location: "validate-mongodb-flow.js:main:created_lookup",
        message: "Lookup user immediately after register",
        data: { found: Boolean(created), envDb: MONGODB_DB_NAME, queryDomain: "stargym.local" },
        timestamp: Date.now()
      })
    }).catch(() => {});
    // #endregion
    if (!created) throw new Error("No se encontró el usuario recién creado en MongoDB.");

    await usersCollection.updateOne(
      { id: created.id },
      {
        $set: {
          emailVerified: true,
          verificationTokenHash: null,
          verificationExpiresAt: null,
          wallet: {
            balance: 50,
            currency: "USD",
            transactions: [{
              id: `mongodb-check-funding-${stamp}`,
              type: "TOPUP",
              amount: 50,
              currency: "USD",
              meta: { source: "validation" },
              createdAt: new Date().toISOString()
            }],
            topupIntents: []
          }
        }
      }
    );

    const login = await api("/api/auth/login", { method: "POST", body: { email, password } });
    if (!login.ok || !login.data.token) throw new Error(`Login falló (${login.status}): ${login.data.message || "sin detalle"}`);
    const token = login.data.token;

    const enroll = await api("/api/enrollments/plan", { method: "POST", token, body: { planId: "essential" } });
    if (!enroll.ok) throw new Error(`Enroll falló (${enroll.status}): ${enroll.data.message || "sin detalle"}`);

    const after = await usersCollection.findOne({ id: created.id });
    const balance = after?.wallet?.balance;
    const txCount = Array.isArray(after?.wallet?.transactions) ? after.wallet.transactions.length : 0;
    const enrollCount = Array.isArray(after?.enrollments) ? after.enrollments.length : 0;

    console.log(JSON.stringify({ ok: true, email, balance, transactions: txCount, enrollments: enrollCount }, null, 2));
  } finally {
    await mongoClient.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
