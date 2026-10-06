// "My Profile" page and the public shared-favorites page.
// Rendered by app.js; helpers (api, esc, toast, state, …) are passed in.

const AVATAR_SIZE = 256;

export function avatarHTML(user, esc, size = "md") {
  const name = user.displayName || user.username || "?";
  if (user.avatarVersion) {
    return `<img class="avatar avatar-${size}" src="/api/avatar/${encodeURIComponent(user.username)}?v=${user.avatarVersion}" alt="" loading="lazy" />`;
  }
  return `<span class="avatar avatar-${size}" aria-hidden="true">${esc(name.trim()[0]?.toUpperCase() || "?")}</span>`;
}

const fmtDate = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

const shareUrl = (username) => `${location.origin}/#/u/${encodeURIComponent(username)}`;

// Center-crop and shrink a photo to a small square JPEG in the browser before uploading.
async function resizeImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("That file doesn't look like an image."));
      i.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = AVATAR_SIZE;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
    return await new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't process that image."))), "image/jpeg", 0.85),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function renderProfile(h) {
  const { esc, state } = h;
  const u = state.user;
  const ids = new Set(state.recipes.map((r) => r.id));
  const favCount = u.favorites.filter((id) => ids.has(id)).length;
  const hiddenCount = u.hidden.filter((id) => ids.has(id)).length;

  h.main.innerHTML = `
    <div class="page-head"><div><h1>My Profile</h1><p>How you appear, and your account settings.</p></div></div>

    <div class="profile-layout">
      <section class="panel profile-card">
        <div class="profile-photo">
          ${avatarHTML(u, esc, "xl")}
          <div class="profile-photo-actions">
            <label class="btn btn-ghost btn-sm file-btn">
              ${u.avatarVersion ? "Change photo" : "Add photo"}
              <input type="file" id="avatar-input" accept="image/jpeg,image/png,image/webp" />
            </label>
            ${u.avatarVersion ? `<button type="button" class="btn btn-ghost btn-sm" id="avatar-remove">Remove</button>` : ""}
          </div>
        </div>
        <div class="profile-ident">
          <h2>${esc(u.displayName || u.username)}</h2>
          <div class="muted">@${esc(u.username)}${u.isAdmin ? ' <span class="badge">Admin</span>' : ""}</div>
          ${u.bio ? `<p class="profile-bio">${esc(u.bio)}</p>` : ""}
        </div>
        <dl class="profile-stats">
          <div><dt>Joined</dt><dd>${u.createdAt ? fmtDate(u.createdAt) : "—"}</dd></div>
          <div><dt>Favorites</dt><dd><a href="#/favorites">${favCount}</a></dd></div>
          <div><dt>Hidden</dt><dd><a href="#/hidden">${hiddenCount}</a></dd></div>
        </dl>
      </section>

      <div class="profile-forms">
        <form class="panel" id="profile-form" novalidate>
          <h2>About you</h2>
          <div class="field">
            <label for="displayName">Display name</label>
            <input class="input" id="displayName" name="displayName" maxlength="40" value="${esc(u.displayName)}" placeholder="${esc(u.username)}" />
            <div class="hint">Shown instead of your username. Your username (@${esc(u.username)}) never changes.</div>
          </div>
          <div class="field">
            <label for="bio">Bio</label>
            <textarea class="input" id="bio" name="bio" rows="3" maxlength="280" placeholder="Grew up on my grandmother's biscuits…">${esc(u.bio)}</textarea>
            <div class="hint"><span id="bio-count">${u.bio.length}</span>/280</div>
          </div>
          <div class="field">
            <label class="switch">
              <input type="checkbox" id="shareFavorites" ${u.shareFavorites ? "checked" : ""} />
              <span class="switch-track" aria-hidden="true"></span>
              <span><strong>Share my favorites</strong><br /><span class="muted small">Anyone with your link can see your name, photo, bio and favorite recipes — no account needed.</span></span>
            </label>
          </div>
          <div class="share-box" id="share-box" ${u.shareFavorites ? "" : "hidden"}>
            <input class="input" id="share-url" readonly value="${esc(shareUrl(u.username))}" aria-label="Your shareable favorites link" />
            <button type="button" class="btn btn-ghost btn-sm" id="copy-link">Copy link</button>
            <a class="btn btn-ghost btn-sm" href="#/u/${encodeURIComponent(u.username)}">Preview</a>
          </div>
          <div class="form-actions"><button class="btn btn-primary" type="submit">Save profile</button></div>
        </form>

        <form class="panel" id="password-form" novalidate>
          <h2>Change password</h2>
          <div class="form-error" id="pw-error" role="alert" hidden></div>
          <input type="text" name="username" autocomplete="username" value="${esc(u.username)}" hidden />
          <div class="field">
            <label for="currentPassword">Current password</label>
            <input class="input" id="currentPassword" name="currentPassword" type="password" autocomplete="current-password" required />
          </div>
          <div class="form-grid">
            <div class="field">
              <label for="newPassword">New password</label>
              <input class="input" id="newPassword" name="newPassword" type="password" autocomplete="new-password" minlength="8" required />
              <div class="hint">At least 8 characters.</div>
            </div>
            <div class="field">
              <label for="confirmPassword">Confirm new password</label>
              <input class="input" id="confirmPassword" name="confirmPassword" type="password" autocomplete="new-password" required />
            </div>
          </div>
          <p class="muted small">Changing your password signs you out on your other devices.</p>
          <div class="form-actions"><button class="btn btn-primary" type="submit">Update password</button></div>
        </form>

        <form class="panel danger-zone" id="delete-form" novalidate>
          <h2>Delete account</h2>
          <p class="muted">This permanently deletes your account, photo, favorites and hidden list. It can't be undone.</p>
          <div class="form-error" id="del-error" role="alert" hidden></div>
          <input type="text" name="username" autocomplete="username" value="${esc(u.username)}" hidden />
          <div class="field">
            <label for="deletePassword">Enter your password to confirm</label>
            <input class="input" id="deletePassword" type="password" autocomplete="current-password" required />
          </div>
          <div class="form-actions"><button class="btn btn-ghost btn-danger" type="submit">Delete my account</button></div>
        </form>
      </div>
    </div>`;

  const $ = (sel) => h.main.querySelector(sel);
  const fail = (err, box) => {
    if (err.status === 401) return h.onUnauthorized();
    if (box) {
      box.textContent = err.message;
      box.hidden = false;
    } else h.toast(err.message);
  };
  const updated = (user, msg) => {
    state.user = user;
    h.onUserUpdated();
    if (msg) h.toast(msg);
  };

  // Photo
  $("#avatar-input").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      h.toast("Uploading photo…");
      const blob = await resizeImage(file);
      updated(await h.api("/profile/avatar", { method: "PUT", body: blob }), "Photo updated");
      renderProfile(h);
    } catch (err) {
      fail(err);
    }
  });
  $("#avatar-remove")?.addEventListener("click", async () => {
    try {
      updated(await h.api("/profile/avatar", { method: "DELETE" }), "Photo removed");
      renderProfile(h);
    } catch (err) {
      fail(err);
    }
  });

  // About you + sharing
  const bio = $("#bio");
  bio.addEventListener("input", () => ($("#bio-count").textContent = bio.value.length));
  $("#shareFavorites").addEventListener("change", (e) => ($("#share-box").hidden = !e.target.checked));
  $("#copy-link").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText($("#share-url").value);
      h.toast("Link copied");
    } catch {
      $("#share-url").select();
      h.toast("Press Ctrl+C (or ⌘C) to copy");
    }
  });
  $("#profile-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      const wasShared = state.user.shareFavorites;
      const user = await h.api("/profile", {
        method: "PUT",
        body: { displayName: $("#displayName").value, bio: bio.value, shareFavorites: $("#shareFavorites").checked },
      });
      const msg =
        user.shareFavorites && !wasShared ? "Saved — your favorites link is live" : !user.shareFavorites && wasShared ? "Saved — your favorites are private again" : "Profile saved";
      updated(user, msg);
      renderProfile(h);
    } catch (err) {
      btn.disabled = false;
      fail(err);
    }
  });

  // Password
  $("#password-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const box = $("#pw-error");
    box.hidden = true;
    const currentPassword = f.currentPassword.value;
    const newPassword = f.newPassword.value;
    if (!currentPassword) return fail(new Error("Enter your current password."), box);
    if (newPassword.length < 8) return fail(new Error("New password must be at least 8 characters."), box);
    if (newPassword !== f.confirmPassword.value) return fail(new Error("New passwords don't match."), box);
    const btn = f.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      updated(await h.api("/profile/password", { method: "POST", body: { currentPassword, newPassword } }), "Password updated");
      f.reset();
    } catch (err) {
      fail(err, box);
    } finally {
      btn.disabled = false;
    }
  });

  // Delete account
  $("#delete-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const box = $("#del-error");
    box.hidden = true;
    const password = $("#deletePassword").value;
    if (!password) return fail(new Error("Enter your password to confirm."), box);
    if (!confirm("Delete your account permanently? This can't be undone.")) return;
    try {
      await h.api("/profile", { method: "DELETE", body: { password } });
      h.onAccountDeleted();
    } catch (err) {
      fail(err, box);
    }
  });
}

