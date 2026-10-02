// Rendered mobile audit: loads every route at phone/tablet sizes in Chromium (mobile emulation) and WebKit,
// screenshots it, and records horizontal overflow, small tap targets, sub-16px inputs, sub-12px text,
// fixed/sticky edge elements and console errors.
//
// Usage (against a running app, e.g. `npm run build && npm start`):
//   npm run audit:mobile -- [--routes dashboard,admin] [--engines chromium] [--widths 375] [--no-screenshots]
// Env (put in a gitignored env file and pass with --env-file):
//   AUDIT_BASE_URL            default http://localhost:3000
//   AUDIT_SALES_EMAIL / AUDIT_SALES_PASSWORD   a salesperson login (QA account)
//   AUDIT_ADMIN_EMAIL / AUDIT_ADMIN_PASSWORD   an admin login (QA account)
//   AUDIT_VIEW_AS             staff id of a salesperson with data, viewed read-only through the admin
//   AUDIT_DEAL_ID             a deal id for the edit form
//   AUDIT_MONTH               month with data for admin pages, default previous month
// Output: audit/results/<engine>.json and audit/screenshots/<route>-<width>-<engine>.png
// Screenshots contain customer names — audit/screenshots/ and audit/results/ are gitignored.
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { type Browser, type BrowserContext, chromium, type Page, webkit } from "playwright";

type Role = "public" | "sales" | "viewAs" | "admin";
type Route = { slug: string; path: string; role: Role; surface: "consumer" | "internal" };

const BASE = process.env.AUDIT_BASE_URL ?? "http://localhost:3000";
const OUT = join(process.cwd(), "audit");
const prevMonth = (() => {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 7);
})();
const MONTH = process.env.AUDIT_MONTH ?? prevMonth;

const ROUTES: Route[] = [
  { slug: "login", path: "/login", role: "public", surface: "consumer" },
  { slug: "dashboard-empty", path: "/dashboard", role: "sales", surface: "consumer" },
  { slug: "dashboard-data", path: `/dashboard?month=${MONTH}`, role: "viewAs", surface: "consumer" },
  { slug: "history", path: "/history", role: "viewAs", surface: "consumer" },
  { slug: "deal-new", path: "/deals/new", role: "sales", surface: "consumer" },
  { slug: "change-password", path: "/change-password", role: "sales", surface: "consumer" },
  { slug: "admin-store", path: `/admin?month=${MONTH}`, role: "admin", surface: "internal" },
  { slug: "admin-deals", path: `/admin/deals?month=${MONTH}`, role: "admin", surface: "internal" },
  { slug: "admin-spiffs", path: "/admin/spiffs", role: "admin", surface: "internal" },
  { slug: "admin-staff", path: "/admin/staff", role: "admin", surface: "internal" },
  { slug: "admin-settings", path: "/admin/settings", role: "admin", surface: "internal" },
  ...(process.env.AUDIT_DEAL_ID
    ? [{ slug: "deal-edit-admin", path: `/deals/${process.env.AUDIT_DEAL_ID}`, role: "admin" as Role, surface: "internal" as const }]
    : []),
];

const VIEWPORTS = [
  { width: 360, height: 740 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
];

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1]?.split(",") : undefined;
};
const routeFilter = arg("routes");
const engineFilter = arg("engines");
const widthFilter = arg("widths")?.map(Number);
const screenshots = !process.argv.includes("--no-screenshots");

