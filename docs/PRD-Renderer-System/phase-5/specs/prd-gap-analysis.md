# PRD Gap Analysis — Phase 5

## What

Cross-reference of the parent PRD (`PRD-Renderer-System-2026-03-28.md`) against the Phase 5 document (`Phase-5-Reorganization.md`) to identify requirements the PRD mandates but the phase doc doesn't address, contradictions between the documents, and constraints imposed by later phases.

---

## PRD Requirements Applicable to Phase 5

### 1. Graphics Reorganization (PRD lines 911-969)

**PRD Specifies:**
- New category structure: Full-Screen Cards, Lower-Thirds, Full-Bleed, Video Frames, Standalone
- Detailed mapping of graphics to new categories
- Registry changes with new fields: `category`, `subcategory`, `skeleton`, `blocks`

**Phase 5 Coverage:** ✅ FULLY COVERED
- Task 1 lists all graphics with their new category/subcategory assignments
- Task 2 specifies sidebar structure matching PRD categories

**Gap:** None

---

### 2. Registry Field Requirements (PRD lines 957-968)

**PRD Specifies:**
```javascript
{
  id: 'leaderboard-vt',
  label: 'Vault',
  category: 'full-screen-cards',
  subcategory: 'leaderboards',
  renderer: 'stage',
  skeleton: 'full-screen-card',
  blocks: ['header-bar', 'leaderboard-table'],
  // ... existing fields unchanged
}
```

**Phase 5 Coverage:** ⚠️ PARTIAL
- Task 1 only adds `category` and `subcategory` fields
- Does NOT mention `skeleton` or `blocks` fields

**Gap:** Phase 5 does not require adding `skeleton` or `blocks` fields. However, **this is intentional** — those fields are already present on stage engine graphics (added in Phase 2/4) and aren't needed for the reorganization-only scope.

**Clarification needed:** The Phase 5 doc should explicitly state that `skeleton` and `blocks` are already present on migrated graphics and need not be added again.

---

### 3. URL Generator Auto-Population (PRD lines 499-501, 989-1006)

**PRD Specifies:**
- "Sidebar auto-population: The URL Generator and Web Graphics Panel sidebars are generated from `categories.json` ordering + the registry's `category` and `subcategory` fields."
- No separate `baseGraphicTitles` object
- Renderer badge in sidebar: `[stage]` = teal, `[overlay]` = gray, `[output]` = gray

**Phase 5 Coverage:** ✅ FULLY COVERED
- Task 2 specifies sidebar auto-population from registry categories
- Renderer badges are already implemented (confirmed in codebase analysis)

**Gap:** None — badges already exist per Phase 4.

---

### 4. Categories.json Definition (PRD lines 443-496)

**PRD Specifies:**
```json
{
  "full-screen-cards": { "label": "Full-Screen Cards", "order": 1, "subcategories": {...} },
  "lower-thirds": { "label": "Lower-Thirds", "order": 2, "subcategories": {...} },
  "full-bleed": { "label": "Full-Bleed", "order": 3, "subcategories": {...} },
  "video-frames": { "label": "Video Frames", "order": 4, "subcategories": {...} },
  "standalone": { "label": "Standalone", "order": 5, "subcategories": {} }
}
```

**Phase 5 Coverage:** ⚠️ PARTIAL

**Gap 1:** `categories.json` already exists with **6 categories** (includes `event-summary` at order 6), but the PRD only shows 5. The PRD's "Standalone" category list includes Event Summary, but the current implementation has it as a separate category.

**Gap 2:** The Phase 5 doc subcategory structure differs from the current `categories.json`:

| Category | PRD Subcategories | Current categories.json | Phase 5 Doc |
|----------|-------------------|------------------------|-------------|
| full-screen-cards | leaderboards, team-info, sponsors | leaderboards, team-info, sponsors | leaderboards, aa-leaders, rosters, sponsors |
| lower-thirds | event-info, team-stats, spotlight | event-info, team-stats, spotlight | event-info, team-stats, coaches, spotlight |
| full-bleed | slates, stream, sponsors | slates, stream, sponsors | slates, stream, spotlight, sponsors |

**Recommendation:** Phase 5 should update `categories.json` to match the Phase 5 doc's subcategory structure (adding `aa-leaders`, `rosters`, `coaches`).

---

### 5. Gender Filtering (PRD lines 124, 169)

**PRD Specifies:**
- "Gender determines: (1) which apparatus to process — 4 for women (VT, UB, BB, FX), 6 for men (FX, PH, SR, VT, PB, HB)"
- Leaderboard blocks use gender to control column rendering

**Phase 5 Coverage:** ✅ COVERED
- Task 2 mentions: "Leaderboards, stats, and coaches entries are filtered based on the selected competition's gender."

**Gap:** None — gender filtering already works via `isGraphicAvailable()` in the registry.

---

### 6. Subcategory Collapsibility (Phase 5 Doc)

**PRD Specifies:** No explicit collapsibility requirement.