// Public page: #/u/:username — works signed in or not.
export async function renderShared(username, h) {
  const { esc } = h;
  h.main.innerHTML = `<div class="loading">Opening the recipe box…</div>`;
  let data;
  try {
    data = await h.api(`/shared/${encodeURIComponent(username)}`);
  } catch (err) {
    h.main.innerHTML = `<div class="empty"><h2>Nothing to see here</h2><p>${esc(err.status === 404 ? "This favorites list isn't shared, or the link is wrong." : err.message)}</p>
      <p><a class="btn btn-primary" href="#/">${h.state.user ? "Back to recipes" : "Go to the Recipe Book"}</a></p></div>`;
    return;
  }
  if (location.hash !== `#/u/${username}` && location.hash !== `#/u/${encodeURIComponent(username)}`) return;
  const name = data.displayName || data.username;
  const isMe = h.state.user && h.state.user.username.toLowerCase() === data.username.toLowerCase();

  h.main.innerHTML = `
    <section class="shared-hero gingham">
      ${avatarHTML(data, esc, "xl")}
      <div>
        <h1>${esc(name)}'s favorite Southern recipes</h1>
        ${data.bio ? `<p class="profile-bio">${esc(data.bio)}</p>` : ""}
        <p class="shared-meta">@${esc(data.username)} · ${data.recipes.length} favorite${data.recipes.length === 1 ? "" : "s"}</p>
      </div>
    </section>
    ${isMe ? `<p class="muted small center">This is how your shared page looks to others. <a href="#/profile">Edit profile</a></p>` : ""}
    ${
      h.state.user
        ? ""
        : `<div class="cta-banner"><span>Want the full recipes and your own favorites list?</span><a class="btn btn-primary btn-sm" href="#/">Create a free account</a></div>`
    }
    ${
      data.recipes.length
        ? `<div class="grid">${data.recipes.map((r) => h.cardHTML(r, { readOnly: true, linkable: !!h.state.user })).join("")}</div>`
        : `<div class="empty"><h2>No favorites yet</h2><p>${esc(name)} hasn't hearted any recipes.</p></div>`
    }`;
}
