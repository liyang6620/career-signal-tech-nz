# Frontend Standards Applied

CareerSignal uses the following open-source standards and design systems as implementation references. They inform interaction behavior and information architecture; the visual language remains product-specific.

## References

- [WAI-ARIA Authoring Practices](https://github.com/w3c/aria-practices): landmark naming, keyboard focus, form semantics, status messaging and disclosure behavior.
- [Radix Primitives](https://github.com/radix-ui/primitives): predictable focus rings, disabled/loading states and selection semantics for interactive controls.
- [shadcn/ui](https://github.com/shadcn-ui/ui): composable form, table and feedback patterns used as structural references rather than a visual template.
- [GitHub Primer CSS](https://github.com/primer/css): restrained color, spacing, borders and information density for the authenticated workbench.

The visual and interaction review also consulted the component implementations
rather than relying only on screenshots:

- [primer/react](https://github.com/primer/react): `PageLayout`, `NavList`,
  `FormControl` and `DataTable` source and accessibility notes.
- [carbon-design-system/carbon](https://github.com/carbon-design-system/carbon):
  8px-based spacing, layer boundaries and dense data-product layout patterns.
- [microsoft/fluentui](https://github.com/microsoft/fluentui): navigation
  drawer and application-shell state patterns.
- [radix-ui/primitives](https://github.com/radix-ui/primitives): focus,
  selection and state behavior for controls.
- [shadcn/ui](https://github.com/shadcn-ui/ui): composable table, form and
  feedback structure.
- [w3c/aria-practices](https://github.com/w3c/aria-practices): landmark,
  keyboard and status semantics.
- [my-best-resources](https://github.com/Shatlyk1011/my-best-resources): the
  user's curated UX references, including Laws of UX, Minimal Gallery and
  product/SaaS inspiration links.

## Current implementation decisions

- The authenticated shell exposes a labelled product navigation landmark and marks the current route with `aria-current="page"`.
- A keyboard skip link moves focus directly to the main content region.
- Role-family and radar-focus controls expose their selected state with `aria-pressed`.
- Long-running role decoding and evidence search expose busy state and prevent duplicate submissions.
- Error and generated market summaries use live-region semantics so asynchronous feedback is not silently missed.
- Radar charts include a title and description, while the adjacent values/table provide a non-visual reading of the same data.
- Reduced-motion preferences are respected for transitions and animations.

These rules are intentionally implemented with native HTML and the existing React stack so the product does not acquire an unnecessary component-library dependency.

## Product UI audit and redesign record

The workbench was reviewed against the interaction and layout conventions in
Primer's `PageLayout`, `NavList`, `FormControl` and `DataTable` components, as
well as the focus and disclosure guidance in ARIA APG. The audit covered the
authenticated Workspace, Market, Role Decoder, Evidence, Pathways, Profile and
Plan routes at a desktop viewport, with narrow-screen rules checked separately.

The main issues found in the earlier pass were structural rather than purely
cosmetic:

- Navigation treated seven different jobs as one flat list, so the user could
  not tell whether a page was for orientation, investigation or action.
- The page header did not carry the current market and target-role context,
  which made each route feel disconnected from the saved profile.
- Large bordered surfaces had similar visual weight even when one was an input
  form and another was a result set. This created a generic dashboard rhythm.
- The most important evidence was often below a title block without a clear
  “input → analysis → decision” sequence.

The current workbench layer addresses these findings with a small, explicit
design system:

1. The persistent rail is grouped as `Orient`, `Investigate` and `Act`. This is
   a task model, not a visual decoration; it follows the information scent
   principle and keeps the navigation stable as more role families are added.
2. The top bar carries a breadcrumb-like product context, market scope and
   selected target role. A user can therefore understand the scope of a score
   without reopening Workspace.
3. Content pages use a consistent reading column and a deliberate hierarchy:
   page context, page title, short explanation, then one work surface. Results
   use rules, tables and metric strips before secondary panels.
4. The palette is neutral and border-led (`#f3f1eb` paper canvas, warm white
   surfaces, `#d5dcd6` rules and petrol `#0e5b59` actions). Rust is reserved
   for requirement or warning signals and green is reserved for confirmed
   state. There are no gradients, glow effects or decorative background
   shapes.
5. Responsive behavior preserves the same task model: the rail becomes a
   horizontally scrollable navigation strip on small screens, while content
   remains a single readable column. Fixed-width desktop assumptions are
   removed at the breakpoint.

This is intentionally a product-system change, not a claim that the UI is
complete. Future additions should reuse the existing page header, metric strip,
table and status patterns rather than introduce a new card style for each
feature.

## Second-pass implementation notes

The initial Primer-like pass was rejected because it still made each route look
like a large white card. The second pass changes the work shape itself:

- Workspace is now a target header, metric strip, next-decision panel and
  evidence ledger. The user sees what to do next without reopening setup.
- Market is now a workbench with a role-family toolbar, metric strip, two
  evidence tables, adjacent demand and a next-step band. Skill rows show count
  and share together; charts are supplementary rather than the only interface.
- Role Decoder keeps the JD input as the primary action and adds a narrow
  “analysis flow” pane explaining scope detection, JD-specific requirements and
  evidence comparison. This makes the product behavior legible without using
  an AI-themed explanation card.
- Empty market data is treated as a recoverable product state with two actions,
  rather than an error-looking message with no route forward.

The component research supports these choices. Primer's `PageLayout` examples
keep panes between roughly 240–320px and content widths around 1012–1280px;
Carbon's layout tokens use a compact 8px-based rhythm and explicit “layer”
boundaries; Primer `DataTable` keeps titles, headers and row semantics visible.
The implementation adapts those principles with native HTML and the project's
existing React stack.

## Anti-template review

The visual pass also used two focused references on avoiding generic
AI-generated interfaces:

- [Magic Patterns: Stop Settling for Generic AI UI](https://www.magicpatterns.com/blog/aeo/blog/solution-recommendation/we-tried-a-code-focused-ai-app-builder-and-the-designs-looked-generic-what-do-product-teams-use-when-1a8e11), which identifies missing product context and disconnected flows as the root cause of generic output.
- [How to stop your frontend looking AI-generated](https://medium.com/design-bootcamp/how-to-stop-your-frontend-looking-ai-generated-efbb9681a6a2), which calls out Inter-everywhere typography, gradients, default purple/blue palettes, centred hero blocks, three equal feature cards, card-in-card layouts, generic eyebrows and missing states.

The resulting decisions are intentionally specific to CareerSignal:

- IBM Plex Sans is bundled locally for interface copy, IBM Plex Mono is used
  for changing evidence and market values, and IBM Plex Serif gives report
  titles a distinct editorial hierarchy.
- Page headers are compact and separated by a rule. The main work starts
  earlier instead of being pushed below an oversized hero block.
- Market and evidence screens prioritise tables, ledgers and source rows.
  Cards are reserved for an actual work surface, not used as a repeated page
  decoration.
- The shell uses sentence-case task groups and hides unfinished utility
  entries. Empty and loading states provide a recoverable next action.

## Structural workbench pass

The later review found that a visual skin alone still left the app feeling like
the same generated dashboard. The authenticated shell and Workspace therefore
received a structural pass:

- The persistent rail now carries the current target role, location and level,
  so the user's scope is visible without reopening a page.
- Workspace now opens with a profile command strip, a decision-scope column,
  an evidence readiness band, a next-decision surface and an evidence ledger.
  These are ordered by the user's decision flow rather than arranged as equal
  feature cards.
- The command strip shows profile freshness and connected evidence sources,
  while the scope column explains exactly what a score is measuring.
- Responsive rules collapse the scope column into a readable brief instead of
  shrinking the desktop card grid until it becomes unusable.
- Workspace now includes a data-backed Career Signal Map. It connects the
  selected role to the highest-weighted capabilities, uses node size for
  evidence maturity and distinguishes confirmed from pending proof. It is a
  product-specific visual explanation, not a decorative background graphic.

The visual benchmark review also inspected public product screenshots for
[LinkedIn Talent Insights](https://www.linkedin.com/talent-solutions/talent-insights),
[Lightcast](https://lightcast.io/) and [Teal](https://www.tealhq.com/). The
useful patterns were their filter-first market views, dense source tables,
explicit date and coverage context, and task-oriented job records. CareerSignal
borrows those information patterns without copying their brand styling.
