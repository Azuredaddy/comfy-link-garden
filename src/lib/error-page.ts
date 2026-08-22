// Dependency-free so it still renders when the rest of the app fails to load.
export function renderErrorPage(): string {
  return `<!doctype html><html lang="en-AU"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Something went wrong | Lanky Services</title>
<style>body{margin:0;background:#0a0d0b;color:#f3f6ef;font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh}
.box{max-width:520px;padding:32px;text-align:center}h1{font-size:22px;margin:0 0 10px}
p{color:#9aa793;margin:0 0 22px}a,button{display:inline-block;margin:0 6px;padding:12px 18px;border-radius:10px;border:1px solid #26301f;background:transparent;color:#f3f6ef;font:inherit;text-decoration:none;cursor:pointer}
a.primary{background:#a3e635;color:#10160c;border-color:#a3e635;font-weight:600}</style></head>
<body><div class="box"><h1>Sorry — something went wrong</h1>
<p>We hit a temporary problem loading this page. Please try again, or call us on <a href="tel:0439973051" style="border:0;padding:0;color:#a3e635">0439&nbsp;973&nbsp;051</a>.</p>
<button onclick="location.reload()">Try again</button><a class="primary" href="/">Go home</a></div></body></html>`;
}
