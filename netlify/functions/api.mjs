// Recipe Book API — runs as a single Netlify Function at /api/*.
// Users, password hashes and per-user favorites/hidden lists live in Netlify Blobs,
// so there is no external database to set up.
import { getStore } from "@netlify/blobs";
import { scrypt, randomBytes, timingSafeEqual, createHmac } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

const COOKIE_NAME = "rb_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,24}$/;
const RECIPE_ID_RE = /^[a-z0-9-]{1,80}$/;
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 200;

const store = () => getStore({ name: "recipe-book", consistency: "strong" });

// ---------- helpers ----------

const json = (status, body, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...headers },
  });

const b64url = (buf) => Buffer.from(buf).toString("base64url");

let cachedSecret;
async function getSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (cachedSecret) return cachedSecret;
  // No secret configured: generate one once and keep it in Blobs.
  const s = store();
  let secret = await s.get("config/session-secret");
  if (!secret) {
    secret = b64url(randomBytes(48));
    await s.set("config/session-secret", secret, { onlyIfNew: true });
    secret = await s.get("config/session-secret");
  }
  cachedSecret = secret;
  return secret;
}

async function signToken(username) {
  const payload = b64url(JSON.stringify({ u: username, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS }));
  const sig = createHmac("sha256", await getSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

async function verifyToken(token) {
  if (!token || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  const expected = createHmac("sha256", await getSecret()).update(payload).digest();
  const given = Buffer.from(sig || "", "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (!data.u || data.exp < Math.floor(Date.now() / 1000)) return null;
    return data.u;
  } catch {
    return null;
  }
}

function readCookie(req, name) {
  const header = req.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

function sessionCookie(req, value, maxAge) {
  const secure = new URL(req.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

async function hashPassword(password, salt = randomBytes(16)) {
  const hash = await scryptAsync(password, salt, 64);
  return { salt: b64url(salt), hash: b64url(hash) };
}

async function checkPassword(password, user) {
  const hash = await scryptAsync(password, Buffer.from(user.salt, "base64url"), 64);
  const stored = Buffer.from(user.hash, "base64url");
  return stored.length === hash.length && timingSafeEqual(stored, hash);
}

const userKey = (username) => `users/${username.toLowerCase()}`;
const publicUser = (u) => ({ username: u.username, favorites: u.favorites || [], hidden: u.hidden || [] });

async function readBody(req) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

// Reject cross-site writes: browsers always send Origin on POST/PUT/DELETE fetches.
function sameOrigin(req) {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(req.url).host;
  } catch {
    return false;
  }
}

async function currentUser(req) {
  const username = await verifyToken(readCookie(req, COOKIE_NAME));
  if (!username) return null;
  const user = await store().get(userKey(username), { type: "json" });
  return user || null;
}

// ---------- route handlers ----------

async function signup(req) {
  const { username = "", password = "" } = await readBody(req);
  if (!USERNAME_RE.test(username)) {
    return json(400, { error: "Username must be 3-24 characters: letters, numbers, _ . or -" });
  }
  if (typeof password !== "string" || password.length < MIN_PASSWORD || password.length > MAX_PASSWORD) {
    return json(400, { error: `Password must be at least ${MIN_PASSWORD} characters.` });
  }
  const { salt, hash } = await hashPassword(password);
  const user = { username, salt, hash, favorites: [], hidden: [], createdAt: new Date().toISOString() };
  const result = await store().setJSON(userKey(username), user, { onlyIfNew: true });
  if (result && result.modified === false) {
    return json(409, { error: "That username is already taken." });
  }
  return json(201, publicUser(user), { "set-cookie": sessionCookie(req, await signToken(username), SESSION_TTL_SECONDS) });
}

async function login(req) {
  const { username = "", password = "" } = await readBody(req);
  const user = USERNAME_RE.test(username) ? await store().get(userKey(username), { type: "json" }) : null;
  if (!user || typeof password !== "string" || !(await checkPassword(password, user))) {
    return json(401, { error: "Wrong username or password." });
  }
  return json(200, publicUser(user), {
    "set-cookie": sessionCookie(req, await signToken(user.username), SESSION_TTL_SECONDS),
  });
}

function logout(req) {
  return json(200, { ok: true }, { "set-cookie": sessionCookie(req, "", 0) });
}

// PUT/DELETE /api/{favorites|hidden}/:recipeId
async function updateList(req, user, list, recipeId) {
  if (!RECIPE_ID_RE.test(recipeId)) return json(400, { error: "Invalid recipe id." });
  const set = new Set(user[list] || []);
  if (req.method === "PUT") set.add(recipeId);
  else set.delete(recipeId);
  user[list] = [...set];
  // Hiding a recipe also un-favorites it, and favoriting un-hides it.
  if (req.method === "PUT") {
    const other = list === "favorites" ? "hidden" : "favorites";
    user[other] = (user[other] || []).filter((id) => id !== recipeId);
  }
  await store().setJSON(userKey(user.username), user);
  return json(200, publicUser(user));
}

export default async (req) => {
  const path = new URL(req.url).pathname.replace(/^\/(\.netlify\/functions\/api|api)/, "").replace(/\/+$/, "");
  const method = req.method;

  if (method !== "GET" && !sameOrigin(req)) return json(403, { error: "Forbidden" });

  try {
    if (path === "/signup" && method === "POST") return await signup(req);
    if (path === "/login" && method === "POST") return await login(req);
    if (path === "/logout" && method === "POST") return logout(req);

    const user = await currentUser(req);
    if (!user) return json(401, { error: "Not signed in." });

    if (path === "/me" && method === "GET") return json(200, publicUser(user));

    const m = path.match(/^\/(favorites|hidden)\/([^/]+)$/);
    if (m && (method === "PUT" || method === "DELETE")) {
      return await updateList(req, user, m[1], decodeURIComponent(m[2]));
    }
    return json(404, { error: "Not found" });
  } catch (err) {
    console.error(err);
    return json(500, { error: "Something went wrong. Please try again." });
  }
};

export const config = { path: "/api/*" };
