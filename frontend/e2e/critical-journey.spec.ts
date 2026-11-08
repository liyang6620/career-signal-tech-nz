import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const user = { id: "00000000-0000-0000-0000-000000000001", email: "candidate@example.com", display_name: "Candidate", is_verified: true };
const profile = {
  id: "00000000-0000-0000-0000-000000000002",
  location: "Auckland",
  seniority: "Graduate / Junior",
  role_family: "data-engineer",
  evidence_sources: [],
  updated_at: "2026-10-02T00:00:00Z",
};
const fit = {
  role_family: "data-engineer",
  score: 58,
  coverage: 55,
  evidence_depth: 64,
  cap_applied: false,
  contributions: [
    { skill_slug: "sql", skill_name: "SQL", weight: 1.6, required: true, evidence_level: 3, evidence_confidence: 0.9, source_count: 2, source_type_count: 2, normalized_score: 74, weighted_score: 74, market_frequency: 0, base_score: 70, confidence_adjustment: 4, corroboration_bonus: 0, diversity_bonus: 0, score_factors: [] },
    { skill_slug: "python", skill_name: "Python", weight: 1.4, required: true, evidence_level: 2, evidence_confidence: 0.8, source_count: 2, source_type_count: 2, normalized_score: 58, weighted_score: 58, market_frequency: 0, base_score: 55, confidence_adjustment: 3, corroboration_bonus: 0, diversity_bonus: 0, score_factors: [] },
  ],
};
const tasks = [
  {
    id: "00000000-0000-0000-0000-000000000010",
    saved_job_id: "00000000-0000-0000-0000-000000000020",
    role_family: "data-engineer",
    skill_slug: "sql",
    stage: "diagnose",
    position: 1,
    due_week: 2,
    title: "Define credible proof for SQL",
    description: "Translate the requirement into acceptance criteria.",
    deliverable: "Evidence checklist and acceptance criteria.",
    status: "pending",
    completed_at: null,
    created_at: "2026-10-02T00:00:00Z",
    updated_at: "2026-10-02T00:00:00Z",
  },
];
const savedJob = {
  id: "00000000-0000-0000-0000-000000000020",
  analysis_id: "00000000-0000-0000-0000-000000000021",
  source_url: "https://jobs.example.nz/data-engineer",
  title: "Graduate Data Engineer",
  company: "Example NZ",
  location: "Auckland",
  role_family: "data-engineer",
  description: "Build SQL and Python data pipelines with automated testing.",
  status: "saved",
  notes: null,
  evidenced_skill_count: 2,
  skill_count: 5,
  top_gaps: ["Automated Testing", "Airflow"],
  created_at: "2026-10-02T00:00:00Z",
  updated_at: "2026-10-02T00:00:00Z",
};
const comparisonJob = {
  ...savedJob,
  id: "00000000-0000-0000-0000-000000000022",
  analysis_id: "00000000-0000-0000-0000-000000000023",
  title: "Junior Analytics Engineer",
  company: "Second Example NZ",
  source_url: "https://jobs.example.nz/analytics-engineer",
  skill_count: 4,
  evidenced_skill_count: 1,
  top_gaps: ["dbt"],
};
const savedAnalysisDetail = {
  analysis_id: savedJob.analysis_id,
  role_family: "data-engineer",
  role_label: "Data Engineer / Analytics Engineer",
  confidence: 0.88,
  seniority: "Graduate / Junior",
  scope_status: "matched",
  taxonomy_coverage: 0.9,
  matched_skills: [],
  skill_demands: [
    { slug: "sql", name: "SQL", required: true, importance: "essential", role_families: ["data-engineer"], mention_count: 3, demand_score: 82, explicit_mention: 1, repetition_signal: 0.7, requirement_signal: 0.8, title_signal: 0, evidence_level: 3, evidence_score: 74, evidence_confidence: 0.9, source_count: 2, source_type_count: 2, evidence_base_score: 70, confidence_adjustment: 4, corroboration_bonus: 0, diversity_bonus: 0 },
    { slug: "python", name: "Python", required: true, importance: "named", role_families: ["data-engineer"], mention_count: 2, demand_score: 64, explicit_mention: 1, repetition_signal: 0.4, requirement_signal: 0.5, title_signal: 0, evidence_level: 2, evidence_score: 58, evidence_confidence: 0.8, source_count: 2, source_type_count: 2, evidence_base_score: 55, confidence_adjustment: 3, corroboration_bonus: 0, diversity_bonus: 0 },
  ],
  role_matches: [],
  unmapped_skills: [],
  eligibility_requirements: [],
};

