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
  await expect(page.getByRole("heading", { name: "CareerSignal Tech NZ" })).toBeVisible();
  await expectNoSeriousAccessibilityViolations(page);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();

  await page.goto("/app/market");
  await expect(page).toHaveURL(/\/login\?returnTo=%2Fapp%2Fmarket/);
});

test("the legacy plan route resolves to the capability profile", async ({ page }) => {
  await mockAuthenticatedApi(page);
  await page.goto("/app/plan");

  await expect(page).toHaveURL(/\/app\/profile$/);
  await expect(page.getByRole("heading", { name: "All the evidence you can currently prove" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Three views of evidence quality" })).toBeVisible();
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
  await mockAuthenticatedApi(page);
  await page.goto("/app/profile");

  await expect(page.getByRole("heading", { name: "All the evidence you can currently prove" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "What your evidence currently shows" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Three views of evidence quality" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Why this profile is evidence-led" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Evidence strength by skill" })).toBeVisible();
  const evidenceRows = page.locator(".personal-graph-register > div");
  await expect(evidenceRows).toHaveCount(2);
  await expect(evidenceRows.filter({ hasText: "SQL" })).toHaveCount(1);
  await expect(evidenceRows.filter({ hasText: "Python" })).toHaveCount(1);
  await expectNoSeriousAccessibilityViolations(page);
});

test("a saved opportunity opens the shared capability profile", async ({ page }) => {
  await mockAuthenticatedApi(page);
  await page.goto("/app/jobs");

  await expect(page.getByText("2 / 5")).toBeVisible();
  await expect(page.getByText(/Next: Automated Testing, Airflow/)).toBeVisible();
  await page.getByRole("button", { name: "Review fit" }).first().click();

  await expect(page).toHaveURL(/\/app\/profile$/);
  await expect(page.getByRole("heading", { name: "How your evidence travels across roles" })).toBeVisible();
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
  await expect(page.getByText("SQL", { exact: true })).toBeVisible();
  await expect(page.getByText("Python", { exact: true })).toBeVisible();
  await page.waitForTimeout(300);
  expect(detailRequests).toBe(2);
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
    await expect(page.getByRole("heading", { name: "Plan the next evidence move" })).toBeVisible();

    const rows = page.locator(".pathway-route-card");
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
