# Worktrail v0.2.2 Pattern Notes

## Purpose

These notes capture reusable product and architecture signals from the v0.2.2 Saved Views Ergonomics release. They are destination-neutral: the patterns may inform future application infrastructure, project conventions, documentation templates, or no extraction at all.

The bar for extraction remains evidence. A pattern should be generalized only after it appears in multiple concrete workflows and the abstraction would make those workflows simpler to build, test, or operate.

## Common Action Before Object Management

Saved views exposed a product hierarchy problem: opening a saved view is common, while renaming, updating, pinning, and deleting are occasional management tasks.

Useful product rules:

- keep the frequent action visible without requiring a large management surface;
- make the lower-frequency management path explicit but secondary;
- show one selected object for mutation instead of repeating controls for every object;
- preserve shortcuts for the most important objects;
- provide confirmation when the primary action updates content outside the immediate control area.

This pattern applies whenever a reusable object has both frequent execution and occasional administration.

## Selected-Object Management Panels

The saved-view manager moved from row-level mutation controls to a selected-object panel.

Useful implementation rules:

- keep selection state local to the component when it does not need to survive navigation;
- derive selected object details from the canonical input lists instead of duplicating object state;
- keep mutation outputs identical when refactoring presentation;
- distinguish read-only and mutable selected objects before rendering controls;
- hide unavailable controls when permissions make them irrelevant instead of rendering a disabled wall of actions.

This pattern is useful for compact management surfaces where the object count can grow but only one object is usually being edited.

## Confirmation For Off-Screen Effects

Opening a saved view updates the filtered result list below the toolbar. Without feedback, a user can miss that anything happened if the list is below the fold.

Useful product rules:

- confirm the command near the control that triggered it;
- keep the message short and specific;
- use polite live regions for status text;
- avoid forced scrolling unless the user task clearly benefits from it;
- do not create durable state for transient acknowledgement.

This pattern is useful for controls that update nearby-but-not-always-visible content.

## Native Controls As Low-Risk Ergonomics

The compact saved-view opener uses native grouped selects instead of a custom combobox.

Useful implementation rules:

- prefer native controls when the option set is small and behavior is conventional;
- group options by meaningful product category;
- keep labels concrete so tests and assistive technology can find the control;
- use browser keyboard behavior before introducing custom primitives;
- defer richer controls until the product need is proven.

This keeps accessibility, testing, and maintenance cost low while still improving the workflow.

## Refactor Without Contract Movement

v0.2.2 intentionally changed the frontend interaction model without changing saved-view APIs or persistence.

Useful implementation rules:

- preserve parent output events while replacing component internals;
- keep query semantics and URL serialization untouched;
- update component tests before broad smoke tests;
- use browser smoke to cover the workflow change from the user's perspective;
- avoid backend churn when the observed problem is presentation and task hierarchy.

This pattern is useful when a feature works correctly but its ergonomics are out of proportion to the task.