async function expectNoSeriousAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  const violations = results.violations.filter((item) => item.impact === "serious" || item.impact === "critical");
  expect(violations, violations.map((item) => `${item.id}: ${item.help}`).join("\n")).toEqual([]);
}

async function mockAuthenticatedApi(page: Page) {
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/v1/auth/refresh") return route.fulfill({ json: { access_token: "test-access-token", token_type: "bearer", user } });
    if (path === "/api/v1/profile") return route.fulfill({ json: profile });
    if (path === "/api/v1/evidence/uploads") return route.fulfill({ json: [] });
    if (path === "/api/v1/evidence/graph") return route.fulfill({ json: { role_family: "data-engineer", evidence: [{ skill_slug: "sql", skill_name: "SQL", category: "data", evidence_level: 3, confidence: 0.9, excerpt: "Built a tested query workflow", locator: "README.md", source_type: "github" }, { skill_slug: "sql", skill_name: "SQL", category: "data", evidence_level: 2, confidence: 0.8, excerpt: "Used SQL in reporting", locator: "CV.pdf", source_type: "cv" }, { skill_slug: "python", skill_name: "Python", category: "programming", evidence_level: 2, confidence: 0.8, excerpt: "Implemented a data pipeline", locator: "CV.pdf", source_type: "cv" }, { skill_slug: "python", skill_name: "Python", category: "programming", evidence_level: 2, confidence: 0.7, excerpt: "Used Python in a project", locator: "README.md", source_type: "github" }] } });
    if (path === "/api/v1/evidence/fit") return route.fulfill({ json: fit });
    if (path === "/api/v1/jobs" && request.method() === "GET") return route.fulfill({ json: [savedJob, comparisonJob] });
    if (path.startsWith("/api/v1/role-decoder/history/") && request.method() === "GET") return route.fulfill({ json: { result: savedAnalysisDetail } });
    if (path === `/api/v1/jobs/${savedJob.id}` && request.method() === "PATCH") {
      const body = request.postDataJSON() as { status: string };
      return route.fulfill({ json: { ...savedJob, status: body.status } });
    }
    if (path === "/api/v1/plan" && request.method() === "GET") return route.fulfill({ json: [] });
    if (path === "/api/v1/plan/generate") return route.fulfill({ json: tasks });
    if (path === "/api/v1/account/export") return route.fulfill({ json: { account: user, profile } });
    if (path.startsWith("/api/v1/plan/") && request.method() === "PATCH") {
      const body = request.postDataJSON() as { status: string };
      return route.fulfill({ json: { ...tasks[0], status: body.status, updated_at: "2026-10-02T01:00:00Z" } });
    }
    return route.fulfill({ status: 404, json: { detail: "Unhandled test request" } });
  });
}

test("public entry and protected routing remain usable", async ({ page }) => {
  await page.route("**/api/v1/auth/refresh", (route) => route.fulfill({ status: 401, json: { detail: "Not authenticated" } }));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "See how your skills match NZ tech roles." })).toBeVisible();
  await expectNoSeriousAccessibilityViolations(page);
  await page.getByRole("navigation").getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();

  await page.goto("/app/market");
  await expect(page).toHaveURL(/\/login\?returnTo=%2Fapp%2Fmarket/);
});

test("the public entry exposes an installable application shell", async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name === "mobile-chrome", "Mobile browsers own the native install prompt and do not expose beforeinstallprompt consistently.");
  await page.addInitScript(() => {
    window.addEventListener("beforeinstallprompt", (event) => event.preventDefault());
  });
  await page.goto("/");

  const manifestLink = page.locator('link[rel="manifest"]');
  await expect(manifestLink).toHaveAttribute("href", "/manifest.webmanifest");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#173a55");

  const manifestResponse = await request.get("/manifest.webmanifest");
  expect(manifestResponse.ok()).toBeTruthy();
  const manifest = await manifestResponse.json();
  expect(manifest.name).toBe("CareerSignal Tech NZ");
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons.map((icon: { sizes: string }) => icon.sizes)).toEqual(["192x192", "512x512", "512x512"]);

  await expect((await request.get("/sw.js")).ok()).toBeTruthy();
  await expect((await request.get("/offline.html")).ok()).toBeTruthy();
  await expect((await request.get("/icons/app-icon-192.png")).ok()).toBeTruthy();
  await expect((await request.get("/icons/app-icon-512.png")).ok()).toBeTruthy();

  const installButton = page.getByRole("button", { name: "Install app" });
  await expect.poll(async () => {
    await page.evaluate(() => {
      const event = new Event("beforeinstallprompt", { cancelable: true });
      Object.assign(event, {
        prompt: () => Promise.resolve(),
        userChoice: Promise.resolve({ outcome: "accepted" }),
      });
      window.dispatchEvent(event);
    });
    return installButton.count();
  }).toBe(1);
  await installButton.click();
  await expect(installButton).toBeHidden();
});

