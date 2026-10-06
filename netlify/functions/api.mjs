// Recipe Book API — runs as a single Netlify Function at /api/*.
// Users, password hashes, per-user favorites/hidden lists and the recipe catalog live in
// Netlify Blobs, so there is no external database to set up.
import { getStore } from "@netlify/blobs";
import { scrypt, randomBytes, timingSafeEqual, createHmac } from "node:crypto";
import { promisify } from "node:util";
import seedRecipes from "../../data/recipes.json" with { type: "json" };

const scryptAsync = promisify(scrypt);

const COOKIE_NAME = "rb_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,24}$/;
const RECIPE_ID_RE = /^[a-z0-9-]{1,80}$/;
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 200;
const CATEGORIES = ["Mains", "Sides", "Breads", "Desserts"];
const RECIPES_KEY = "recipes/all";
const MAX_AVATAR_BYTES = 512 * 1024;
const MAX_DISPLAY_NAME = 40;
const MAX_BIO = 280;

const store = () => getStore({ name: "recipe-book", consistency: "strong" });

// Admins are configured in Netlify (Site configuration → Environment variables),
// e.g. ADMIN_USERS=sharaspec,another_admin. Nobody can promote themselves from the app.
const adminSet = () =>
  new Set(
    (process.env.ADMIN_USERS || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
const isAdmin = (username) => adminSet().has(String(username).toLowerCase());

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
    await s.set("config/session-secret", b64url(randomBytes(48)), { onlyIfNew: true });
    secret = await s.get("config/session-secret");
  }
  cachedSecret = secret;
  return secret;
}

