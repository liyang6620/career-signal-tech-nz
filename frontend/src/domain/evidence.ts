import type { DecodedRole, SkillEvidence } from "./types";

const evidenceLabels = ["Not evidenced", "Claimed", "Used", "Implemented", "Verified", "Professional"];

export const evidenceLabel = (level: number) =>
  evidenceLabels[Math.max(0, Math.min(5, Math.round(level)))] ?? evidenceLabels[0];

export const evidencePreview = (value: string, limit = 260) => {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= limit) return compact;
  const shortened = compact.slice(0, Math.max(1, limit - 3)).replace(/\s+\S*$/, "").trimEnd();
  return `${shortened}...`;
};

export const scopeMessage = (status: DecodedRole["scope_status"]) => {
  if (status === "mixed") return "This advertisement spans multiple technical disciplines. The analysis therefore compares the closest relevant role families.";
  if (status === "out_of_scope") return "This role does not appear to be a technology position within the fields currently covered by CareerSignal.";
  if (status === "adjacent") return "This position partially aligns with the closest role family. The analysis below prioritises the requirements stated in the advertisement.";
  return "Some requirements are not yet represented in CareerSignal's role-family framework. They remain visible below as advertisement-specific capabilities.";
};

export function dedupeSkillEvidence(items: SkillEvidence[]): SkillEvidence[] {
  const merged = new Map<string, SkillEvidence>();
  for (const item of items) {
    const key = (item.skill_slug || item.skill_name).trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-");
    const current = merged.get(key);
    if (!current) {
      merged.set(key, { ...item });
      continue;
    }
    const representative = item.evidence_level > current.evidence_level
      || (item.evidence_level === current.evidence_level && item.confidence > current.confidence)
      ? item
      : current;
    const sources = new Set(
      `${current.source_type} + ${item.source_type}`
        .split("+")
        .map((source) => source.trim())
        .filter(Boolean),
    );
    merged.set(key, {
      ...representative,
      evidence_level: Math.max(current.evidence_level, item.evidence_level),
      confidence: Math.max(current.confidence, item.confidence),
      source_type: [...sources].sort().join(" + "),
    });
  }
  return [...merged.values()].sort((left, right) => (
    right.evidence_level - left.evidence_level
    || right.confidence - left.confidence
    || left.skill_name.localeCompare(right.skill_name)
  ));
}
