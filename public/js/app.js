// Southern Recipe Book — single-page app (hash routing, no build step).

const CATEGORIES = ["All", "Mains", "Sides", "Breads", "Desserts"];
const CAT_VAR = { Mains: "--cat-mains", Sides: "--cat-sides", Breads: "--cat-breads", Desserts: "--cat-desserts" };

const state = {
  user: null, // { username, favorites: [], hidden: [] }
  recipes: [],
  query: "",
  category: "All",
};

const $ = (sel, root = document) => root.querySelector(sel);
const main = $("#main");

// ---------- Utilities ----------

function esc(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

const catColor = (cat) => `var(${CAT_VAR[cat] || "--accent"})`;

function stars(rating, count) {
  const pct = Math.max(0, Math.min(100, (rating / 5) * 100));
  return `<span class="rating" aria-label="Rated ${rating.toFixed(1)} out of 5 from ${count.toLocaleString()} ratings">
    <span class="stars" aria-hidden="true"><span style="width:${pct}%"></span></span>
    <span>${rating.toFixed(1)} <span aria-hidden="true">(${count.toLocaleString()})</span></span>
  </span>`;
}

const icons = {
  heart: (filled) =>
    `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.5 8 3.6 4.5 7.1 4.5c2 0 3.4 1.1 4.9 2.9 1.5-1.8 2.9-2.9 4.9-2.9 3.5 0 5.6 3.5 4.4 6.8-1.8 4.6-9.3 9.2-9.3 9.2z" fill="${filled ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`,
  hide: `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
  clock: `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l3 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  people: `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="9" cy="8" r="3.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M2.5 20c.6-3.5 3.3-5.5 6.5-5.5s5.9 2 6.5 5.5M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.8c2 .7 3.2 2.5 3.5 5.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  search: `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M20 20l-3.5-3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  back: `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  print: `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M7 9V3h10v6M7 17H4v-6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6h-3M7 14h10v7H7z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`,
};

// ---------- API ----------

async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: "same-origin",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    /* non-JSON error page */
  }
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// ---------- Theme ----------

function getThemePref() {
  try {
    return localStorage.getItem("rb-theme") || "system";
  } catch {
    return "system";
  }
}

function setTheme(pref) {
  document.documentElement.dataset.theme = pref;
  try {
    localStorage.setItem("rb-theme", pref);
  } catch {
    /* storage unavailable — theme still applies for this visit */
  }
  document.querySelectorAll("[data-theme-choice]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.themeChoice === pref)));
}

document.querySelectorAll("[data-theme-choice]").forEach((b) => b.addEventListener("click", () => setTheme(b.dataset.themeChoice)));
setTheme(getThemePref());

// ---------- Toast ----------

let toastTimer;
function toast(msg, action) {
  const el = $("#toast");
  const btn = $("#toast-action");
  $("#toast-msg").textContent = msg;
  if (action) {
    btn.textContent = action.label;
    btn.hidden = false;
    btn.onclick = () => {
      el.hidden = true;
      action.run();
    };
  } else {
    btn.hidden = true;
  }
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 5000);
}

// ---------- Favorites / hidden ----------

const isFav = (id) => state.user?.favorites.includes(id);
const isHidden = (id) => state.user?.hidden.includes(id);

async function setList(list, id, on) {
  const prev = { ...state.user };
  // Optimistic update so the UI feels instant.
  const other = list === "favorites" ? "hidden" : "favorites";
  state.user = {
    ...state.user,
    [list]: on ? [...new Set([...state.user[list], id])] : state.user[list].filter((x) => x !== id),
    [other]: on ? state.user[other].filter((x) => x !== id) : state.user[other],
  };
  render();
  try {
    state.user = await api(`/${list}/${encodeURIComponent(id)}`, { method: on ? "PUT" : "DELETE" });
    updateCounts();
  } catch (err) {
    state.user = prev;
    render();
    if (err.status === 401) return signedOut();
    toast(err.message);
  }
}

function toggleFavorite(id) {
  const on = !isFav(id);
  setList("favorites", id, on);
  toast(on ? "Added to your favorites" : "Removed from favorites");
}

function hideRecipe(id) {
  const r = state.recipes.find((x) => x.id === id);
  setList("hidden", id, true);
  toast(`“${r?.title ?? "Recipe"}” removed from your book`, { label: "Undo", run: () => setList("hidden", id, false) });
}

function restoreRecipe(id) {
  setList("hidden", id, false);
  toast("Recipe restored to your book");
}

// ---------- Views ----------

function updateCounts() {
  if (!state.user) return;
  $("#fav-count").textContent = state.user.favorites.length;
  $("#hidden-count").textContent = state.user.hidden.length;
}

function setActiveNav(name) {
  document.querySelectorAll("[data-nav]").forEach((a) => {
    if (a.dataset.nav === name) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
}

function renderAuth(mode = "login", error = "") {
  document.body.classList.remove("signed-in");
  $("#site-footer").hidden = true;
  const signup = mode === "signup";
  main.innerHTML = `
    <div class="auth-wrap">
      <div class="auth-card">
        <div class="auth-hero gingham">
          <h1>Pull up a chair, y'all.</h1>
          <p>The South's top-rated recipes, all in one book. Sign in to save your favorites.</p>
        </div>
        <div class="auth-body">
          <div class="auth-tabs" role="tablist">
            <button type="button" role="tab" aria-selected="${!signup}" data-mode="login">Sign in</button>
            <button type="button" role="tab" aria-selected="${signup}" data-mode="signup">Create account</button>
          </div>
          <form id="auth-form" novalidate>
            ${error ? `<div class="form-error" role="alert">${esc(error)}</div>` : ""}
            <div class="field">
              <label for="username">Username</label>
              <input class="input" id="username" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required minlength="3" maxlength="24" pattern="[A-Za-z0-9_.\\-]{3,24}" />
              ${signup ? `<div class="hint">3–24 characters: letters, numbers, _ . or -</div>` : ""}
            </div>
            <div class="field">
              <label for="password">Password</label>
              <input class="input" id="password" name="password" type="password" autocomplete="${signup ? "new-password" : "current-password"}" required minlength="${signup ? 8 : 1}" />
              ${signup ? `<div class="hint">At least 8 characters.</div>` : ""}
            </div>
            ${
              signup
                ? `<div class="field">
                    <label for="confirm">Confirm password</label>
                    <input class="input" id="confirm" name="confirm" type="password" autocomplete="new-password" required />
                  </div>`
                : ""
            }
            <button class="btn btn-primary" type="submit">${signup ? "Create my account" : "Sign in"}</button>
          </form>
        </div>
      </div>
    </div>`;

  main.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => renderAuth(b.dataset.mode)));
  const form = $("#auth-form");
  $("#username").focus();
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = form.username.value.trim();
    const password = form.password.value;
    if (!/^[A-Za-z0-9_.-]{3,24}$/.test(username)) return renderAuthError(mode, "Username must be 3–24 characters: letters, numbers, _ . or -", username);
    if (signup && password.length < 8) return renderAuthError(mode, "Password must be at least 8 characters.", username);
    if (signup && password !== form.confirm.value) return renderAuthError(mode, "Passwords don't match.", username);
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    btn.textContent = signup ? "Creating account…" : "Signing in…";
    try {
      state.user = await api(signup ? "/signup" : "/login", { method: "POST", body: { username, password } });
      signedIn();
      if (signup) toast(`Welcome, ${state.user.username}! Tap ♥ to save recipes you love.`);
    } catch (err) {
      renderAuthError(mode, err.message, username);
    }
  });
}

function renderAuthError(mode, msg, username) {
  renderAuth(mode, msg);
  $("#username").value = username || "";
  $(username ? "#password" : "#username").focus();
}

function cardHTML(r, { hiddenView = false } = {}) {
  const fav = isFav(r.id);
  return `
    <article class="card">
      <div class="card-top gingham" style="--c:${catColor(r.category)}">
        <span class="cat-tag" style="--c:${catColor(r.category)}">${esc(r.category)}</span>
        ${
          hiddenView
            ? ""
            : `<div class="card-actions">
                <button type="button" class="icon-btn ${fav ? "is-fav" : ""}" data-fav="${r.id}" aria-pressed="${fav}" aria-label="${fav ? "Remove from" : "Add to"} favorites: ${esc(r.title)}" title="${fav ? "Remove from favorites" : "Add to favorites"}">${icons.heart(fav)}</button>
                <button type="button" class="icon-btn" data-hide="${r.id}" aria-label="Not for me — remove ${esc(r.title)}" title="Not for me — remove from my book">${icons.hide}</button>
              </div>`
        }
      </div>
      <div class="card-body">
        <h2 class="card-title"><a href="#/recipe/${r.id}">${esc(r.title)}</a></h2>
        ${stars(r.rating, r.ratingCount)}
        <p class="card-desc">${esc(r.description)}</p>
        <div class="card-meta">
          <span>${icons.clock} ${esc(r.totalTime)}</span>
          <span>${icons.people} ${esc(r.servings)}</span>
        </div>
        <div class="card-source">by ${esc(r.author)} · ${esc(r.sourceName)}</div>
        ${hiddenView ? `<button type="button" class="btn btn-ghost btn-sm restore-btn" data-restore="${r.id}">Restore to my book</button>` : ""}
      </div>
    </article>`;
}

function bindCardActions(root) {
  root.querySelectorAll("[data-fav]").forEach((b) => b.addEventListener("click", () => toggleFavorite(b.dataset.fav)));
  root.querySelectorAll("[data-hide]").forEach((b) => b.addEventListener("click", () => hideRecipe(b.dataset.hide)));
  root.querySelectorAll("[data-restore]").forEach((b) => b.addEventListener("click", () => restoreRecipe(b.dataset.restore)));
}

function filtered(list) {
  const q = state.query.trim().toLowerCase();
  return list.filter((r) => {
    if (state.category !== "All" && r.category !== state.category) return false;
    if (!q) return true;
    return [r.title, r.description, r.author, r.sourceName, r.category, ...r.ingredients].join(" ").toLowerCase().includes(q);
  });
}

function renderList(view) {
  setActiveNav(view);
  const titles = {
    all: ["Southern Classics", "Top-rated recipes from across the web, collected into one book."],
    favorites: ["Your Favorites", "The recipes you've hearted. Tap ♥ again to remove one."],
    hidden: ["Hidden Recipes", "Recipes you said weren't for you. Restore any to put it back in your book."],
  };
  let base;
  if (view === "favorites") base = state.recipes.filter((r) => isFav(r.id));
  else if (view === "hidden") base = state.recipes.filter((r) => isHidden(r.id));
  else base = state.recipes.filter((r) => !isHidden(r.id));
  const list = filtered(base);

  // Keep focus in the search box while typing.
  const hadSearchFocus = document.activeElement?.id === "search";
  const caret = hadSearchFocus ? document.activeElement.selectionStart : null;

  const [title, sub] = titles[view];
  main.innerHTML = `
    <div class="page-head">
      <div><h1>${title}</h1><p>${sub}</p></div>
    </div>
    <div class="toolbar">
      <label class="search">
        ${icons.search}
        <input class="input" id="search" type="search" placeholder="Search recipes or ingredients…" value="${esc(state.query)}" aria-label="Search recipes or ingredients" />
      </label>
      <div class="chips" role="group" aria-label="Filter by category">
        ${CATEGORIES.map((c) => `<button type="button" class="chip" data-cat="${c}" aria-pressed="${state.category === c}">${c}</button>`).join("")}
      </div>
    </div>
    ${list.length ? `<div class="grid">${list.map((r) => cardHTML(r, { hiddenView: view === "hidden" })).join("")}</div>` : emptyHTML(view, base.length)}
  `;

  const search = $("#search");
  search.addEventListener("input", () => {
    state.query = search.value;
    renderList(view);
  });
  if (hadSearchFocus) {
    search.focus();
    search.setSelectionRange(caret, caret);
  }
  main.querySelectorAll("[data-cat]").forEach((b) =>
    b.addEventListener("click", () => {
      state.category = b.dataset.cat;
      renderList(view);
    }),
  );
  bindCardActions(main);
}

function emptyHTML(view, baseCount) {
  if (baseCount > 0) {
    return `<div class="empty"><h2>No matches</h2><p>Try a different search or category.</p></div>`;
  }
  if (view === "favorites") {
    return `<div class="empty"><h2>No favorites yet</h2><p>Tap the ♥ on any recipe to save it here.</p><p><a class="btn btn-primary" href="#/">Browse recipes</a></p></div>`;
  }
  if (view === "hidden") {
    return `<div class="empty"><h2>Nothing hidden</h2><p>Recipes you remove with ✕ will show up here so you can bring them back.</p></div>`;
  }
  return `<div class="empty"><h2>Your book is empty</h2><p>You've hidden every recipe. Visit <a href="#/hidden">Hidden</a> to restore some.</p></div>`;
}

function renderRecipe(id) {
  setActiveNav(null);
  const r = state.recipes.find((x) => x.id === id);
  if (!r) {
    main.innerHTML = `<div class="empty"><h2>Recipe not found</h2><p><a href="#/">Back to all recipes</a></p></div>`;
    return;
  }
  const fav = isFav(r.id);
  const hidden = isHidden(r.id);
  const checked = loadChecks(r.id);
  main.innerHTML = `
    <a class="back-link" href="#/">${icons.back} All recipes</a>
    <article class="sheet">
      <header class="sheet-hero gingham" style="--c:${catColor(r.category)}">
        <div class="cat-label">${esc(r.category)}</div>
        <h1>${esc(r.title)}</h1>
        <p>${esc(r.description)}</p>
        ${stars(r.rating, r.ratingCount)}
      </header>
      <div class="sheet-bar">
        <dl class="facts">
          <div><dt>Prep</dt><dd>${esc(r.prepTime)}</dd></div>
          <div><dt>Cook</dt><dd>${esc(r.cookTime)}</dd></div>
          <div><dt>Total</dt><dd>${esc(r.totalTime)}</dd></div>
          <div><dt>Serves</dt><dd>${esc(r.servings)}</dd></div>
        </dl>
        <div class="sheet-buttons">
          <button type="button" class="btn btn-ghost btn-sm ${fav ? "is-fav" : ""}" data-fav="${r.id}" aria-pressed="${fav}">${icons.heart(fav)} ${fav ? "Favorited" : "Favorite"}</button>
          ${
            hidden
              ? `<button type="button" class="btn btn-ghost btn-sm" data-restore="${r.id}">Restore</button>`
              : `<button type="button" class="btn btn-ghost btn-sm" data-hide="${r.id}">${icons.hide} Not for me</button>`
          }
          <button type="button" class="btn btn-ghost btn-sm" id="print-btn">${icons.print} Print</button>
        </div>
      </div>
      <div class="sheet-content">
        <section class="ingredients" aria-labelledby="ing-h">
          <h2 id="ing-h">Ingredients <small>${r.ingredients.length} items</small></h2>
          <ul class="ing-list">
            ${r.ingredients
              .map(
                (ing, i) =>
                  `<li><label><input type="checkbox" data-ing="${i}" ${checked.ing.includes(i) ? "checked" : ""} /><span>${esc(ing)}</span></label></li>`,
              )
              .join("")}
          </ul>
        </section>
        <section aria-labelledby="steps-h">
          <h2 id="steps-h">Instructions <small>Tap a step to mark it done</small></h2>
          <ol class="steps">
            ${r.instructions.map((s, i) => `<li data-step="${i}" class="${checked.steps.includes(i) ? "done" : ""}" tabindex="0">${esc(s)}</li>`).join("")}
          </ol>
          ${
            r.notes?.length
              ? `<aside class="notes"><h3>Cook's notes</h3><ul>${r.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul></aside>`
              : ""
          }
        </section>
      </div>
      <footer class="attribution">
        Recipe by <strong>${esc(r.author)}</strong> · Originally published at
        <a href="${esc(r.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(r.sourceName)}</a>.
        Visit the original for photos, videos and the full story.
      </footer>
    </article>`;

  bindCardActions(main);
  $("#print-btn").addEventListener("click", () => window.print());
  main.querySelectorAll("[data-ing]").forEach((cb) => cb.addEventListener("change", () => saveChecks(r.id)));
  main.querySelectorAll("[data-step]").forEach((li) => {
    const toggle = () => {
      li.classList.toggle("done");
      saveChecks(r.id);
    };
    li.addEventListener("click", toggle);
    li.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    });
  });
}

// Cooking progress (checked ingredients / finished steps) is a per-device convenience.
function loadChecks(id) {
  try {
    return JSON.parse(sessionStorage.getItem(`rb-checks-${id}`)) || { ing: [], steps: [] };
  } catch {
    return { ing: [], steps: [] };
  }
}
function saveChecks(id) {
  const ing = [...main.querySelectorAll("[data-ing]:checked")].map((c) => Number(c.dataset.ing));
  const steps = [...main.querySelectorAll("[data-step].done")].map((l) => Number(l.dataset.step));
  try {
    sessionStorage.setItem(`rb-checks-${id}`, JSON.stringify({ ing, steps }));
  } catch {
    /* ignore */
  }
}

// ---------- Routing ----------

function render() {
  if (!state.user) return renderAuth();
  updateCounts();
  const hash = location.hash.replace(/^#/, "") || "/";
  const recipeMatch = hash.match(/^\/recipe\/([a-z0-9-]+)$/);
  if (recipeMatch) return renderRecipe(recipeMatch[1]);
  if (hash === "/favorites") return renderList("favorites");
  if (hash === "/hidden") return renderList("hidden");
  return renderList("all");
}

let lastHash = location.hash;
window.addEventListener("hashchange", () => {
  const goingToRecipe = location.hash.startsWith("#/recipe/");
  // Switching between All / Favorites / Hidden starts with a clean search.
  if (!goingToRecipe && !lastHash.startsWith("#/recipe/")) {
    state.query = "";
    state.category = "All";
  }
  render();
  if (goingToRecipe || lastHash.startsWith("#/recipe/")) {
    window.scrollTo(0, 0);
    main.focus({ preventScroll: true });
  }
  lastHash = location.hash;
});

function signedIn() {
  document.body.classList.add("signed-in");
  $("#user-name").textContent = state.user.username;
  $("#site-footer").hidden = false;
  render();
}

function signedOut() {
  state.user = null;
  state.query = "";
  state.category = "All";
  renderAuth("login", "Your session ended. Please sign in again.");
}

$("#logout-btn").addEventListener("click", async () => {
  try {
    await api("/logout", { method: "POST" });
  } catch {
    /* cookie is cleared server-side; ignore network errors */
  }
  state.user = null;
  state.query = "";
  state.category = "All";
  history.replaceState(null, "", "#/");
  renderAuth();
});

// ---------- Boot ----------

(async function boot() {
  try {
    const res = await fetch("/data/recipes.json");
    state.recipes = await res.json();
  } catch {
    main.innerHTML = `<div class="empty"><h2>Couldn't load recipes</h2><p>Please refresh the page.</p></div>`;
    return;
  }
  try {
    state.user = await api("/me");
    signedIn();
  } catch {
    renderAuth();
  }
})();
