import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const baseURL = process.env.SIGNAL_BASE_URL || "http://127.0.0.1:4198";
const output = new URL("./screenshots/signal/", import.meta.url);
const docsOutput = new URL("../../docs/screenshots/", import.meta.url);
const sizes = [["desktop", 1440, 1000], ["mobile", 390, 844]];

await mkdir(output, { recursive: true });
await mkdir(docsOutput, { recursive: true });
const browser = await chromium.launch();

async function openDemoPage(page, path) {
  await page.goto(`${baseURL}/`);
  if (path.startsWith("/app")) {
    await page.getByRole("button", { name: "Explore live demo" }).click();
  }
  await page.goto(`${baseURL}${path}`);
  await page.waitForLoadState("networkidle");
}

async function capture(label, path, prepare) {
  for (const [size, width, height] of sizes) {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    await openDemoPage(page, path);
    if (prepare) await prepare(page);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.waitForTimeout(100);
    await page.screenshot({ path: fileURLToPath(new URL(`${label}-${size}.png`, output)), fullPage: true });
    await context.close();
  }
}

async function captureDocs(label, path, prepare, anchor) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await context.newPage();
  await openDemoPage(page, path);
  if (prepare) await prepare(page);
  if (anchor) {
    await anchor(page).scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy({ top: -150, behavior: "instant" }));
  } else {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  }
  await page.waitForTimeout(150);
  await page.screenshot({ path: fileURLToPath(new URL(label, docsOutput)) });
  await context.close();
}

await capture("landing", "/");
await capture("signin", "/login");
await capture("overview", "/app/workspace");
await capture("evidence", "/app/record");
await capture("analysis", "/app/profile");
await capture("settings", "/app/settings");

await capture("decode-result", "/app/roles/decode", async (page) => {
  await page.getByLabel("Advertised title").fill("Junior Data Engineer");
  await page.getByLabel("Job advertisement").fill("Harbour Analytics needs a Junior Data Engineer to build reliable SQL and Python pipelines on AWS. Applicants must test data quality, support Airflow orchestration, collaborate with analysts, and already have the right to work in New Zealand.");
  await page.getByRole("button", { name: "Compare with my profile" }).click();
  await page.getByRole("heading", { name: "Annotated advertisement" }).waitFor();
});

await capture("market-results", "/app/market", async (page) => {
  await page.getByLabel("Market question or capability").fill("testing expectations for junior data engineers");
  await page.getByRole("button", { name: "Search job records" }).click();
  await page.getByText("Harbour Analytics", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Generate summary" }).click();
  await page.getByText("grounded-demo-summary", { exact: true }).waitFor();
});

await capture("applications-compare", "/app/jobs", async (page) => {
  await page.getByRole("button", { name: "Compare saved roles" }).click();
  const toggles = page.locator(".job-compare-toggle input");
  await toggles.nth(0).check();
  await toggles.nth(1).check();
  await page.getByRole("heading", { name: "What each job is asking for" }).waitFor();
});

await capture("applications-closed", "/app/jobs", async (page) => {
  await page.locator(".signal-stage-select select").first().selectOption("rejected");
  await page.getByRole("button", { name: /View Closed 1/ }).click();
  await page.getByRole("region", { name: "Closed and archived applications" }).waitFor();
});

await capture("setup", "/app/workspace", async (page) => {
  await page.getByRole("button", { name: "Edit target" }).click();
});

await captureDocs("capability-profile.png", "/app/profile");

await captureDocs("role-decoder.png", "/app/roles/decode", async (page) => {
  await page.getByLabel("Advertised title").fill("Junior Data Engineer");
  await page.getByLabel("Job advertisement").fill("Harbour Analytics needs a Junior Data Engineer to build reliable SQL and Python pipelines on AWS. Applicants must test data quality, support Airflow orchestration, collaborate with analysts, and already have the right to work in New Zealand.");
  await page.getByRole("button", { name: "Compare with my profile" }).click();
  await page.getByRole("heading", { name: "Annotated advertisement" }).waitFor();
}, (page) => page.locator(".decoder-jobhead"));

await captureDocs("saved-role-comparison.png", "/app/jobs", async (page) => {
  await page.getByRole("button", { name: "Compare saved roles" }).click();
  const toggles = page.locator(".job-compare-toggle input");
  await toggles.nth(0).check();
  await toggles.nth(1).check();
  await page.getByRole("heading", { name: "What each job is asking for" }).waitFor();
}, (page) => page.locator(".jobs-compare-panel"));

await captureDocs("career-pathways.png", "/app/profile", undefined,
  (page) => page.getByRole("heading", { name: "Adjacent paths" }));

await browser.close();
