# Admin UX Roadmap

This file tracks concrete admin UX refinements that are intentionally deferred
after Phases 4.1 through 4.4.2. The goal is to keep the current implementation
reviewable while still preserving the next product decisions we already know we
will want to revisit.

Use this file for product-facing polish items, layout decisions, and navigation
shape questions. Keep workflow tooling, screenshot capture, and PR process
changes in `docs/dev-workflow-improvements.md` instead.

## Candidate Refinements

### Improve the mobile question editor layout

Status: open

Value:

- makes the question editor easier to use on the phone-sized viewport that most
  reviewers will reach first
- reduces clipped option labels and the feeling that the editor is fighting the
  screen instead of fitting it
- gives the admin workspace a clearer polish signal before preview and publish
  phases land

Work required:

- rework the question editor’s mobile stacking so the question list, focused
  editor, and option controls do not crowd each other
- tighten the spacing and width constraints around option labels and per-option
  actions
- verify the editor still keeps its explicit save and validation states visible
  after the layout change

Open questions:

- should the mobile view keep the question list and editor in one column, or
  collapse the list into a separate disclosure once a question is selected?
- should option actions stay inline, or move into a lighter-weight row to reduce
  vertical height?
- is there a minimum viewport width where the current two-panel shape should
  switch into a more compact single-panel editor?

Steps to complete:

1. Define the expected mobile hierarchy for the question list and focused
   editor.
2. Adjust the responsive SCSS so the chosen hierarchy reads clearly on a
   narrow viewport.
3. Capture before/after screenshots for the admin PR review path.
4. Validate that save, validation, and selection states still work on mobile.

Minimum validation:

- `npm run ui:review:capture -- --mode admin`
- browser check of the selected-workspace and question-editor mobile states

### Clarify the desktop admin workspace hierarchy

Status: open

Value:

- makes the selected event workspace easier to scan on wide screens
- reduces the sense that the question list and editor are stacked as two equal
  panels when they actually have different jobs
- helps future preview or publish controls fit into the page without crowding
  the editor

Work required:

- reconsider the balance between the selected-event summary, the event-details
  form, and the question editor on desktop widths
- decide whether the question list should read as navigation, as a sidebar, or
  as part of the editor body
- make the action hierarchy clearer so primary save actions remain obvious

Open questions:

- should the selected workspace become a true two-column layout on desktop, or
  should the current stacked flow remain the default for consistency with
  mobile?
- does the question list need a separate heading or visual treatment to read as
  selection state rather than content?
- should the future preview and publish phases reserve a fixed space in the
  desktop layout now, or be added only when they land?

Steps to complete:

1. Review the current desktop screenshots and identify the specific hierarchy
   problems.
2. Propose one desktop layout direction and validate it in the browser.
3. Keep the explicit-save model and selected-question focus behavior intact.
4. Re-run the admin screenshot capture flow after the change.

Minimum validation:

- `npm run ui:review:capture -- --mode admin`
- browser check of the selected-workspace desktop state

### Decide whether event details should stay inline

Status: open

Value:

- clarifies whether quick edits belong in the selected workspace or on a more
  explicit detail route
- reduces future duplication if the workspace grows beyond the current
  event-level editor
- helps the roadmap stay clear before preview and publish add more controls to
  the same page

Work required:

- compare the current inline editor against a dedicated event-details route or
  event-card editing affordance
- evaluate how much navigation cost is acceptable for the most common admin
  edits
- decide whether deep linking or quick scanning should be the primary goal of
  the event-details experience

Open questions:

- should event details remain in the selected workspace because it keeps the
  editing flow together, or should they eventually move to a dedicated route
  once the page gets denser?
- would inline event-card editing reduce clicks enough to justify the added
  complexity?
- do we want one route per event for both summary and detail editing, or a
  summary route plus a separate detail route?

Steps to complete:

1. Review the current admin navigation and the amount of scrolling required for
   common event-detail edits.
2. Decide whether the current route shape is still the right default.
3. If a route change is chosen later, define it before adding more editor
   phases.

Minimum validation:

- browser check of the selected-workspace saved and failed-save states
- updated admin screenshot capture if the route or layout changes

