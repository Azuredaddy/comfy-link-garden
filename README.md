# Lanky Services — Rubbish Removal & Local Services (Central Coast NSW)

A fast, SEO-optimised static website in your brand colours (dark + lime-green + cyan).
No build tools — every page works by double-clicking it. Each **location** is its own
landing page for local Google search.

## Pages
- `index.html` — Home (hero, Pickup & Delivery highlight, services, before/after gallery, reviews)
- `services.html` — Services (incl. Pickup & Delivery)
- `locations.html` — Locations hub (links to all suburbs)
- `contact.html` — Contact + quote form
- `locations/*.html` — 19 Central Coast suburb landing pages
- `sitemap.xml`, `robots.txt` — for Google indexing

## Your details (already wired in)
- **Phone:** 0439 973 051
- **Email:** matt@lankyservices.com.au
- **Facebook:** https://www.facebook.com/lankyservices/  (in header, footer & contact)
- **Slogan:** “Only an arm’s length away”
- **Area:** Central Coast (Newcastle mentioned in taglines — ask me to add Newcastle suburb pages when ready)

---

## ✅ To finish before going live

1. **Domain** — Find & Replace `https://www.lankyservices.com.au` across all files with your
   real domain (used in the SEO tags + sitemap).
2. **Your real logo** *(optional)* — I built a clean on-brand SVG logo. To use your actual
   logo file, drop it in `images/` and update the `<img src="images/logo-mark.svg">` in each
   page's header/footer (or just save yours as `images/logo-mark.svg`, keeping the name).
3. **Photos** — the home page has a Before/After gallery with placeholder tiles. Drop your
   photos into the `images` folder using these exact names and they appear automatically:
   - `job1.jpg` `job2.jpg` `job3.jpg` `job4.jpg` `job5.jpg` `job6.jpg`
   - `og-image.jpg` (1200×630) — used for nice link previews when shared on Facebook.
   Use landscape JPGs ~1600×1000px. (See `images/README.txt`.)
4. **Google reviews** — the home page has 3 review slots with placeholder text (marked with
   `<!-- NOTE -->`). Paste in real customer quotes + names when ready.

---

## Make the quote form actually send
The form shows a "thanks" message but doesn't email yet (static sites can't on their own).
Easiest fix — **Formspree** (free): create a form, set the `<form class="quote">` `action`
to your Formspree URL and add `method="post"`. Or rely on the phone/email/Facebook links,
which work now.

## Publishing (free options)
- **Netlify** or **Cloudflare Pages** — drag-and-drop this whole folder.
- **GitHub Pages** — push the folder to a repo, enable Pages.
Then submit `sitemap.xml` in **Google Search Console** so Google indexes every suburb page.

## SEO (already done)
Unique titles + meta per page · per-suburb H1s & local copy · `LocalBusiness`,
`BreadcrumbList` & `Service` schema (JSON-LD, incl. Pickup & Delivery) · canonical URLs ·
Open Graph / Twitter tags · full internal linking · `sitemap.xml` + `robots.txt`.
