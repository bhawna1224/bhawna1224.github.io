# Portfolio site

Static site (no build step) for GitHub Pages.

## Deploy to GitHub Pages (get bhawna1224.github.io)

1. Create a **new GitHub repo** named exactly: `bhawna1224.github.io`
   (this exact name is what makes GitHub Pages serve it at the root domain).
2. Push these three files (`index.html`, `style.css`, `script.js`) plus
   `.nojekyll` to the root of that repo's default branch.
3. In the repo: **Settings → Pages → Source → Deploy from branch →
   `main` / `(root)`**. Save.
4. Wait ~1 minute, then visit `https://bhawna1224.github.io`.

```bash
git init
git add .
git commit -m "Portfolio site"
git branch -M main
git remote add origin https://github.com/bhawna1224/bhawna1224.github.io.git
git push -u origin main
```

## Before you share the link — placeholders to replace

Search these in `index.html` / this README and swap in your real info:

| Placeholder | Where | Replace with |
|---|---|---|
| `your.email@example.com` | footer contact | your real email |
| `linkedin.com/in/your-linkedin-handle` | footer contact | your real LinkedIn URL |
| `resume.pdf` | hero button + footer | add an actual `resume.pdf` file to this folder (same name), or change the link |

## Content still pending your input (flagged, not fabricated)

- **Sales forecasting card**: no final RMSE/MAPE is shown because the repo
  README doesn't report one yet. Run `main.py`, get a real number, and
  replace the "Result" paragraph in the Quant &amp; Finance section.
- **Dissertation card**: no headline accuracy number is shown for the same
  reason — Chapter 5 of the dissertation gives a qualitative comparison,
  not a final measured accuracy per model. Add the real number if you have
  it (check with your supervisor/co-authors if it's not in your copy).
- **Consent Transparency Engine**: described as a hackathon prototype based
  on the README. If it's more developed than that now, update the copy.

## Structure

- `index.html` — all content/sections
- `style.css` — design tokens + layout (see `:root` at the top for colors/fonts)
- `script.js` — mobile nav toggle + scroll-reveal animation
- `.nojekyll` — tells GitHub Pages not to run Jekyll processing (keeps things simple/fast)