**Phase 5 Coverage:** ✅ EXPLICITLY REQUIRED
- Task 2: "Subcategory collapsibility: Subcategories are collapsible with a click. Default state: expanded."

**Gap:** This is a **new requirement** in Phase 5 not mentioned in the PRD. The current codebase has **NO collapsible UI** in either sidebar.

**Risk:** This is new feature work not anticipated in the PRD's scope statement ("No functional changes to any graphics — this is purely a UI/organization change").

---

### 7. Web Graphics Panel Mirroring (PRD lines 1017-1026)

**PRD Specifies:**
- "Sidebar populated from the same auto-generated registry categories (matches URL Generator automatically)"
- "Same renderer badge (`[stage]` / `[overlay]` / `[output]`) next to each graphic name"

**Phase 5 Coverage:** ✅ COVERED
- Task 3: "The Web Graphics Panel sidebar should mirror the URL Generator's new structure. Same categories, same subcategories, same gender filtering."

**Gap:** None.

---

### 8. Skeletons & Blocks Preview Section (PRD lines 899-908, 992-993)

**PRD Specifies:**
- "New 'Skeletons & Blocks' section in the sidebar lists all registered skeletons and blocks with expandable preview links."
- "New 'Skeletons & Blocks' section for preview mode"

**Phase 5 Coverage:** ⚠️ REFERENCED BUT NOT DETAILED
- Task 2 sidebar structure includes: "Skeletons & Blocks (from Phase 4)"

**Gap:** The Phase 5 doc acknowledges the section but doesn't specify:
1. Where it appears in the sidebar order
2. Whether it's a new category or a special section
3. How it interacts with the new category structure

**Recommendation:** Add clarification that Skeletons & Blocks remains as implemented in Phase 4, appearing after all graphic categories.

---

## Contradictions

### Contradiction 1: Subcategory Names

| Phase 5 Doc | categories.json | Resolution |
|-------------|-----------------|------------|
| `coaches` (under lower-thirds) | NOT present | Add to categories.json |
| `aa-leaders` (under full-screen-cards) | NOT present | Add to categories.json |
| `rosters` (under full-screen-cards) | Uses `team-info` | Map rosters to team-info OR add rosters |
| `spotlight` (under full-bleed) | NOT present | Add to categories.json |

**Current categories.json subcategories:**
- full-screen-cards: leaderboards, team-info, sponsors
- lower-thirds: event-info, team-stats, spotlight
- full-bleed: slates, stream, sponsors

**Phase 5 doc requires:**
- full-screen-cards: leaderboards, aa-leaders, rosters, sponsors (4 subcategories)
- lower-thirds: event-info, team-stats, coaches, spotlight (4 subcategories)
- full-bleed: slates, stream, spotlight, sponsors (4 subcategories)

**Resolution needed:** Either update `categories.json` to add the missing subcategories, or update Phase 5 doc to use existing subcategory names.

---

### Contradiction 2: Event Summary Placement

**PRD (line 954):** Event Summary is listed under "Standalone (no skeleton)" with note "unique structure — excluded from skeleton system"

**Phase 5 Doc (line 88-89):** Event Summary is listed under "Standalone" category

**Current categories.json:** Event Summary is its own top-level category (`event-summary` with order: 6)

**Phase 5 Doc Sidebar Structure:** Event Summary is NOT shown in the sidebar tree structure (missing from both Task 1 and Task 2)

**Resolution needed:** Clarify whether Event Summary should:
1. Stay as its own top-level category (current state)
2. Move under Standalone
3. Something else

---

## Constraints from Later Phases

### Phase 6: Verification & Cutover

Phase 6 depends on Phase 5's reorganization being complete. Per `Phase-6-Verification-Cutover.md` (not yet created but referenced in PRD line 1293):

1. **Side-by-side comparisons** assume the new category structure is in place
2. **Production test** requires all graphics accessible via new sidebar
3. **Old code removal** depends on new structure being verified

**Constraint:** Phase 5 must ensure 100% of graphics appear in the new sidebar structure. The backwards compatibility check (Task 4) explicitly addresses this.

---

## Summary of Gaps

| Gap | Severity | Action Required |
|-----|----------|-----------------|
| Missing subcategories in categories.json | HIGH | Update categories.json to add: `aa-leaders`, `rosters`, `coaches` (lower-thirds), `spotlight` (full-bleed) |
| Event Summary category placement unclear | MEDIUM | Clarify in Phase 5 doc — keep as separate category or move to standalone |
| Collapsible subcategories is new feature | MEDIUM | Acknowledge this adds UI work beyond "purely organization change" |
| Skeletons & Blocks section ordering | LOW | Clarify it appears last, after all graphic categories |

---

## Recommendations

1. **Update categories.json** before starting Phase 5 implementation to include all subcategories from the Phase 5 doc
2. **Keep Event Summary** as its own top-level category (order: 6) for backwards compatibility — it has unique rendering and 14+ variants
3. **Scope the collapsible UI work** explicitly — this is new feature development, not just reorganization
4. **Add explicit note** in Phase 5 doc: "skeleton and blocks fields already present from Phase 2/4, no changes needed"
