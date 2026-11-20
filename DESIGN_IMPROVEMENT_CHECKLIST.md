# SquadPipe Design System & UX Improvement Checklist

**Category:** Precision Operational SaaS (Linear / Attio / Stripe Dashboard / Shopify Polaris-style Admin + Apple HIG restraint)  
**North Star:** Preserve the existing surface architecture and color identity (`#141615` dark sidebar, `#FAFAFA` app canvas, `#FFFFFF` bordered cards, `#0F5C56` Deep Spruce Pine primary accent) while stripping out visual clutter, inconsistent micro-scales, and "AI-generated template" habits.

---

## Non-Negotiable Guardrails

- **Keep core tokens intact** ([tailwind.config.js](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/tailwind.config.js), [index.css](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/styles/index.css), [index.html](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/index.html)):
  - Canvas: `#FAFAFA` (`bg-[#FAFAFA]`)
  - Surface cards: `#FFFFFF` with crisp hairline borders and subtle `.card-shadow`
  - Dark navigation rail: `#141615` (`sidebar.DEFAULT`), `#1F2422` (`sidebar.active`), `rgba(255, 255, 255, 0.08)` borders
  - Brand primary: `#0F5C56` (`brand-600`, hover `#0B4641`)
  - Typography: `-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', system-ui, ...` with `letter-spacing: -0.01em` and `.font-mono { font-variant-numeric: tabular-nums; }`
- **Do not** rebrand to bright gradients, glassmorphism, neon accents, or bouncy animations (`MotionPrimitives.tsx` `APPLE_EASE` / `DRAWER_SPRING` already fit the system).

---

## Phase 1 — Typography, Border Radius & Shadow Normalization

> Goal: Eliminate fragmented sub-12px font sizes, 6+ competing corner radii, broken Tailwind v4 shadow/blur classes (`shadow-xs`, `shadow-2xs`, `backdrop-blur-xs`), and 12+ mismatched elevation shadows.

- [x] **Collapse sub-12px font sizes to 3 predictable tokens**
  - Audit and replace ad-hoc `text-[9px]`, `text-[9.5px]`, `text-[10px]`, and `text-[10.5px]` occurrences across cards, badges, tables, and form helpers.
  - Standardize on:
    - `text-[11px]` — compact micro-labels, shortcuts, badge counters
    - `text-xs` (`12px`) — form field labels, table headers, secondary metadata, pills
    - `text-sm` (`14px`) / `text-base` (`16px`) — body text, inputs, section titles
- [x] **Replace numbered ALL-CAPS section headers with crisp sentence-case hierarchy**
  - Refactor headings such as `1. FORM IDENTITY & COPY`, `2. CLIENT, RATES & SOW CONTRACT TERMS`, and `3. CUSTOM SCREENING QUESTIONS (2)` ([ApplicationFormBuilderPage.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/features/custom-fields/ApplicationFormBuilderPage.tsx)) to clean sentence-case titles (`text-sm font-semibold text-slate-900`) paired with a subtle muted `text-xs text-slate-500` helper line.
  - Replace all-caps sub-headers like `QUICK ADD COMMON QUESTIONS` and `text-[10px] uppercase font-bold` KPI labels ([BillablePlacementsView.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/features/billable/BillablePlacementsView.tsx)) with quiet sentence-case or muted `text-[11px] font-medium text-slate-500` labels.
- [x] **Enforce a strict 4-tier Border Radius Scale**
  - **Audit baseline (`frontend/src/`):** Eliminated all `26` `rounded-2xl` occurrences (aligned cards, previews, dropzones, error boundary, and [AnimatedModal](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/components/shared/MotionPrimitives.tsx) onto `rounded-xl`; standardized header CTAs & segmented tracks onto `rounded-lg`; inline skill/sidebar chips onto `rounded-md`).
  - **Target scale:**
    - `rounded-xl` (`12px`) — cards, primary panels, AND center modals (`AnimatedModal` + overrides unified on `rounded-xl`).
    - `rounded-lg` (`8px`) — buttons, text inputs, selects, dropdown menu items, segmented control tracks.
    - `rounded-md` (`6px`) — inline tags (`SkillTag`), small KPI icon badges, compact inner toggles (`rounded` retained on form checkboxes).
    - `rounded-full` — circular avatars and semantic dot/status pills (`StatusBadge.tsx`) only.
