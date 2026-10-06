# Southern Recipe Book

A responsive recipe book of top-rated Southern recipes, shown as easy-to-read recipe cards and printable recipe sheets.

- **Accounts**: users create a username and password to sign in.
- **Favorites**: tap ♥ to save a recipe; the Favorites tab lists them.
- **Remove recipes you don't like**: tap ✕ ("Not for me") to take a recipe out of your book. The Hidden tab lets you restore it.
- **Themes**: Light, Dark, or System (follows your device setting), using the switch in the header.
- **Responsive**: works on phones, tablets and desktop browsers. Recipe sheets also print cleanly.
- **Cooking mode**: tick off ingredients and tap steps to mark them done.

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

To add or edit recipes, update `public/data/recipes.json`.

## How it's built

- `public/`: the static site (plain HTML, CSS and JavaScript, no build step).
- `netlify/functions/api.mjs`: one Netlify Function serving `/api/*` (sign up, sign in, sign out, favorites, hidden).
- **Storage**: [Netlify Blobs](https://docs.netlify.com/blobs/overview/) holds user accounts and their favorites, so there's no database to set up.
- **Security**: passwords are hashed with scrypt and never stored in plain text. Sessions use a signed, HttpOnly cookie that lasts 30 days.

## Deploy to Netlify

1. In Netlify, choose **Add new site → Import an existing project** and pick this GitHub repo.
2. Keep the defaults. `netlify.toml` already sets the publish folder (`public`) and the functions folder.
3. Click **Deploy**. That's all. Netlify Blobs is turned on automatically for every site.

Optional: under **Site configuration → Environment variables**, add `SESSION_SECRET` set to a long random string. If you leave it out, the app generates a secret once and keeps it in Blobs.

## Run locally

```bash
npm install
npm run dev   # runs the Netlify CLI (`netlify dev`) at http://localhost:8888
```
