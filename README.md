# Southern Recipe Book

A responsive recipe book of top-rated Southern recipes, shown as easy-to-read recipe cards and printable recipe sheets.

- **Landing page**: visitors who aren't signed in see a home page first, not the sign-in screen. It has food photos, a preview of 8 recipes (title, rating, time and servings), what the app does, and "Get started" / "Sign in" buttons. Full ingredients and instructions still need an account.
- **Accounts**: users create a username and password to sign in, at `/#/signup` or `/#/login`. If someone opens a recipe link while signed out, they're taken back to that recipe after signing in.
- **Favorites**: tap ♥ to save a recipe; the Favorites tab lists them.
- **Remove recipes you don't like**: tap ✕ ("Not for me") to take a recipe out of your book. The Hidden tab lets you restore it.
- **Themes**: Light, Dark, or System (follows your device setting), using the switch in the header.
- **Responsive**: works on phones, tablets and desktop browsers. Recipe sheets also print cleanly.
- **Cooking mode**: tick off ingredients and tap steps to mark them done.
- **Profiles**: every user has a My Profile page (tap your name or photo in the header) where they can:
  - add a profile photo, display name and short bio
  - see when they joined and how many recipes they've favorited or hidden
  - change their password (this signs out their other devices)
  - delete their account
- **Shareable favorites** (off by default): turn on "Share my favorites" to get a public link like `/#/u/yourname`. Anyone with the link can see your name, photo, bio and favorite recipes without an account. Turn it off and the link stops working.
- **Admin page** (admins only):
  - **Recipes**: add, edit and delete recipes in the app.
  - **Users**: list everyone, reset a user's password (this signs them out everywhere), or delete an account.
  - **Stats**: user and recipe totals, the most-favorited recipes, and the most-hidden ones.

## Recipes

The 14 recipes were collected with [Firecrawl](https://www.firecrawl.dev/) from highly rated recipe pages. Each one is credited to its author and links back to the original page. Ratings reflect the source site when the recipes were collected.

| Recipe | Source | Rating |
| --- | --- | --- |
| The Best Southern Fried Chicken | The Country Cook | 4.9 (319) |
| Easy Classic Shrimp and Grits | Bowl of Delicious | 5.0 (490) |
| Cajun Chicken and Sausage Gumbo | Chili Pepper Madness | 4.9 (133) |
| Authentic Cajun Red Beans and Rice | Lauren from Scratch | 4.9 (81) |
| Old-Fashioned Chicken and Dumplings | The Country Cook | 4.9 (519) |
| Southern Baked Macaroni and Cheese | The Hungry Bluebird | 4.9 (594) |
| Southern Collard Greens with Smoked Turkey | Divas Can Cook | 4.7 (198) |
| Southern Fried Green Tomatoes | Dash of Jazz | 5.0 (11) |
| Southern Cornbread (Buttermilk & Cast Iron) | Grits and Pinecones | 5.0 (41) |
| Southern Biscuits | Paula Deen | 4.8 (302) |
| Old Fashioned Peach Cobbler | Tastes Better From Scratch | 4.9 (9,590) |
| Pecan Pie | Tastes Better From Scratch | 5.0 (4,461) |
| Southern Banana Pudding | Add a Pinch | 5.0 (137) |
| Southern Sweet Potato Pie | Add a Pinch | 5.0 (228) |

Admins add, edit and delete recipes from the Admin page. `data/recipes.json` is only the starting set: it's loaded the first time the site runs. After that, recipes live in Netlify Blobs, and admin changes are saved there.

### Photos

The landing page uses freely licensed food photos from [Wikimedia Commons](https://commons.wikimedia.org/). They show each dish in general; they aren't from the recipe authors, several of whom ask that their content not be reused. Each photo is credited with its license under **Photo credits** at the bottom of the landing page. The list of photos is in `public/js/landing.js`. If a photo ever fails to load, its card falls back to the gingham pattern.

## How it's built

- `public/`: the static site (plain HTML, CSS and JavaScript, no build step).
- `netlify/functions/api.mjs`: one Netlify Function serving `/api/*` (sign up, sign in, sign out, favorites, hidden).
- `data/recipes.json`: the starting recipes, built into the function.
- **Storage**: [Netlify Blobs](https://docs.netlify.com/blobs/overview/) holds user accounts, their favorites, and the recipe list, so there's no database to set up.
- **Privacy**: favorites, hidden lists and profile photos are private unless a user turns on sharing. Admins can see photos in the user list.
- **Photos**: resized to 256×256 in the browser before upload, limited to 512 KB, and only JPEG, PNG or WebP files are accepted.
- **Security**: passwords are hashed with scrypt and never stored in plain text. Sessions use a signed, HttpOnly cookie that lasts 30 days.

## Deploy to Netlify

1. In Netlify, choose **Add new site → Import an existing project** and pick this GitHub repo.
2. Keep the defaults. `netlify.toml` already sets the publish folder (`public`) and the functions folder.
3. Click **Deploy**. That's all. Netlify Blobs is turned on automatically for every site.

### Make yourself an admin

1. Sign up in the app with the username you want to use as admin.
2. In Netlify, open **Site configuration → Environment variables** and add `ADMIN_USERS` with your username as the value. For several admins, separate them with commas: `alice,bob`. Upper or lower case doesn't matter.
3. Go to **Deploys → Trigger deploy** so the new setting takes effect. After that, an **Admin** tab shows up for you.

Only people listed in `ADMIN_USERS` can be admins. Nobody can make themselves an admin from inside the app.

Optional: also add `SESSION_SECRET` set to a long random string. If you leave it out, the app generates a secret once and keeps it in Blobs.

## Run locally

```bash
npm install
npm run dev   # runs the Netlify CLI (`netlify dev`) at http://localhost:8888
```