- [x] **Fix silent no-op Tailwind v4 shadow/blur classes (`shadow-xs`, `shadow-2xs`, `backdrop-blur-xs`)**
  - [package.json](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/package.json) runs **`tailwindcss ^3.4.4`** without custom `boxShadow` extensions in [tailwind.config.js](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/tailwind.config.js). Confirmed in compiled CSS that `.shadow-xs` (`108` uses), `.shadow-2xs` (`51` uses across `44` files), and `.backdrop-blur-xs` (`20+` modal overlays + [MotionPrimitives.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/components/shared/MotionPrimitives.tsx)) **compiled to zero CSS rules**.
  - Replaced all `shadow-xs` / `shadow-2xs` on cards with `.card-shadow` ([index.css](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/styles/index.css)), removed unintended button shadows, upgraded active segmented thumbs to `shadow-sm`, and replaced `backdrop-blur-xs` + `bg-black/50` overrides with unified `bg-slate-900/55 backdrop-blur-[2px]` across `AnimatedModal` / `AnimatedDrawer`.
- [x] **Consolidate 12+ fragmented shadow utilities into a 4-level Elevation Ladder**
  - **Level 0 — Flat (`shadow-none`):** Nested sub-panels, table cells, inputs (`select` focus ring uses `0 0 0 3px rgba(15, 92, 86, 0.14)` in [index.css](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/styles/index.css)). Removed gratuitous `shadow-xs` / `shadow-sm` / `shadow-brand-600/20` ([QuickAddModal.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/components/shared/QuickAddModal.tsx)) from buttons and static pills.
  - **Level 1 — Surface Cards (`.card-shadow` & `.card-hover`):** Standardized static white cards (`PublicRequirementApplyView.tsx`, `CsvImportWorkspace.tsx`, `ResumeImportWorkspace.tsx`, `ApplicationFormPreview.tsx`, `ErrorBoundary.tsx`) onto `.card-shadow`, and interactive/kanban cards ([PipelineView.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/features/pipeline/PipelineView.tsx)) onto `.card-hover` ([index.css](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/styles/index.css)).
  - **Level 2 — Popovers, Dropdowns & Sticky Bars (`.popover-shadow`):** Unified all `shadow-xl` floating dropdowns/popovers onto `.popover-shadow` ([index.css](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/styles/index.css)), keeping `shadow-[inset_0_-1px_0_rgb(226,232,240)]` solely for sticky table headers.
  - **Level 3 — Modals & Drawers (`shadow-2xl`):** Standardized `AnimatedModal` / `AnimatedDrawer` panels and [QuickAddModal.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/components/shared/QuickAddModal.tsx) onto `shadow-2xl`.

---

## Phase 2 — Badge, Pill & KPI Card Cleanup ("Anti-Chip-Soup")

> Goal: Keep status indicators readable at a glance without covering tables, buttons, and cards in competing pastel pills.

- [x] **Enforce strictly 2 badge/tag families across the app**
  - **Semantic state (`StatusBadge.tsx` & `utils/stageStyles.ts`):** Kept `StatusBadge`'s quiet white bordered dot-pill style (`bg-white text-slate-700 border border-slate-200/90`).
  - **Neutral metadata tags (`SkillTag.tsx`):** Simplified `SkillTag` (`px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100/90 text-slate-700`) without outer borders/margins.
- [x] **Remove decorative `"AI"` micro-pills and pastel banner chips**
  - Removed `bg-indigo-50 border-indigo-200/80 text-[9.5px]` `"AI"` micro-badges from [PipelineView.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/features/pipeline/PipelineView.tsx), [ConsultantsView.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/features/consultants/ConsultantsView.tsx), [DashboardView.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/features/dashboard/DashboardView.tsx), and [SlaDrawer.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/components/layout/SlaDrawer.tsx).
  - Replaced pastel pills in [ClientDetailPage.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/features/clients/ClientDetailPage.tsx) (`StatusBadge`) and [ResumeImportWorkspace.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/features/import-data/ResumeImportWorkspace.tsx) (plain muted char counter), and unified count chips in `ConsultantsView.tsx` / `ApplicationFormsSection.tsx` / `CustomFieldsView.tsx` to `tabular-nums text-slate-500`.
- [x] **Normalize KPI icon containers across Dashboard & Billable views**
  - Unified KPI icon containers in [BillablePlacementsView.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/features/billable/BillablePlacementsView.tsx) and [DashboardView.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/features/dashboard/DashboardView.tsx) onto quiet `bg-slate-100 text-slate-600 rounded-md` icon boxes with tabular metrics.

---

## Phase 3 — De-Boxing Creation Pages & Flattening Nested Cards

> Goal: Align full-page workflows (`/requirements/from-email`, `/import-data/*`, `/placements/new`, Form Builder) with the clean bare-canvas architecture of `DashboardView`, `PipelineView`, and `ConsultantsView`.

