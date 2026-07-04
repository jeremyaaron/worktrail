# Worktrail v0.0.1 Jawstack Extraction Notes

## Purpose

Worktrail v0.0.1 is intentionally built as a concrete app first. These notes capture repeated implementation pressure points that may later justify `jawstack` abstractions. They are observations, not extraction commitments.

## Candidate Patterns

### Resource Service Shape

The app repeatedly uses the same backend shape:

- transport-neutral endpoint handler;
- Zod request parsing;
- actor context;
- service method;
- repository calls;
- DTO mapping;
- typed application errors.

This pattern appears across projects, work items, comments, activity, and labels. A future abstraction could standardize handler construction without hiding the use-case service.

### Actor-Scoped Resources

Most reads and writes validate that the resource belongs to the actor workspace. This is a strong candidate for reusable policy helpers because it is easy to forget on new endpoints.

Examples:

- project reads by workspace;
- work item detail by workspace;
- project labels by workspace;
- comments and activity by work item workspace.

### Workflow Transitions

Work item status transitions are clearer as explicit operations than generic updates. The pattern includes:

- declared statuses;
- valid transition function;
- domain-specific conflict errors;
- activity recording after a successful transition.

This may generalize into a small workflow primitive, but only after another app proves the same shape.

### Activity Recording

Activity events are structured product data rather than logs. The current useful parts are:

- event type constants;
- actor id;
- resource ids;
- previous/new values;
- metadata;
- summary text.

The implementation still has app-specific summary strings and event decisions, so extraction should stay close to helper functions rather than a generic audit framework.

### DTO Mapping

The app has repeated object mapping from database rows plus related rows to API DTOs. This could become a resource presenter pattern, especially for nested actor/label/comment/activity data.

### Angular Feature Pattern

Each route-level Angular screen follows a simple pattern:

- route params;
- typed API service call;
- local signals for loading/error/data;
- reactive form where edits are needed;
- shared loading/empty/error components.

This may later become a feature scaffold or route resource helper, but current Angular code is still small enough that extraction would be premature.

## Anti-Patterns To Avoid Extracting

- The local actor selector is development scaffolding, not an auth abstraction.
- The Express adapter is a local adapter, not the intended permanent transport model.
- The board and detail layouts are app UX, not framework material.
- Seed data IDs are test/demo infrastructure, not reusable resource identity behavior.

## Follow-Up Evidence To Collect

- Whether another reference app also needs actor-scoped resources and activity timelines.
- Whether workflows beyond work item status transitions share enough behavior to justify a primitive.
- Whether Angular route-level loading/error/data state repeats enough to warrant a helper.
- Whether endpoint handler setup remains repetitive after a Lambda/API Gateway adapter is added.
