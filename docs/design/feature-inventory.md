# CareerSignal feature inventory

This is the retained feature checklist for the approved Signal information
architecture. Data comes from the API or the session-scoped demo adapter; the
UI does not hard-code the values shown in the design references.

## Public and account flows

- Landing page: live demo, create account, sign in and PWA install entry.
- Register, sign in, forgot/reset password and email verification.
- Service waking/unavailable feedback, offline page and signed-in/signed-out 404.
- Settings: identity and verification state, sign out, JSON export and confirmed
  account deletion.

## Overview and setup

- `/app/workspace` saved state summarises the target role, signal, coverage,
  evidence depth, priority gaps, registered sources, role-family scores and
  application stages.
- The editing state retains the three-step setup flow: target context; CV,
  GitHub and portfolio intake; then consent and item-by-item evidence review.
- Upload scanning/parsing states, retry/removal, CV versions, GitHub repository
  selection and manual evidence remain available.

## My evidence

- `/app/record` lists confirmed skills with proof level, excerpt, locator and
  confidence.
- Source register covers CV processing, saved CV versions, selected public
  GitHub repositories, portfolio and manual evidence.
- Privacy and processing boundaries remain visible.

## Analysis

- `/app/profile` combines the former Profile and Pathways pages.
- Five role-family cards show signal, coverage, priority gaps and available
  advert context.
- The selected role provides a skill-by-skill benchmark, market frequency,
  proof level, evidence score and source locator.
- The leverage view compares market demand with evidence strength and marks
  prior-only values where posting evidence is unavailable.
- Adjacent paths retain three alternatives, their demand context and the next
  evidence gap, with routes to analysis and the decoder.
- Evidence quality is limited to proof-level distribution, domain strength and
  source coverage; methodology and benchmark sources remain inspectable.

## Job decoder

- `/app/roles/decode` accepts a title and advert text, reports role-family and
  seniority proximity, and keeps eligibility conditions separate from skill fit.
- Results include the annotated advert when source text is available, numbered
  notes, quoted eligibility requirements, unmapped skills and mixed-scope focus.
- Skill comparison exposes the score components, evidence state and importance
  label. Analyses can be restored and saved to Applications.

## Market

- `/app/market` provides role-family demand, sample share, graduate/junior
  context, sources, employer-mentioned skills with the user's proof, geography,
  related demand and the complete coverage/limitations disclosure.
- Employer-evidence retrieval now lives on this page: natural-language query,
  citation cards, relevance feedback, retrieval-quality measures, grounded
  summary, save-role and source links.

## Applications

- `/app/jobs` retains Saved, Preparing, Applied, Interview and Offer stages,
  plus an explicit Closed/Archived view.
- Cards retain readiness, priority gaps, stage history, notes, analysis/fit
  actions, removal and keyboard-accessible status changes.
- Compare mode supports two or three saved roles and shows decision factors,
  technical summaries and a requirement matrix with the user's proof.

## Global behaviour

- Top navigation: Overview, My evidence, Analysis, Job decoder, Market and
  Applications; avatar opens Settings.
- Demo and service banners, skip link, live regions, reduced motion, responsive
  mobile navigation, offline/PWA support and the Capacitor Android wrapper remain.
- Signal colours carry fixed semantics: ultramarine for demand, green for held
  proof, vermilion for gaps and neutral grey for comparison.