- [x] **Remove boxed hero header cards from creation & import pages**
  - Replaced boxed white hero header cards and dark/colored icon squares with bare `<PageHeader />` on:
    - [ApplicationFormBuilderPage.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/features/custom-fields/ApplicationFormBuilderPage.tsx) (+ [ApplicationFormsSection.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/features/custom-fields/ApplicationFormsSection.tsx) & [CustomFieldsView.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/features/custom-fields/CustomFieldsView.tsx))
    - [RequirementFromEmailPage.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/features/requirements/RequirementFromEmailPage.tsx)
    - [ResumeImportPage.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/features/import-data/ResumeImportPage.tsx)
    - [CsvImportPage.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/features/import-data/CsvImportPage.tsx)
    - [PlacementCreatePage.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/features/billable/PlacementCreatePage.tsx)
  - Removed duplicate Save/Submit action bars so every creation/builder workflow has a single authoritative Primary CTA.
- [x] **Flatten nested box-in-box cards & tinted callout panels**
  - In [ApplicationFormBuilderPage.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/features/custom-fields/ApplicationFormBuilderPage.tsx), flattened Section 3 (`Custom screening questions`) into hairline-divided rows (`divide-y divide-slate-100`) and converted `Add a new custom question` into a flat bottom section separated by `border-t border-slate-100`.
  - Replaced full-bleed pastel notice boxes (`bg-indigo-50/60`, `bg-emerald-50/70`, `bg-amber-50/50`) in [ResumeImportWorkspace.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/features/import-data/ResumeImportWorkspace.tsx), [CsvImportWorkspace.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/features/import-data/CsvImportWorkspace.tsx), and [RequirementFromEmailPage.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/features/requirements/RequirementFromEmailPage.tsx) with neutral `bg-slate-50 border-slate-200` / left-accent surfaces.

---

## Phase 4 — Shared Primitives, Button Hierarchy & Code Hygiene

> Goal: Stop per-page drift by promoting repeated local UI controls into `frontend/src/components/shared/`.

- [x] **Promote repeated local controls into `frontend/src/components/shared/`**
  - Extracted `SegmentedControl`, `FieldWidthToggle`, and `RequiredToggle` into [SegmentedControl.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/components/shared/SegmentedControl.tsx).
  - Created bare canvas header component [PageHeader.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/components/shared/PageHeader.tsx) alongside [DetailPageShell.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/components/shared/DetailPageShell.tsx).
  - Created shared [FormField.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/components/shared/FormField.tsx) wrapper used in [RequirementFormPage.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/features/requirements/RequirementFormPage.tsx) and [ConsultantCreatePage.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/features/consultants/ConsultantCreatePage.tsx).
- [x] **Enforce a strict 3-tier button hierarchy**
  - Refactored `Match` in [PipelineView.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/features/pipeline/PipelineView.tsx) and `Activate Placement` in [RequirementDetailPage.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/features/requirements/RequirementDetailPage.tsx) onto clean Secondary white bordered buttons, keeping `#0F5C56` Solid Primary as the sole dominant CTA.
- [x] **Split `CsvImportWorkspace.tsx` from `CsvImportPage.tsx`**
  - Extracted [CsvImportWorkspace.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/features/import-data/CsvImportWorkspace.tsx) shared cleanly by [CsvImportPage.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/features/import-data/CsvImportPage.tsx) and [CsvImportModal.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/components/modals/CsvImportModal.tsx) — Vite chunk warning resolved.

---

## Phase 5 — Icon Library Upgrade & FontAwesome Cleanup

> Goal: Replace generic thick-stroke (`2px`) boilerplate and legacy `fa-*` icon mappings with a cohesive, sharp icon grammar.

- [x] **Decide & standardize the icon system across SquadPipe**
  - **Adopted Option A (`@phosphor-icons/react`):** Switched [Sidebar.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/components/layout/Sidebar.tsx), [Topbar.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/components/layout/Topbar.tsx), [CommandPaletteModal.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/components/layout/CommandPaletteModal.tsx), and [AppIcon.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/components/shared/AppIcon.tsx) to crisp Phosphor icons (`weight="duotone"` on active dark Sidebar items & semantic status toasts, `weight="regular"` when inactive), normalized heavy `strokeWidth={2.25-2.5}` Lucide overrides to `1.75`, and removed decorative `Sparkles` badges/imports.
- [x] **Clean up unused FontAwesome dependency & legacy mappings**
  - Uninstalled unused `@fortawesome/fontawesome-free` from [package.json](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/package.json).
  - Refactored [AppIcon.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/components/shared/AppIcon.tsx) to typed semantic `AppIconKey` values (`'success' | 'error' | 'warning' | 'delete' | ...`) and migrated all `125` `fa-solid` calls across `frontend/src/`.