test("a recruiter can explore the complete demo without registering", async ({ page }) => {
  await page.route("**/api/v1/auth/refresh", (route) => route.fulfill({ status: 401, json: { detail: "Not authenticated" } }));
  await page.goto("/");
  await page.getByRole("button", { name: "Explore live demo" }).click();

  await expect(page).toHaveURL(/\/app\/workspace$/);
  await expect(page.getByText("Demo workspace.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Data Engineer / Analytics Engineer" }).first()).toBeVisible();
  await page.getByRole("button", { name: /Applications/ }).click();
  await expect(page.getByRole("heading", { name: "Your role decisions, in one place" })).toBeVisible();
  await expect(page.getByText("Junior Data Engineer", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Graduate Cloud Engineer", { exact: true }).first()).toBeVisible();
  await expectNoSeriousAccessibilityViolations(page);
});

test("demo market search returns grounded job records", async ({ page }) => {
  await page.route("**/api/v1/auth/refresh", (route) => route.fulfill({ status: 401, json: { detail: "Not authenticated" } }));
  await page.goto("/");
  await page.getByRole("button", { name: "Explore live demo" }).click();
  await page.getByRole("button", { name: "Market", exact: true }).click();

  await expect(page.getByText("Graduate and junior").locator("..").getByText("11", { exact: true })).toBeVisible();
  const sqlMarketRow = page.locator(".market-skill-table .market-table-row").filter({ hasText: "SQL" });
  await expect(sqlMarketRow.getByText("Verified", { exact: true })).toBeVisible();
  await page.getByLabel("Market question or capability").fill("junior data engineering testing");
  await page.getByRole("button", { name: "Search job records" }).click();
  await expect(page.getByText("Harbour Analytics", { exact: true })).toBeVisible();
  await expect(page.getByText("Koru Platforms", { exact: true })).toBeVisible();
});

test("the legacy plan route resolves to the capability profile", async ({ page }) => {
  await mockAuthenticatedApi(page);
  await page.goto("/app/plan");

  await expect(page).toHaveURL(/\/app\/profile$/);
  await expect(page.getByRole("heading", { name: "How your evidence travels across roles" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Quality of your evidence" }).first()).toBeVisible();
  await expectNoSeriousAccessibilityViolations(page);
});

test("a user can access a portable account export", async ({ page }) => {
  await mockAuthenticatedApi(page);
  await page.goto("/app/settings");

  await expect(page.getByRole("heading", { name: "Control your account data" })).toBeVisible();
  await expectNoSeriousAccessibilityViolations(page);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download export" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^careersignal-export-\d{4}-\d{2}-\d{2}\.json$/);
});

test("personal capability profile shows evidence analysis", async ({ page }) => {
  test.slow();
  await mockAuthenticatedApi(page);
  await page.goto("/app/profile");

  await expect(page.getByRole("heading", { name: "How your evidence travels across roles" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Quality of your evidence" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Adjacent paths" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Proof levels" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Strength by domain" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Source coverage" })).toBeVisible();
  await expectNoSeriousAccessibilityViolations(page);
});

test("analysis loads market counts for adjacent paths", async ({ page }) => {
  await page.route("**/api/v1/auth/refresh", (route) => route.fulfill({ status: 401, json: { detail: "Not authenticated" } }));
  await page.goto("/");
  await page.getByRole("button", { name: "Explore live demo" }).click();
  await page.getByRole("button", { name: "Analysis", exact: true }).click();

  const advertCounts = page.locator(".adjacent-path-grid article dl > div:nth-child(3) dd");
  await expect(advertCounts).toHaveText(["24", "21", "38"]);
});

test("demo market shares and decoder gaps use consistent signals", async ({ page }) => {
  test.slow();
  await page.route("**/api/v1/auth/refresh", (route) => route.fulfill({ status: 401, json: { detail: "Not authenticated" } }));
  await page.goto("/");

  await expect(page.locator(".landing-preview-list > div > span:first-child > small")).toHaveText([
    "81% market signal",
    "71% market signal",
    "45% market signal",
    "48% market signal",
    "29% market signal",
  ]);
  await expect(page.locator(".landing-preview-list")).not.toContainText("0% market signal");

  await page.getByRole("button", { name: "Explore live demo" }).click();
  await page.goto("/app/profile");
  await expect(page.locator(".signal-skill-table tbody tr td:nth-child(2)")).toHaveText(["81%", "71%", "29%", "45%", "48%"]);

  const labelBoxes = await page.locator(".leverage-label").evaluateAll((labels) => labels.map((label) => {
    const box = label.getBoundingClientRect();
    return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
  }));
  for (let left = 0; left < labelBoxes.length; left += 1) {
    for (let right = left + 1; right < labelBoxes.length; right += 1) {
      const a = labelBoxes[left]; const b = labelBoxes[right];
      expect(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top).toBeTruthy();
    }
  }

  await page.goto("/app/roles/decode");
  await page.getByLabel("Advertised title").fill("Junior Data Engineer");
  await page.getByLabel("Job advertisement").fill("Harbour Analytics needs a Junior Data Engineer to build reliable SQL and Python pipelines on AWS. Applicants must support Airflow orchestration and already have the right to work in New Zealand.");
  await page.getByRole("button", { name: "Compare with my profile" }).click();
  await page.getByRole("heading", { name: "Annotated advertisement" }).waitFor();

  const airflowHighlight = page.locator(".decoder-advert mark.gap").filter({ hasText: "Airflow" });
  await expect(airflowHighlight).toBeVisible();
  await expect(airflowHighlight).toHaveCSS("color", "rgb(240, 74, 35)");
  await expect(airflowHighlight).toHaveCSS("background-color", "rgb(253, 224, 214)");
  await expect(page.locator(".decoder-margin-notes > div.gap").filter({ hasText: "Airflow" })).toContainText("Supporting");
  await expect(page.locator(".decoder-score-panel tbody tr").filter({ hasText: "Airflow" })).toContainText("Supporting");
  await expect(page.locator(".decoder-input")).toHaveCSS("border-top-width", "0px");
});

test("Signal tokens remain the computed application palette", async ({ page }) => {
  await page.route("**/api/v1/auth/refresh", (route) => route.fulfill({ status: 401, json: { detail: "Not authenticated" } }));
  await page.goto("/");
  await page.getByRole("button", { name: "Explore live demo" }).click();
  await expect(page.locator(".signal-report-side")).toBeVisible();
  await expect(page.locator(".primary-button").first()).toBeVisible();
  const palette = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const heading = getComputedStyle(document.querySelector("h1")!);
    const brandField = getComputedStyle(document.querySelector(".signal-report-side")!);
    const primary = getComputedStyle(document.querySelector(".primary-button")!);
    const context = getComputedStyle(document.querySelector(".signal-pagehead .signal-context")!);
    return {
      brandToken: root.getPropertyValue("--brand").trim(),
      inkToken: root.getPropertyValue("--ink").trim(),
      brandField: brandField.backgroundColor,
      primaryBackground: primary.backgroundColor,
      headingColour: heading.color,
      headingTracking: heading.letterSpacing,
      contextColour: context.color,
    };
  });
  expect(palette).toEqual({
    brandToken: "#2f2fe6",
    inkToken: "#0e0e0e",
    brandField: "rgb(47, 47, 230)",
    primaryBackground: "rgb(14, 14, 14)",
    headingColour: "rgb(14, 14, 14)",
    headingTracking: expect.stringMatching(/^-/),
    contextColour: "rgb(79, 77, 70)",
  });

  for (const path of ["/app/record", "/app/profile"]) {
    await page.goto(path);
    await expect(page.locator(".signal-pagehead .signal-context")).toHaveCSS("color", "rgb(79, 77, 70)");
  }
});

test("mobile evidence register is not clipped", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/v1/auth/refresh", (route) => route.fulfill({ status: 401, json: { detail: "Not authenticated" } }));
  await page.goto("/");
  await page.getByRole("button", { name: "Explore live demo" }).click();
  await page.goto("/app/record");
  const layout = await page.locator(".evidence-ledger").evaluate((element) => ({
    pageWidth: document.documentElement.clientWidth,
    pageScrollWidth: document.documentElement.scrollWidth,
    registerWidth: element.clientWidth,
    registerScrollWidth: element.scrollWidth,
  }));
  expect(layout).toEqual({ pageWidth: 390, pageScrollWidth: 390, registerWidth: layout.registerWidth, registerScrollWidth: layout.registerWidth });
});

test("mobile analysis skill rows stay inside their container", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/v1/auth/refresh", (route) => route.fulfill({ status: 401, json: { detail: "Not authenticated" } }));
  await page.goto("/");
  await page.getByRole("button", { name: "Explore live demo" }).click();
  await page.goto("/app/profile");
  await expect(page.locator(".signal-skill-table tbody tr")).toHaveCount(5);

  const bounds = await page.locator(".signal-skill-table .signal-table-wrap").evaluate((container) => {
    const containerBox = container.getBoundingClientRect();
    const cells = Array.from(container.querySelectorAll("td"))
      .filter((cell) => getComputedStyle(cell).display !== "none")
      .map((cell) => {
        const box = cell.getBoundingClientRect();
        return { left: box.left, right: box.right };
      });
    return { containerLeft: containerBox.left, containerRight: containerBox.right, cells };
  });

  expect(bounds.cells.length).toBeGreaterThan(0);
  bounds.cells.forEach((cell) => {
    expect(cell.left).toBeGreaterThanOrEqual(bounds.containerLeft - 0.5);
    expect(cell.right).toBeLessThanOrEqual(bounds.containerRight + 0.5);
  });
});

test("a saved opportunity opens the shared capability profile", async ({ page }) => {
  await mockAuthenticatedApi(page);
  await page.goto("/app/jobs");

  await expect(page.getByText("2 of 5 capabilities evidenced")).toBeVisible();
  await expect(page.getByText(/Next: Automated Testing, Airflow/)).toBeVisible();
  await page.getByRole("button", { name: "Review fit" }).first().click();

  await expect(page).toHaveURL(/\/app\/profile$/);
  await expect(page.getByRole("heading", { name: "How your evidence travels across roles" }).first()).toBeVisible();
  await expectNoSeriousAccessibilityViolations(page);
});

test("saved role titles restore their analysis instead of opening a blank decoder", async ({ page }) => {
  await mockAuthenticatedApi(page);
  await page.goto("/app/jobs");

  await page.getByRole("link", { name: "Graduate Data Engineer" }).click();
  await expect(page).toHaveURL(/\/app\/roles\/decode$/);
  await expect(page.getByRole("heading", { name: "Data Engineer / Analytics Engineer" })).toBeVisible();
});

test("saved roles can be compared side by side", async ({ page }) => {
  await mockAuthenticatedApi(page);
  let detailRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/role-decoder/history/")) detailRequests += 1;
  });
  await page.goto("/app/jobs");

  await page.getByRole("button", { name: "Compare saved roles" }).click();
  const toggles = page.locator(".job-compare-toggle input");
  await toggles.nth(0).check();
  await toggles.nth(1).check();

  await expect(page.getByRole("heading", { name: "What each job is asking for" })).toBeVisible();
  await expect(page.getByText("Your evidence", { exact: true }).last()).toBeVisible();
  await expect(page.getByText("SQL", { exact: true })).toBeVisible();
  await expect(page.getByText("Python", { exact: true })).toBeVisible();
  await page.waitForTimeout(300);
  expect(detailRequests).toBe(2);
});

test("closed and archived applications remain reachable", async ({ page }) => {
  await mockAuthenticatedApi(page);
  await page.goto("/app/jobs");
  await page.locator(".signal-stage-select select").first().selectOption("rejected");
  await page.getByRole("button", { name: /View Closed 1/ }).click();
  await expect(page.getByRole("region", { name: "Closed and archived applications" })).toContainText("Graduate Data Engineer");
});

test("career path rows remain readable across responsive layouts", async ({ page }) => {
  await mockAuthenticatedApi(page);

  for (const viewport of [
    { width: 1180, height: 800 },
    { width: 820, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/app/pathways");
    await expect(page).toHaveURL(/\/app\/profile$/);
    await expect(page.getByRole("heading", { name: "Adjacent paths" })).toBeVisible();

    const rows = page.locator(".adjacent-path-grid article");
    await expect(rows).toHaveCount(3);
    for (const row of await rows.all()) {
      const layout = await row.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        const children = Array.from(element.children).map((child) => {
          const rect = child.getBoundingClientRect();
          return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
        }).filter((child) => child.right > child.left && child.bottom > child.top);
        const overlaps = children.some((first, index) => children.slice(index + 1).some((second) => (
          first.left < second.right - 1
          && first.right > second.left + 1
          && first.top < second.bottom - 1
          && first.bottom > second.top + 1
        )));
        return {
          contained: children.every((child) => child.left >= bounds.left - 1 && child.right <= bounds.right + 1),
          overflows: element.scrollWidth > element.clientWidth + 1,
          overlaps,
        };
      });
      expect(layout).toEqual({ contained: true, overflows: false, overlaps: false });
    }
  }
});