// Runs inside the page: collects every metric for one route/viewport
const inspect = () => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const sel = (el: Element): string => {
    const part = (e: Element) => {
      const cls = [...e.classList].filter((c) => !c.includes("[") && !c.includes(":")).slice(0, 3).join(".");
      // getAttribute: form.id is shadowed when the form has an input named "id"
      const id = e.getAttribute("id");
      return `${e.tagName.toLowerCase()}${id ? `#${id}` : ""}${cls ? `.${cls}` : ""}`;
    };
    const chain: string[] = [];
    let cur: Element | null = el;
    while (cur && chain.length < 3 && cur !== document.body) {
      chain.unshift(part(cur));
      cur = cur.parentElement;
    }
    return chain.join(" > ");
  };
  const visible = (el: Element) => {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    // Content of a closed <details> still has a box in Chromium but isn't shown
    const inClosedDetails = !!el.closest("details:not([open])") && !el.closest("summary");
    return s.display !== "none" && s.visibility !== "hidden" && r.width > 0 && r.height > 0 && !inClosedDetails;
  };
  const inScroller = (el: Element) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX;
      if (ox === "auto" || ox === "scroll" || ox === "hidden") return true;
    }
    return false;
  };

  // Horizontal overflow — report root causes (overflowing elements whose parent fits) outside scroll containers
  const overflowing = [...document.querySelectorAll("body *")].filter(
    (el) => visible(el) && el.getBoundingClientRect().right > vw + 1 && !inScroller(el),
  );
  const overflowRoots = overflowing
    .filter((el) => !el.parentElement || el.parentElement.getBoundingClientRect().right <= vw + 1)
    .map((el) => ({ selector: sel(el), right: Math.round(el.getBoundingClientRect().right), width: Math.round(el.getBoundingClientRect().width) }));

  // Tap targets — checkbox/radio inside a <label> are measured by the label
  const interactive = [
    ...document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [onclick]'),
  ].filter(visible);
  const targets = interactive.map((el) => {
    const label = el.matches("input[type=checkbox], input[type=radio]") ? el.closest("label") : null;
    const box = (label ?? el).getBoundingClientRect();
    return { el, box, selector: sel(label ?? el), label: (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40) };
  });
  const smallTargets = targets
    .filter((t) => t.box.width < 44 || t.box.height < 44)
    .map((t) => ({ selector: t.selector, text: t.label, w: Math.round(t.box.width), h: Math.round(t.box.height) }));
  const gap = (a: DOMRect, b: DOMRect) =>
    Math.max(0, Math.max(a.left, b.left) - Math.min(a.right, b.right), Math.max(a.top, b.top) - Math.min(a.bottom, b.bottom));
  const crowded: { a: string; b: string; gap: number }[] = [];
  targets.forEach((t, i) =>
    targets.slice(i + 1).forEach((u) => {
      if (t.el.contains(u.el) || u.el.contains(t.el) || t.selector === u.selector) return;
      const g = gap(t.box, u.box);
      if (g < 8) crowded.push({ a: t.selector, b: u.selector, gap: Math.round(g) });
    }),
  );

  const smallInputs = [...document.querySelectorAll("input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, textarea, [contenteditable=true]")]
    .filter(visible)
    .map((el) => ({ selector: sel(el), fontSize: parseFloat(getComputedStyle(el).fontSize) }))
    .filter((x) => x.fontSize < 16);

  const smallText = new Map<string, number>();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (!el || !n.textContent?.trim() || !visible(el)) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 12) smallText.set(sel(el), fs);
  }

  const edgeElements = [...document.querySelectorAll("body *")]
    .filter((el) => ["fixed", "sticky"].includes(getComputedStyle(el).position) && visible(el))
    .map((el) => {
      const r = el.getBoundingClientRect();
      return { selector: sel(el), position: getComputedStyle(el).position, top: Math.round(r.top), bottomGap: Math.round(vh - r.bottom) };
    });

  const viewportMeta = document.querySelector('meta[name="viewport"]')?.getAttribute("content") ?? null;

  return {
    viewportMeta,
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: vw,
    horizontalOverflow: document.documentElement.scrollWidth > vw,
    overflowRoots,
    smallTargets,
    crowded: crowded.slice(0, 50),
    crowdedCount: crowded.length,
    smallInputs,
    smallText: [...smallText.entries()].map(([selector, fontSize]) => ({ selector, fontSize })),
    edgeElements,
  };
};