---

## Phase 6 — Power-User UX & Selective Modal-to-Page Routing

> Goal: Make high-frequency recruiter workflows faster via keyboard navigation and remove cramped scrolling modals for complex entities.

- [x] **Add Global Command Palette (`⌘K`) in `Topbar.tsx`**
  - Added search pill (`⌘K`) in [Topbar.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/components/layout/Topbar.tsx) and keyboard-navigable [CommandPaletteModal.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/components/layout/CommandPaletteModal.tsx) for quick record lookup & action jumping.
- [x] **Keyboard ergonomics & unsaved-changes safety on creation pages**
  - Created [useFormShortcuts.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/hooks/useFormShortcuts.tsx) (`⌘S` / `⌘Enter` submit shortcuts, `beforeunload` warning, and `<UnsavedChangesModal />` guard on Back breadcrumb / Cancel buttons) across Form Builder, Email-to-Req, New Placement, Requirement New/Edit, and New Consultant pages. *(Note: Sidebar click interception remains optional if full global router lock is later desired.)*
- [x] **Quiet skeleton loaders for async tables & detail views**
  - Created [PageSkeleton.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/components/shared/PageSkeleton.tsx) replacing spinners on `React.Suspense` fallback and deep-link `isResolvingCurrentDetail` in [App.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/App.tsx).
- [x] **Selective Batch 3 modal-to-page consolidation**
  - **Moved to dedicated pages:** `/requirements/new` & `/requirements/:id/edit` ([RequirementFormPage.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/features/requirements/RequirementFormPage.tsx)), and `/consultants/new` ([ConsultantCreatePage.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/features/consultants/ConsultantCreatePage.tsx)) wired into [appRoutes.ts](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/utils/appRoutes.ts), [RequirementDetailPage.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/features/requirements/RequirementDetailPage.tsx), and [App.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/App.tsx).
  - **Kept as modals/drawers:** Short entity modals (`AddClientModal`, `EditClientModal`, `AddVendorModal`, `EditVendorModal`) and contextual overlays (`AttachBenchDrawer`, `ResumeParserModal`, `CsvImportModal`).

---

## Phase 7 — Detail Pages, Tier 1 De-Boxing & App-Wide Whitespace Pass

> Goal: Break apart 3-in-1 welded Hero+Metadata+Tab monoliths, restore alternating `#FAFAFA` canvas breathing room between headers/cards/tabs, and harmonize spacing across all remaining operational views.

- [x] **De-weld Detail Page headers, metadata grids & underline tabs (`Part A`)**
  - Refactored [DetailPageShell.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/components/shared/DetailPageShell.tsx): removed baked `mb-2` from `DetailBreadcrumb` so `space-y-6` spacing stays uniform, switched `DetailUnderlineTabs` to float cleanly on `#FAFAFA` (`variant="standalone"`) with quiet tabular counts instead of pill bubbles, and added `embedded` mode on `DetailExpandableSkillsBar` to eliminate floating pancake strips above tables.
  - Applied across all 5 detail pages: [RequirementDetailPage.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/features/requirements/RequirementDetailPage.tsx) (also migrated to `DetailBreadcrumb` & `DetailUnderlineTabs`, removed public-link icon box/pill), [PlacementDetailPage.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/features/billable/PlacementDetailPage.tsx), [ConsultantDetailPage.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/features/consultants/ConsultantDetailPage.tsx) (combined Core Skills + Executive Summary + CV download hint into one unified Overview card and moved `Submit to Req` dropdown to `.popover-shadow`), [ClientDetailPage.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/features/clients/ClientDetailPage.tsx), and [VendorDetailPage.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/features/vendors/VendorDetailPage.tsx).
  - Normalized 4-column summary cell spacing to `px-6 py-4 space-y-1.5` with calm sentence-case `text-xs font-medium text-slate-500` labels.
- [x] **De-box Tier 1 operational headers (`TeamPerformanceView`, `UsageView`, `SettingsView`)**
  - Replaced boxed hero cards, pastel/dark icon squares, and fused KPI strips with bare `<PageHeader />` + standalone summary cards + `SegmentedControl` / `StatusBadge` in [TeamPerformanceView.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/features/team-performance/TeamPerformanceView.tsx), [UsageView.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/features/usage/UsageView.tsx), and [SettingsView.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/features/settings/SettingsView.tsx).
