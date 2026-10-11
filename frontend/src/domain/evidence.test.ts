import { describe, expect, it } from "vitest";
import { dedupeSkillEvidence, evidenceLabel, evidencePreview, scopeMessage } from "./evidence";

describe("evidence helpers", () => {
  it("keeps the strongest record for each canonical skill", () => {
    const result = dedupeSkillEvidence([
      { skill_slug: "aws", skill_name: "AWS", category: "Cloud", evidence_level: 2, confidence: 0.91, excerpt: "Used AWS", locator: "CV", source_type: "cv" },
      { skill_slug: "aws", skill_name: "Amazon Web Services", category: "Cloud", evidence_level: 4, confidence: 0.82, excerpt: "Deployed a service", locator: "README", source_type: "github" },
      { skill_slug: "sql", skill_name: "SQL", category: "Data", evidence_level: 3, confidence: 0.9, excerpt: "Built models", locator: "CV", source_type: "cv" },
    ]);

    expect(result).toHaveLength(2);
    expect(result.find((item) => item.skill_slug === "aws")?.evidence_level).toBe(4);
  });

  it("makes long evidence excerpts readable without breaking words", () => {
    const text = `${"Evidence ".repeat(40)}finishes here.`;
    const preview = evidencePreview(text, 100);
    expect(preview.length).toBeLessThanOrEqual(101);
    expect(preview.endsWith("...")).toBe(true);
    expect(preview).not.toMatch(/\s\.\.\.$/);
  });

  it("keeps short excerpts and bounds maturity labels", () => {
    expect(evidencePreview("  concise   evidence  ")).toBe("concise evidence");
    expect(evidenceLabel(-2)).toBe("Not evidenced");
    expect(evidenceLabel(9)).toBe("Professional");
  });

  it.each([
    ["mixed", "multiple technical disciplines"],
    ["out_of_scope", "does not appear to be a technology position"],
    ["adjacent", "partially aligns"],
    ["matched", "not yet represented"],
  ] as const)("describes %s analysis scope", (status, phrase) => {
    expect(scopeMessage(status)).toContain(phrase);
  });
});