const login = async (browser: Browser, email: string | undefined, password: string | undefined) => {
  if (!email || !password) throw new Error("Missing audit login credentials (see header of scripts/mobile-audit.ts)");
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 }), page.click("button[type=submit]")]);
  const state = await ctx.storageState();
  await ctx.close();
  return state;
};

const run = async () => {
  await mkdir(join(OUT, "screenshots"), { recursive: true });
  await mkdir(join(OUT, "results"), { recursive: true });
  const engines = [
    { name: "chromium", type: chromium },
    { name: "webkit", type: webkit },
  ].filter((e) => !engineFilter || engineFilter.includes(e.name));
  const routes = ROUTES.filter((r) => !routeFilter || routeFilter.some((f) => r.slug.includes(f)));
  const viewports = VIEWPORTS.filter((v) => !widthFilter || widthFilter.includes(v.width));

  for (const engine of engines) {
    const browser = await engine.type.launch();
    const needs = new Set(routes.map((r) => r.role));
    const sales = needs.has("sales") ? await login(browser, process.env.AUDIT_SALES_EMAIL, process.env.AUDIT_SALES_PASSWORD) : undefined;
    const admin =
      needs.has("admin") || needs.has("viewAs")
        ? await login(browser, process.env.AUDIT_ADMIN_EMAIL, process.env.AUDIT_ADMIN_PASSWORD)
        : undefined;
    const host = new URL(BASE).hostname;
    const viewAsCookie = process.env.AUDIT_VIEW_AS
      ? [{ name: "view_as", value: process.env.AUDIT_VIEW_AS, domain: host, path: "/", httpOnly: true, secure: false, sameSite: "Lax" as const, expires: -1 }]
      : [];
    const stateFor = (role: Role) =>
      role === "sales" ? sales : role === "admin" ? admin : role === "viewAs" ? admin && { ...admin, cookies: [...admin.cookies, ...viewAsCookie] } : undefined;

    const results: unknown[] = [];
    for (const vp of viewports) {
      for (const route of routes) {
        const mobile = vp.width < 768;
        let ctx: BrowserContext | undefined;
        try {
          ctx = await browser.newContext({
            viewport: vp,
            deviceScaleFactor: 2,
            // Firefox doesn't support isMobile; Chromium and WebKit do
            isMobile: mobile,
            hasTouch: true,
            storageState: stateFor(route.role),
          });
          const page: Page = await ctx.newPage();
          // tsx (esbuild keepNames) wraps functions in __name(); define it in the page so `inspect` can run there
          await page.addInitScript({ content: "window.__name = (fn) => fn;" });
          const consoleErrors: string[] = [];
          page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text().slice(0, 200)));
          page.on("pageerror", (e) => consoleErrors.push(e.message.slice(0, 200)));
          const res = await page.goto(`${BASE}${route.path}`, { waitUntil: "networkidle", timeout: 45000 });
          const metrics = await page.evaluate(inspect);
          if (screenshots) {
            await page.screenshot({ path: join(OUT, "screenshots", `${route.slug}-${vp.width}-${engine.name}.png`), fullPage: true });
          }
          results.push({ route: route.slug, path: route.path, surface: route.surface, finalUrl: new URL(page.url()).pathname, status: res?.status(), ...vp, engine: engine.name, consoleErrors, ...metrics });
          process.stdout.write(
            `${engine.name} ${vp.width} ${route.slug.padEnd(16)} overflow=${metrics.horizontalOverflow ? "YES" : "no "} smallTargets=${metrics.smallTargets.length} smallInputs=${metrics.smallInputs.length} smallText=${metrics.smallText.length} errors=${consoleErrors.length}\n`,
          );
        } catch (err) {
          results.push({ route: route.slug, ...vp, engine: engine.name, error: String(err).slice(0, 300) });
          process.stdout.write(`${engine.name} ${vp.width} ${route.slug} ERROR ${String(err).slice(0, 120)}\n`);
        } finally {
          await ctx?.close();
        }
      }
    }
    await writeFile(join(OUT, "results", `${engine.name}.json`), JSON.stringify(results, null, 2));
    await browser.close();
  }
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