- [x] **Tier 2 app-wide whitespace, radius & table breathing room (`Part B`)**
  - Removed restrictive `max-h-[420px]` / `max-h-[440px]` inner table scroll caps on paginated views ([DashboardView.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/features/dashboard/DashboardView.tsx), [ConsultantsView.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/features/consultants/ConsultantsView.tsx), [ClientsView.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/features/clients/ClientsView.tsx), [VendorsView.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/features/vendors/VendorsView.tsx), [BillablePlacementsView.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/features/billable/BillablePlacementsView.tsx), [UserManagementView.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/features/user-management/UserManagementView.tsx), [CustomFieldsView.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/features/custom-fields/CustomFieldsView.tsx)) so paginated rows expand cleanly without double scrollbars.
  - Standardized outer page rhythm to `space-y-6`, aligned `ClientsView`/`VendorsView`/`BillablePlacementsView`/`PipelineView` controls onto `rounded-lg`, switched `UserManagementView` filter onto `<SegmentedControl />`, removed duplicate Work Model / Location sub-boxes in [PublicRequirementApplyView.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/features/public/PublicRequirementApplyView.tsx), updated [ResumeImportWorkspace.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/features/import-data/ResumeImportWorkspace.tsx) queue status pills onto `<StatusBadge />`, and standardized [DateTimePicker.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/components/shared/DateTimePicker.tsx) popover onto `.popover-shadow`.

---

## Phase 8 — Cross-Platform Font Stack & App-Wide Type Scale

> Goal: Serve crisp self-hosted Inter Variable across non-macOS browsers, remove global negative body tracking on small UI copy, and elevate the entire type ladder out of compressed 11–12px defaults.

- [x] **Bundle `@fontsource-variable/inter` & remove global body `-0.01em` tracking**
  - Installed `@fontsource-variable/inter` in [package.json](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/package.json), imported in [main.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/main.tsx), and wired into [tailwind.config.js](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/tailwind.config.js) & [index.css](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/styles/index.css) after SF Pro so macOS stays native while Windows/Linux/Public Apply routes get crisp Inter geometry.
  - Reset global `body` tracking to `0` (`h1, h2` retain `-0.015em`) and bumped `.tiptap-content .tiptap` / `.rich-text-prose` from `12px` (`0.75rem`) to **`14px` (`0.875rem`)** with `1.65` line height.
- [x] **Upgrade app-wide font scale & eliminate fractional arbitrary pixel sizes**
  - Calibrated `theme.extend.fontSize` in [tailwind.config.js](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/tailwind.config.js): `xs` `12px -> 13px` (`0.8125rem / 1.25rem`), `sm` `14px` (`0.875rem / 1.35rem`), `lg` `18px -> 20px` (`1.25rem / 1.75rem`), `xl` `20px -> 22px` (`1.375rem / 1.875rem`).
  - Promoted form helper hints/errors in [FormField.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/components/shared/FormField.tsx) (`12px`), extracted resumes in [ConsultantDetailPage.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/features/consultants/ConsultantDetailPage.tsx) (`text-sm`), pitch draft textarea in [PreparePitchModal.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/components/modals/PreparePitchModal.tsx) (`text-sm`), and replaced fractional `11.5px` / `12.5px` / `13.5px` overrides in [Sidebar.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/components/layout/Sidebar.tsx), [PipelineView.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/features/pipeline/PipelineView.tsx), [ClientDetailPage.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/features/clients/ClientDetailPage.tsx), and [RequirementDetailPage.tsx](file:///Users/nakuldas/Public/projects/saas/monday/squadpipe/frontend/src/features/requirements/RequirementDetailPage.tsx).

---

## Verification Checklist (Apply After Each Phase)

- [x] Run TypeScript check and Vite production build (`cd frontend && ./node_modules/.bin/tsc --noEmit && npm run build`) with `0` errors and zero mixed static/dynamic chunk warnings.
- [ ] Visually inspect affected routes in live app (`:3000`): Dashboard, Pipeline, Requirement Detail, Consultants, Billable Placements, Application Form Builder, Import Resume, Import CSV, Parse from Email, New Placement, New/Edit Requirement, New Consultant.
- [x] Verify badge restraint: confirm every table/card row uses at most `StatusBadge` + flat metadata tags (no pastel `"AI"` micro-chips or stacked bordered pills).
- [x] Verify zero leftover Tailwind v4 no-op classes (`shadow-xs`, `shadow-2xs`, `backdrop-blur-xs`) via grep across `frontend/src/`, and confirm every card/modal/popover matches the 4-level elevation & radius ladder.
- [ ] Verify contrast, keyboard focus rings (`rgba(15, 92, 86, 0.14)` / `#0F5C56`), sticky progress widget spacing (`App.tsx`), and responsive behavior down to tablet/laptop widths (`1280px` & `1440px`).