// Tokens carry the user's session version, so a password reset signs out old sessions.
async function signToken(user) {
  const payload = b64url(
    JSON.stringify({ u: user.username, v: user.sessionVersion || 0, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS }),
  );
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
    return { username: data.u, version: data.v || 0 };
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

const validPassword = (p) => typeof p === "string" && p.length >= MIN_PASSWORD && p.length <= MAX_PASSWORD;
const userKey = (username) => `users/${String(username).toLowerCase()}`;
const avatarKey = (username) => `avatars/${String(username).toLowerCase()}`;

// Everything the signed-in user may see about their own account.
const publicUser = (u) => ({
  username: u.username,
  displayName: u.displayName || "",
  bio: u.bio || "",
  avatarVersion: u.avatarVersion || null,
  shareFavorites: !!u.shareFavorites,
  createdAt: u.createdAt || null,
  favorites: u.favorites || [],
  hidden: u.hidden || [],
  isAdmin: isAdmin(u.username),
});

// Strip control characters and collapse whitespace in short free-text fields.
const cleanText = (v, max, { multiline = false } = {}) => {
  if (typeof v !== "string") return "";
  let t = v.replace(/\r\n?/g, "\n").replace(multiline ? /[\u0000-\u0009\u000B-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g, " ");
  t = multiline ? t.replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n") : t.replace(/\s+/g, " ");
  return t.trim().slice(0, max);
};

// Accept only real JPEG / PNG / WebP images, checked by their file signature.
function imageType(buf) {
  const b = new Uint8Array(buf.slice(0, 12));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

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
  const session = await verifyToken(readCookie(req, COOKIE_NAME));
  if (!session) return null;
  const user = await store().get(userKey(session.username), { type: "json" });
  if (!user || (user.sessionVersion || 0) !== session.version) return null;
  return user;
}

async function allUsers() {
  const s = store();
  const { blobs } = await s.list({ prefix: "users/" });
  const users = await Promise.all(blobs.map((b) => s.get(b.key, { type: "json" })));
  return users.filter(Boolean);
}

// ---------- recipes ----------

async function getRecipes() {
  const saved = await store().get(RECIPES_KEY, { type: "json" });
  return saved || seedRecipes;
}

const saveRecipes = (recipes) => store().setJSON(RECIPES_KEY, recipes);

const slugify = (s) =>
  String(s)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "recipe";

const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const strList = (v, maxItems, maxLen) =>
  (Array.isArray(v) ? v : typeof v === "string" ? v.split("\n") : [])
    .map((x) => str(x, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);

// Returns { recipe } or { error }.
function cleanRecipe(input) {
  const r = {
    title: str(input.title, 120),
    category: str(input.category, 20),
    description: str(input.description, 600),
    author: str(input.author, 80),
    sourceName: str(input.sourceName, 80),
    sourceUrl: str(input.sourceUrl, 500),
    prepTime: str(input.prepTime, 40),
    cookTime: str(input.cookTime, 40),
    totalTime: str(input.totalTime, 40),
    servings: str(input.servings, 40),
    ingredients: strList(input.ingredients, 80, 300),
    instructions: strList(input.instructions, 60, 1500),
    notes: strList(input.notes, 30, 600),
  };
  const rating = Number(input.rating);
  const ratingCount = Number(input.ratingCount);
  r.rating = Number.isFinite(rating) && input.rating !== "" && input.rating != null ? Math.min(5, Math.max(0, rating)) : null;
  r.ratingCount = Number.isFinite(ratingCount) && ratingCount > 0 ? Math.floor(ratingCount) : 0;

  if (!r.title) return { error: "Title is required." };
  if (!CATEGORIES.includes(r.category)) return { error: `Category must be one of: ${CATEGORIES.join(", ")}.` };
  if (!r.ingredients.length) return { error: "Add at least one ingredient." };
  if (!r.instructions.length) return { error: "Add at least one instruction step." };
  if (r.sourceUrl && !/^https?:\/\//i.test(r.sourceUrl)) return { error: "Source URL must start with http:// or https://" };
  return { recipe: r };
}

// Public teaser for the landing page: summary fields only, never ingredients or steps.
async function previewRecipes() {
  const recipes = await getRecipes();
  return json(
    200,
    recipes.map(({ id, title, category, description, rating, ratingCount, totalTime, servings, sourceName }) => ({
      id,
      title,
      category,
      description,
      rating,
      ratingCount,
      totalTime,
      servings,
      sourceName,
    })),
    { "cache-control": "public, max-age=300" },
  );
}

async function listRecipes() {
  return json(200, await getRecipes());
}

async function createRecipe(req) {
  const { recipe, error } = cleanRecipe(await readBody(req));
  if (error) return json(400, { error });
  const recipes = await getRecipes();
  const base = slugify(recipe.title);
  let id = base;
  for (let n = 2; recipes.some((r) => r.id === id); n++) id = `${base}-${n}`;
  const created = { id, ...recipe };
  await saveRecipes([...recipes, created]);
  return json(201, created);
}

async function updateRecipe(req, id) {
  const { recipe, error } = cleanRecipe(await readBody(req));
  if (error) return json(400, { error });
  const recipes = await getRecipes();
  const i = recipes.findIndex((r) => r.id === id);
  if (i === -1) return json(404, { error: "Recipe not found." });
  recipes[i] = { id, ...recipe };
  await saveRecipes(recipes);
  return json(200, recipes[i]);
}

async function deleteRecipe(id) {
  const recipes = await getRecipes();
  if (!recipes.some((r) => r.id === id)) return json(404, { error: "Recipe not found." });
  await saveRecipes(recipes.filter((r) => r.id !== id));
  return json(200, { ok: true });
}

// ---------- admin: users & stats ----------

async function listUsers() {
  const users = await allUsers();
  users.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  return json(
    200,
    users.map((u) => ({
      username: u.username,
      displayName: u.displayName || "",
      avatarVersion: u.avatarVersion || null,
      createdAt: u.createdAt,
      favorites: (u.favorites || []).length,
      hidden: (u.hidden || []).length,
      isAdmin: isAdmin(u.username),
    })),
  );
}

async function deleteUser(admin, username) {
  if (username.toLowerCase() === admin.username.toLowerCase()) {
    return json(400, { error: "You can't delete your own account from the admin page." });
  }
  const s = store();
  if (!(await s.get(userKey(username)))) return json(404, { error: "User not found." });
  await Promise.all([s.delete(userKey(username)), s.delete(avatarKey(username))]);
  return json(200, { ok: true });
}

async function resetPassword(req, username) {
  const { password } = await readBody(req);
  if (!validPassword(password)) return json(400, { error: `Password must be at least ${MIN_PASSWORD} characters.` });
  const s = store();
  const user = await s.get(userKey(username), { type: "json" });
  if (!user) return json(404, { error: "User not found." });
  Object.assign(user, await hashPassword(password));
  user.sessionVersion = (user.sessionVersion || 0) + 1; // sign the user out everywhere
  await s.setJSON(userKey(username), user);
  return json(200, { ok: true });
}

async function stats() {
  const [users, recipes] = await Promise.all([allUsers(), getRecipes()]);
  const fav = {};
  const hid = {};
  for (const u of users) {
    for (const id of u.favorites || []) fav[id] = (fav[id] || 0) + 1;
    for (const id of u.hidden || []) hid[id] = (hid[id] || 0) + 1;
  }
  const perRecipe = recipes.map((r) => ({ id: r.id, title: r.title, category: r.category, favorites: fav[r.id] || 0, hidden: hid[r.id] || 0 }));
  return json(200, {
    users: users.length,
    recipes: recipes.length,
    favorites: Object.values(fav).reduce((a, b) => a + b, 0),
    hidden: Object.values(hid).reduce((a, b) => a + b, 0),
    recipeStats: perRecipe,
  });
}

// ---------- profile ----------

async function updateProfile(req, user) {
  const body = await readBody(req);
  if ("displayName" in body) user.displayName = cleanText(body.displayName, MAX_DISPLAY_NAME);
  if ("bio" in body) user.bio = cleanText(body.bio, MAX_BIO, { multiline: true });
  if ("shareFavorites" in body) user.shareFavorites = body.shareFavorites === true;
  await store().setJSON(userKey(user.username), user);
  return json(200, publicUser(user));
}

async function uploadAvatar(req, user) {
  const buf = await req.arrayBuffer();
  if (!buf.byteLength) return json(400, { error: "No image received." });
  if (buf.byteLength > MAX_AVATAR_BYTES) return json(413, { error: "That image is too large. Please pick one under 512 KB." });
  const contentType = imageType(buf);
  if (!contentType) return json(400, { error: "Please upload a JPEG, PNG or WebP image." });
  const s = store();
  await s.set(avatarKey(user.username), buf, { metadata: { contentType } });
  user.avatarVersion = Date.now();
  await s.setJSON(userKey(user.username), user);
  return json(200, publicUser(user));
}

async function removeAvatar(user) {
  const s = store();
  await s.delete(avatarKey(user.username));
  user.avatarVersion = null;
  await s.setJSON(userKey(user.username), user);
  return json(200, publicUser(user));
}

// Photos are visible to the owner, admins, and — when the owner shares their favorites — anyone.
async function getAvatar(req, username) {
  const s = store();
  const owner = await s.get(userKey(username), { type: "json" });
  if (!owner || !owner.avatarVersion) return json(404, { error: "No photo." });
  if (!owner.shareFavorites) {
    const viewer = await currentUser(req);
    const allowed = viewer && (viewer.username.toLowerCase() === owner.username.toLowerCase() || isAdmin(viewer.username));
    if (!allowed) return json(404, { error: "No photo." });
  }
  const blob = await s.getWithMetadata(avatarKey(username), { type: "arrayBuffer" });
  if (!blob) return json(404, { error: "No photo." });
  return new Response(blob.data, {
    status: 200,
    headers: {
      "content-type": blob.metadata?.contentType || "image/jpeg",
      "cache-control": owner.shareFavorites ? "public, max-age=86400" : "private, max-age=86400",
      "x-content-type-options": "nosniff",
    },
  });
}

async function changePassword(req, user) {
  const { currentPassword, newPassword } = await readBody(req);
  if (typeof currentPassword !== "string" || !(await checkPassword(currentPassword, user))) {
    return json(400, { error: "Your current password is incorrect." });
  }
  if (!validPassword(newPassword)) return json(400, { error: `New password must be at least ${MIN_PASSWORD} characters.` });
  Object.assign(user, await hashPassword(newPassword));
  user.sessionVersion = (user.sessionVersion || 0) + 1; // signs out every other device
  await store().setJSON(userKey(user.username), user);
  // Keep this device signed in with a fresh session.
  return json(200, publicUser(user), { "set-cookie": sessionCookie(req, await signToken(user), SESSION_TTL_SECONDS) });
}

async function deleteOwnAccount(req, user) {
  const { password } = await readBody(req);
  if (typeof password !== "string" || !(await checkPassword(password, user))) {
    return json(400, { error: "Password is incorrect." });
  }
  const s = store();
  await Promise.all([s.delete(userKey(user.username)), s.delete(avatarKey(user.username))]);
  return json(200, { ok: true }, { "set-cookie": sessionCookie(req, "", 0) });
}

// Public, read-only favorites page — only for users who turned sharing on.
async function sharedFavorites(username) {
  const [owner, recipes] = await Promise.all([store().get(userKey(username), { type: "json" }), getRecipes()]);
  if (!owner || !owner.shareFavorites) return json(404, { error: "This favorites list isn't shared." });
  const favs = new Set(owner.favorites || []);
  return json(200, {
    username: owner.username,
    displayName: owner.displayName || "",
    bio: owner.bio || "",
    avatarVersion: owner.avatarVersion || null,
    recipes: recipes.filter((r) => favs.has(r.id)),
  });
}

// ---------- auth & user routes ----------

async function signup(req) {
  const { username = "", password = "" } = await readBody(req);
  if (!USERNAME_RE.test(username)) {
    return json(400, { error: "Username must be 3-24 characters: letters, numbers, _ . or -" });
  }
  if (!validPassword(password)) return json(400, { error: `Password must be at least ${MIN_PASSWORD} characters.` });
  const user = { username, ...(await hashPassword(password)), favorites: [], hidden: [], sessionVersion: 0, createdAt: new Date().toISOString() };
  const result = await store().setJSON(userKey(username), user, { onlyIfNew: true });
  if (result && result.modified === false) {
    return json(409, { error: "That username is already taken." });
  }
  return json(201, publicUser(user), { "set-cookie": sessionCookie(req, await signToken(user), SESSION_TTL_SECONDS) });
}

async function login(req) {
  const { username = "", password = "" } = await readBody(req);
  const user = USERNAME_RE.test(username) ? await store().get(userKey(username), { type: "json" }) : null;
  if (!user || typeof password !== "string" || !(await checkPassword(password, user))) {
    return json(401, { error: "Wrong username or password." });
  }
  return json(200, publicUser(user), { "set-cookie": sessionCookie(req, await signToken(user), SESSION_TTL_SECONDS) });
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

// ---------- router ----------

export default async (req) => {
  const path = new URL(req.url).pathname.replace(/^\/(\.netlify\/functions\/api|api)/, "").replace(/\/+$/, "");
  const method = req.method;

  if (method !== "GET" && !sameOrigin(req)) return json(403, { error: "Forbidden" });

  try {
    if (path === "/signup" && method === "POST") return await signup(req);
    if (path === "/login" && method === "POST") return await login(req);
    if (path === "/logout" && method === "POST") return logout(req);

    if (path === "/preview" && method === "GET") return await previewRecipes();

    let m = path.match(/^\/shared\/([a-zA-Z0-9_.-]{3,24})$/);
    if (m && method === "GET") return await sharedFavorites(m[1]);
    m = path.match(/^\/avatar\/([a-zA-Z0-9_.-]{3,24})$/);
    if (m && method === "GET") return await getAvatar(req, m[1]);

    const user = await currentUser(req);
    if (!user) return json(401, { error: "Not signed in." });

    if (path === "/me" && method === "GET") return json(200, publicUser(user));
    if (path === "/recipes" && method === "GET") return await listRecipes();

    if (path === "/profile" && method === "PUT") return await updateProfile(req, user);
    if (path === "/profile" && method === "DELETE") return await deleteOwnAccount(req, user);
    if (path === "/profile/avatar" && method === "PUT") return await uploadAvatar(req, user);
    if (path === "/profile/avatar" && method === "DELETE") return await removeAvatar(user);
    if (path === "/profile/password" && method === "POST") return await changePassword(req, user);

    m = path.match(/^\/(favorites|hidden)\/([^/]+)$/);
    if (m && (method === "PUT" || method === "DELETE")) {
      return await updateList(req, user, m[1], decodeURIComponent(m[2]));
    }

    if (path.startsWith("/admin/")) {
      if (!isAdmin(user.username)) return json(403, { error: "Admins only." });

      if (path === "/admin/recipes" && method === "POST") return await createRecipe(req);
      m = path.match(/^\/admin\/recipes\/([a-z0-9-]{1,80})$/);
      if (m && method === "PUT") return await updateRecipe(req, m[1]);
      if (m && method === "DELETE") return await deleteRecipe(m[1]);

      if (path === "/admin/users" && method === "GET") return await listUsers();
      m = path.match(/^\/admin\/users\/([a-zA-Z0-9_.-]{3,24})(\/password)?$/);
      if (m && !m[2] && method === "DELETE") return await deleteUser(user, m[1]);
      if (m && m[2] && method === "POST") return await resetPassword(req, m[1]);

      if (path === "/admin/stats" && method === "GET") return await stats();
    }
    return json(404, { error: "Not found" });
  } catch (err) {
    console.error(err);
    return json(500, { error: "Something went wrong. Please try again." });
  }
};

export const config = { path: "/api/*" };
