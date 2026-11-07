import { describe, expect, it } from "vitest";
import { demoLandingData } from "./demoApi";

describe("demo market data", () => {
  it("keeps role totals and skill aggregates internally consistent", () => {
    const { market } = demoLandingData;
    const roleTotal = market.roles.reduce((sum, role) => sum + role.count, 0);
    expect(roleTotal).toBe(market.posting_count);

    const topSkillCounts = new Map(market.top_skills.map((skill) => [skill.skill_slug, skill.count]));
    const roleSkillTotals = new Map<string, number>();
    market.role_skills.forEach((skill) => {
      roleSkillTotals.set(skill.skill_slug, (roleSkillTotals.get(skill.skill_slug) ?? 0) + skill.count);
    });

    roleSkillTotals.forEach((roleCount, slug) => {
      expect(topSkillCounts.get(slug), `${slug} must have a global skill total`).toBeDefined();
      expect(roleCount, `${slug} role counts cannot exceed its global total`).toBeLessThanOrEqual(topSkillCounts.get(slug)!);
    });
  });
});
