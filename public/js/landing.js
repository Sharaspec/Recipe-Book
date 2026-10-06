// Public landing page for signed-out visitors: hero, recipe preview with photos, features, and sign-up prompts.
// Photos are freely licensed images from Wikimedia Commons, loaded from Wikimedia's servers and credited below.

const COMMONS = "https://thumb.wikimedia.org/wikipedia/commons/thumb";

// Keyed by recipe id. These show what each dish looks like; they are not photos from the recipe authors.
export const PHOTOS = {
  "southern-fried-chicken": {
    src: `${COMMONS}/2/2c/Fried-Chicken-Set.jpg/960px-Fried-Chicken-Set.jpg`,
    author: "Evan-Amos",
    license: "CC0",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    page: "https://commons.wikimedia.org/wiki/File:Fried-Chicken-Set.jpg",
  },
  "shrimp-and-grits": {
    src: `${COMMONS}/5/5c/Shrimp_and_grits_at_the_Green_Goddess.jpg/960px-Shrimp_and_grits_at_the_Green_Goddess.jpg`,
    author: "Jason Riedy",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
    page: "https://commons.wikimedia.org/wiki/File:Shrimp_and_grits_at_the_Green_Goddess.jpg",
  },
  "peach-cobbler": {
    src: `${COMMONS}/0/0f/Cobbler_%287303683612%29.jpg/960px-Cobbler_%287303683612%29.jpg`,
    author: "Leslie Seaton",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
    page: "https://commons.wikimedia.org/wiki/File:Cobbler_(7303683612).jpg",
  },
  "southern-biscuits": {
    src: `${COMMONS}/b/be/Loveless_Cafe_Biscuits.jpg/960px-Loveless_Cafe_Biscuits.jpg`,
    author: "Dale Cruse",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
    page: "https://commons.wikimedia.org/wiki/File:Loveless_Cafe_Biscuits.jpg",
  },
  "buttermilk-cornbread": {
    src: `${COMMONS}/7/7a/Skillet_cornbread_%28cropped%29.jpg/960px-Skillet_cornbread_%28cropped%29.jpg`,
    author: "Zankopedia",
    license: "CC BY-SA 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
    page: "https://commons.wikimedia.org/wiki/File:Skillet_cornbread_(cropped).jpg",
  },
  "chicken-and-sausage-gumbo": {
    src: `${COMMONS}/5/5a/Gumbo.JPG/960px-Gumbo.JPG`,
    author: "Amadscientist",
    license: "CC BY-SA 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
    page: "https://commons.wikimedia.org/wiki/File:Gumbo.JPG",
  },
  "pecan-pie": {
    src: `${COMMONS}/b/bf/My_first_pecan_pie%21.jpg/960px-My_first_pecan_pie%21.jpg`,
    author: "Librarygroover",
    license: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    page: "https://commons.wikimedia.org/wiki/File:My_first_pecan_pie!.jpg",
  },
  "southern-baked-mac-and-cheese": {
    src: `${COMMONS}/4/44/Original_Mac_n_Cheese_.jpg/960px-Original_Mac_n_Cheese_.jpg`,
    author: "Texasfoodgawker",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    page: "https://commons.wikimedia.org/wiki/File:Original_Mac_n_Cheese_.jpg",
  },
  "red-beans-and-rice": {
    src: "https://upload.wikimedia.org/wikipedia/commons/7/76/Red_beans.jpg",
    author: "Will7777",
    license: "Public domain",
    licenseUrl: "",
    page: "https://commons.wikimedia.org/wiki/File:Red_beans.jpg",
  },
  "fried-green-tomatoes": {
    src: `${COMMONS}/a/a9/Fried_green_tomatoes.jpg/960px-Fried_green_tomatoes.jpg`,
    author: "ninjapoodles",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
    page: "https://commons.wikimedia.org/wiki/File:Fried_green_tomatoes.jpg",
  },
  "sweet-potato-pie": {
    src: `${COMMONS}/b/b6/Sweet_Potato_Pie_%2826196501606%29.jpg/960px-Sweet_Potato_Pie_%2826196501606%29.jpg`,
    author: "Stephanie Clifford",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
    page: "https://commons.wikimedia.org/wiki/File:Sweet_Potato_Pie_(26196501606).jpg",
  },
  "chicken-and-dumplings": {
    src: `${COMMONS}/6/69/Mmm..._chicken_dumplings_%287867591472%29.jpg/960px-Mmm..._chicken_dumplings_%287867591472%29.jpg`,
    author: "jeffreyw",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
    page: "https://commons.wikimedia.org/wiki/File:Mmm..._chicken_dumplings_(7867591472).jpg",
  },
};

