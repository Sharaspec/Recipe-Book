// Admin page: manage recipes, users, and see usage stats.
// Rendered by app.js for #/admin routes; the server enforces admin access on every /api/admin call.
import { avatarHTML } from "./profile.js";

export function renderAdmin(hash, h) {
  const edit = hash.match(/^\/admin\/recipe\/(new|[a-z0-9-]+)$/);
  if (edit) return renderRecipeForm(edit[1], h);
  if (hash === "/admin/users") return renderUsers(h);
  if (hash === "/admin/stats") return renderStats(h);
  return renderRecipes(h);
}

function shell(h, tab, body) {
  const tabs = [
    ["recipes", "#/admin", "Recipes"],
    ["users", "#/admin/users", "Users"],
    ["stats", "#/admin/stats", "Stats"],
  ];
  h.main.innerHTML = `
    <div class="page-head">
      <div><h1>Admin</h1><p>Manage the recipe book, its users, and see what people love.</p></div>
    </div>
    <nav class="admin-tabs" aria-label="Admin sections">
      ${tabs.map(([key, href, label]) => `<a href="${href}" ${key === tab ? 'aria-current="page"' : ""}>${label}</a>`).join("")}
    </nav>
    <div id="admin-body">${body}</div>`;
  return h.main.querySelector("#admin-body");
}

function handleError(h, err) {
  if (err.status === 401) return h.onUnauthorized();
  h.toast(err.message);
}

const fmtDate = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

// ---------- Recipes ----------

function renderRecipes(h) {
  const { esc, state } = h;
  const recipes = [...state.recipes].sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title));
  const body = shell(
    h,
    "recipes",
    `
    <div class="admin-toolbar">
      <span class="muted">${recipes.length} recipe${recipes.length === 1 ? "" : "s"}</span>
      <a class="btn btn-primary" href="#/admin/recipe/new">+ New recipe</a>
    </div>
    <div class="admin-list">
      ${recipes
        .map(
          (r) => `
        <div class="admin-row">
          <span class="dot" style="background:${h.catColor(r.category)}" aria-hidden="true"></span>
          <div class="admin-row-main">
            <a href="#/recipe/${r.id}" class="admin-row-title">${esc(r.title)}</a>
            <div class="muted small">${esc(r.category)}${r.sourceName ? ` · ${esc(r.sourceName)}` : ""}</div>
          </div>
          <div class="admin-row-actions">
            <a class="btn btn-ghost btn-sm" href="#/admin/recipe/${r.id}">Edit</a>
            <button type="button" class="btn btn-ghost btn-sm btn-danger" data-delete-recipe="${r.id}">Delete</button>
          </div>
        </div>`,
        )
        .join("")}
    </div>`,
  );

  body.querySelectorAll("[data-delete-recipe]").forEach((b) =>
    b.addEventListener("click", async () => {
      const r = state.recipes.find((x) => x.id === b.dataset.deleteRecipe);
      if (!r || !confirm(`Delete “${r.title}” for everyone? This can't be undone.`)) return;
      b.disabled = true;
      try {
        await h.api(`/admin/recipes/${r.id}`, { method: "DELETE" });
        await h.refreshRecipes();
        h.toast(`Deleted “${r.title}”`);
        renderRecipes(h);
      } catch (err) {
        b.disabled = false;
        handleError(h, err);
      }
    }),
  );
}