const HERO_PHOTO = {
  src: `${COMMONS}/7/71/Soul_Food_at_Powell%27s_Place.jpg/960px-Soul_Food_at_Powell%27s_Place.jpg`,
  alt: "A plate of soul food with fried chicken, greens and sides",
  title: "Soul food plate",
  author: "Jennifer Woodard Maderazo",
  license: "CC BY 2.0",
  licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
  page: "https://commons.wikimedia.org/wiki/File:Soul_Food_at_Powell%27s_Place.jpg",
};

// The order dishes appear in the preview.
const FEATURED = [
  "southern-fried-chicken",
  "shrimp-and-grits",
  "peach-cobbler",
  "southern-biscuits",
  "chicken-and-sausage-gumbo",
  "southern-baked-mac-and-cheese",
  "pecan-pie",
  "buttermilk-cornbread",
];

// If a photo fails to load, fall back to the gingham pattern behind it.
const photoImg = (src, alt, extra = "") =>
  `<img src="${src}" alt="${alt}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()" ${extra} />`;

export async function renderLanding(h) {
  const { esc } = h;
  let recipes = [];
  try {
    recipes = await h.api("/preview");
  } catch {
    /* the page still works without the preview grid */
  }
  if (h.state.user) return; // signed in while loading

  const byId = new Map(recipes.map((r) => [r.id, r]));
  const featured = FEATURED.map((id) => byId.get(id)).filter(Boolean);
  const total = recipes.length;
  const rated = recipes.filter((r) => Number.isFinite(r.rating));
  const avg = rated.length ? rated.reduce((a, r) => a + r.rating, 0) / rated.length : null;
  const reviews = recipes.reduce((a, r) => a + (r.ratingCount || 0), 0);
  const roundDown = (n) => (n >= 1000 ? `${Math.floor(n / 1000).toLocaleString()},000+` : n.toLocaleString());
  const heroTiles = ["southern-fried-chicken", "peach-cobbler"];
  const usedPhotos = [HERO_PHOTO, ...new Set([...heroTiles, ...featured.map((r) => r.id)])].map((x) =>
    typeof x === "string" ? { ...PHOTOS[x], title: byId.get(x)?.title || x } : x,
  );

  h.main.innerHTML = `
    <section class="landing-hero">
      <div class="landing-copy">
        <p class="eyebrow">Southern Recipe Book</p>
        <h1>The South's best-loved recipes, all in one book.</h1>
        <p class="lead">${total ? `${total} top-rated` : "Top-rated"} Southern classics — fried chicken, shrimp &amp; grits, gumbo, peach cobbler and more — turned into clean, easy-to-follow recipe cards. Save the ones you love, skip the ones you don't.</p>
        <div class="landing-ctas">
          <a class="btn btn-primary btn-lg" href="#/signup">Get started — it's free</a>
          <a class="btn btn-ghost btn-lg" href="#/login">Sign in</a>
        </div>
        ${
          total
            ? `<ul class="trust">
                <li><strong>${total}</strong> recipes</li>
                ${avg ? `<li><strong>${avg.toFixed(1)}★</strong> average rating</li>` : ""}
                ${reviews ? `<li><strong>${roundDown(reviews)}</strong> reviews at the source</li>` : ""}
              </ul>`
            : ""
        }
      </div>
      <div class="landing-collage" aria-hidden="true">
        <figure class="tile tile-main gingham">${photoImg(HERO_PHOTO.src, "")}</figure>
        ${heroTiles
          .map((id, i) => `<figure class="tile tile-${i + 1} gingham" style="--c:var(--cat-${i ? "desserts" : "mains"})">${photoImg(PHOTOS[id].src, "")}</figure>`)
          .join("")}
      </div>
    </section>

    <section class="landing-section">
      <div class="section-head">
        <h2>A taste of what's inside</h2>
        <p class="muted">Every recipe comes from a highly rated source and links back to its author.</p>
      </div>
      ${
        featured.length
          ? `<div class="preview-grid">
              ${featured
                .map((r) => {
                  const p = PHOTOS[r.id];
                  return `
                <a class="preview-card" href="#/signup" aria-label="${esc(r.title)} — sign up to see the full recipe">
                  <div class="preview-photo gingham" style="--c:${h.catColor(r.category)}">
                    ${p ? photoImg(p.src, esc(r.title)) : ""}
                    <span class="cat-tag" style="--c:${h.catColor(r.category)}">${esc(r.category)}</span>
                  </div>
                  <div class="preview-body">
                    <h3>${esc(r.title)}</h3>
                    ${h.stars(r.rating, r.ratingCount)}
                    <div class="card-meta"><span>${h.icons.clock} ${esc(r.totalTime)}</span><span>${h.icons.people} ${esc(r.servings)}</span></div>
                  </div>
                </a>`;
                })
                .join("")}
            </div>`
          : ""
      }
      <p class="center"><a class="btn btn-primary" href="#/signup">${total ? `See all ${total} recipes` : "See all the recipes"}</a></p>
    </section>

    <section class="landing-section features">
      <div class="section-head"><h2>Made for cooking, not scrolling</h2></div>
      <div class="feature-grid">
        <div class="feature"><span class="feature-icon" aria-hidden="true">${h.icons.heart(true)}</span><h3>Save your favorites</h3><p>Tap the heart and your favorites follow you to your phone, tablet or computer.</p></div>
        <div class="feature"><span class="feature-icon" aria-hidden="true">✕</span><h3>Skip what's not for you</h3><p>Hide any recipe you don't care for. You can always bring it back.</p></div>
        <div class="feature"><span class="feature-icon" aria-hidden="true">✓</span><h3>Cook step by step</h3><p>Check off ingredients and steps as you go, or print a clean recipe sheet.</p></div>
        <div class="feature"><span class="feature-icon" aria-hidden="true">↗</span><h3>Share your list</h3><p>Turn on sharing to send friends and family a link to your favorites.</p></div>
      </div>
    </section>

    <section class="landing-cta gingham">
      <h2>Pull up a chair, y'all.</h2>
      <p>Create a free account in seconds — just a username and password.</p>
      <a class="btn btn-light btn-lg" href="#/signup">Create my free account</a>
    </section>

    <details class="photo-credits">
      <summary>Photo credits</summary>
      <p>Food photos show each dish in general and are not from the recipe authors. They come from Wikimedia Commons under the licenses listed.</p>
      <ul>
        ${usedPhotos
          .filter((p) => p && p.src)
          .map(
            (p) =>
              `<li><a href="${p.page}" target="_blank" rel="noopener noreferrer">${esc(p.title)}</a> by ${esc(p.author)}, ${
                p.licenseUrl ? `<a href="${p.licenseUrl}" target="_blank" rel="noopener noreferrer">${esc(p.license)}</a>` : esc(p.license)
              }</li>`,
          )
          .join("")}
      </ul>
    </details>`;
}