function renderRecipeForm(id, h) {
  const { esc, state } = h;
  const isNew = id === "new";
  const r = isNew ? { category: "Mains", ingredients: [], instructions: [], notes: [] } : state.recipes.find((x) => x.id === id);
  if (!r) {
    shell(h, "recipes", `<div class="empty"><h2>Recipe not found</h2><p><a href="#/admin">Back to recipes</a></p></div>`);
    return;
  }
  const v = (k) => esc(r[k] ?? "");
  const lines = (k) => esc((r[k] || []).join("\n"));
  const field = (name, label, attrs = "", hint = "") => `
    <div class="field">
      <label for="f-${name}">${label}</label>
      <input class="input" id="f-${name}" name="${name}" value="${v(name)}" ${attrs} />
      ${hint ? `<div class="hint">${hint}</div>` : ""}
    </div>`;
  const area = (name, label, hint, rows, required = "") => `
    <div class="field">
      <label for="f-${name}">${label}</label>
      <textarea class="input" id="f-${name}" name="${name}" rows="${rows}" ${required}>${lines(name)}</textarea>
      <div class="hint">${hint}</div>
    </div>`;

  const body = shell(
    h,
    "recipes",
    `
    <a class="back-link" href="#/admin">← All recipes</a>
    <form class="admin-form" id="recipe-form" novalidate>
      <h2>${isNew ? "New recipe" : `Edit “${esc(r.title)}”`}</h2>
      <div class="form-error" id="form-error" role="alert" hidden></div>

      <fieldset>
        <legend>Basics</legend>
        ${field("title", "Title *", 'required maxlength="120"')}
        <div class="field">
          <label for="f-category">Category *</label>
          <select class="input" id="f-category" name="category">
            ${h.categories.map((c) => `<option ${c === r.category ? "selected" : ""}>${c}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="f-description">Description</label>
          <textarea class="input" id="f-description" name="description" rows="2" maxlength="600">${v("description")}</textarea>
        </div>
      </fieldset>

      <fieldset>
        <legend>Times &amp; servings</legend>
        <div class="form-grid">
          ${field("prepTime", "Prep time", 'placeholder="15 min"')}
          ${field("cookTime", "Cook time", 'placeholder="30 min"')}
          ${field("totalTime", "Total time", 'placeholder="45 min"')}
          ${field("servings", "Servings", 'placeholder="6"')}
        </div>
      </fieldset>

      <fieldset>
        <legend>Recipe</legend>
        ${area("ingredients", "Ingredients *", "One ingredient per line.", 8, "required")}
        ${area("instructions", "Instructions *", "One step per line. Steps are numbered automatically.", 8, "required")}
        ${area("notes", "Cook's notes", "Optional. One tip per line.", 3)}
      </fieldset>

      <fieldset>
        <legend>Source &amp; rating</legend>
        <div class="form-grid">
          ${field("author", "Author")}
          ${field("sourceName", "Source name", 'placeholder="Website or cookbook"')}
        </div>
        ${field("sourceUrl", "Source URL", 'type="url" placeholder="https://…"')}
        <div class="form-grid">
          ${field("rating", "Rating (0–5)", 'type="number" min="0" max="5" step="0.01"', "Leave blank to hide stars.")}
          ${field("ratingCount", "Number of ratings", 'type="number" min="0" step="1"')}
        </div>
      </fieldset>

      <div class="form-actions">
        <a class="btn btn-ghost" href="#/admin">Cancel</a>
        <button class="btn btn-primary" type="submit">${isNew ? "Add recipe" : "Save changes"}</button>
      </div>
    </form>`,
  );

  const form = body.querySelector("#recipe-form");
  const errBox = body.querySelector("#form-error");
  form.elements.namedItem("title").focus();
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const showError = (msg) => {
      errBox.textContent = msg;
      errBox.hidden = false;
      errBox.scrollIntoView({ block: "center", behavior: "smooth" });
    };
    if (!data.title.trim()) return showError("Title is required.");
    if (!data.ingredients.trim()) return showError("Add at least one ingredient.");
    if (!data.instructions.trim()) return showError("Add at least one instruction step.");
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      const saved = await h.api(isNew ? "/admin/recipes" : `/admin/recipes/${r.id}`, { method: isNew ? "POST" : "PUT", body: data });
      await h.refreshRecipes();
      h.toast(isNew ? `Added “${saved.title}”` : "Changes saved");
      location.hash = `#/recipe/${saved.id}`;
    } catch (err) {
      btn.disabled = false;
      if (err.status === 401) return h.onUnauthorized();
      showError(err.message);
    }
  });
}

// ---------- Users ----------

async function renderUsers(h) {
  const { esc } = h;
  const body = shell(h, "users", `<div class="loading">Loading users…</div>`);
  let users;
  try {
    users = await h.api("/admin/users");
  } catch (err) {
    body.innerHTML = `<div class="empty"><h2>Couldn't load users</h2></div>`;
    return handleError(h, err);
  }
  if (!location.hash.startsWith("#/admin/users")) return; // navigated away while loading
  const me = h.state.user.username.toLowerCase();

  body.innerHTML = `
    <div class="admin-toolbar"><span class="muted">${users.length} user${users.length === 1 ? "" : "s"}</span></div>
    <div class="admin-list">
      ${users
        .map(
          (u) => `
        <div class="admin-row" data-user-row="${esc(u.username)}">
          ${avatarHTML(u, esc, "md")}
          <div class="admin-row-main">
            <div class="admin-row-title">${esc(u.displayName || u.username)}${u.displayName ? ` <span class="muted small">@${esc(u.username)}</span>` : ""} ${u.isAdmin ? '<span class="badge">Admin</span>' : ""}${
              u.username.toLowerCase() === me ? '<span class="badge badge-muted">You</span>' : ""
            }</div>
            <div class="muted small">Joined ${fmtDate(u.createdAt)} · ♥ ${u.favorites} · hidden ${u.hidden}</div>
          </div>
          <div class="admin-row-actions">
            <button type="button" class="btn btn-ghost btn-sm" data-reset="${esc(u.username)}">Reset password</button>
            ${
              u.username.toLowerCase() === me
                ? ""
                : `<button type="button" class="btn btn-ghost btn-sm btn-danger" data-delete-user="${esc(u.username)}">Delete</button>`
            }
          </div>
          <form class="reset-form" data-reset-form="${esc(u.username)}" hidden>
            <label class="sr-only" for="pw-${esc(u.username)}">New password for ${esc(u.username)}</label>
            <input class="input" id="pw-${esc(u.username)}" type="password" autocomplete="new-password" minlength="8" placeholder="New password (8+ characters)" required />
            <button class="btn btn-primary btn-sm" type="submit">Set password</button>
            <button class="btn btn-ghost btn-sm" type="button" data-cancel-reset>Cancel</button>
          </form>
        </div>`,
        )
        .join("")}
    </div>
    <p class="muted small">Resetting a password signs that user out on all their devices. Share the new password with them privately.</p>`;

  body.querySelectorAll("[data-reset]").forEach((b) =>
    b.addEventListener("click", () => {
      const form = body.querySelector(`[data-reset-form="${CSS.escape(b.dataset.reset)}"]`);
      form.hidden = false;
      form.querySelector("input").focus();
    }),
  );
  body.querySelectorAll("[data-cancel-reset]").forEach((b) =>
    b.addEventListener("click", () => {
      const form = b.closest("form");
      form.reset();
      form.hidden = true;
    }),
  );
  body.querySelectorAll("[data-reset-form]").forEach((form) =>
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const username = form.dataset.resetForm;
      const password = form.querySelector("input").value;
      if (password.length < 8) return h.toast("Password must be at least 8 characters.");
      try {
        await h.api(`/admin/users/${encodeURIComponent(username)}/password`, { method: "POST", body: { password } });
        form.reset();
        form.hidden = true;
        if (username.toLowerCase() === me) {
          h.toast("Your password was changed. Please sign in again.");
          return h.onUnauthorized();
        }
        h.toast(`Password reset for ${username}`);
      } catch (err) {
        handleError(h, err);
      }
    }),
  );
  body.querySelectorAll("[data-delete-user]").forEach((b) =>
    b.addEventListener("click", async () => {
      const username = b.dataset.deleteUser;
      if (!confirm(`Delete the account “${username}” and their favorites? This can't be undone.`)) return;
      b.disabled = true;
      try {
        await h.api(`/admin/users/${encodeURIComponent(username)}`, { method: "DELETE" });
        h.toast(`Deleted ${username}`);
        renderUsers(h);
      } catch (err) {
        b.disabled = false;
        handleError(h, err);
      }
    }),
  );
}

// ---------- Stats ----------

async function renderStats(h) {
  const { esc } = h;
  const body = shell(h, "stats", `<div class="loading">Crunching numbers…</div>`);
  let s;
  try {
    s = await h.api("/admin/stats");
  } catch (err) {
    body.innerHTML = `<div class="empty"><h2>Couldn't load stats</h2></div>`;
    return handleError(h, err);
  }
  if (!location.hash.startsWith("#/admin/stats")) return;

  const ranked = (key) => s.recipeStats.filter((r) => r[key] > 0).sort((a, b) => b[key] - a[key] || a.title.localeCompare(b.title)).slice(0, 10);
  const bars = (key, emptyMsg) => {
    const list = ranked(key);
    if (!list.length) return `<p class="muted">${emptyMsg}</p>`;
    const max = list[0][key];
    return `<ol class="bar-list">${list
      .map(
        (r) => `
        <li>
          <a href="#/recipe/${r.id}">${esc(r.title)}</a>
          <span class="bar"><span style="width:${Math.max(4, (r[key] / max) * 100)}%;background:${h.catColor(r.category)}"></span></span>
          <span class="bar-num">${r[key]}</span>
        </li>`,
      )
      .join("")}</ol>`;
  };

  body.innerHTML = `
    <div class="stat-tiles">
      <div class="stat"><span class="stat-num">${s.users}</span><span class="stat-label">Users</span></div>
      <div class="stat"><span class="stat-num">${s.recipes}</span><span class="stat-label">Recipes</span></div>
      <div class="stat"><span class="stat-num">${s.favorites}</span><span class="stat-label">Favorites saved</span></div>
      <div class="stat"><span class="stat-num">${s.hidden}</span><span class="stat-label">Recipes hidden</span></div>
    </div>
    <div class="stat-panels">
      <section class="panel">
        <h2>Most favorited</h2>
        ${bars("favorites", "No favorites yet.")}
      </section>
      <section class="panel">
        <h2>Most hidden</h2>
        <p class="muted small">Recipes people marked “Not for me” — candidates to replace.</p>
        ${bars("hidden", "Nobody has hidden a recipe yet.")}
      </section>
    </div>`;
}
