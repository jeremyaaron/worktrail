# Worktrail v0.2.8 Pattern Notes

## Purpose

These notes record reusable evidence from Quick Find without assigning it to a framework, package,
cloud provider, or future repository. The evidence comes from one bounded heterogeneous read surface.
It should not yet be treated as a universal search or command architecture.

## Model Heterogeneous Reads With Concrete Groups

A cross-domain read can use one response without erasing the differences between its result types.

Useful rules:

- define one explicit result contract for each supported domain;
- return a stable object of named groups rather than a mixed array with loosely typed payloads;
- include only the identity, destination context, lifecycle state, and match evidence needed to render;
- keep internal rank values and persistence fields out of public DTOs;
- authorize the aggregate request once, then preserve tenant ownership in every group query and join;
- make every group optional in content but required in response shape so clients remain exhaustive.

Concrete groups provide one coherent loading/error boundary while allowing each domain to keep its own
identity, destination, lifecycle, and projection.

## Use Deterministic Rank Tiers Before Relevance Scoring

Simple search often needs predictable ordering more than a sophisticated numeric score.

Useful rules:

- define an ordered vocabulary such as exact identity, identity prefix, exact primary field, primary
  prefix, primary substring, and narrative substring;
- rank only inside a clearly labeled record group unless cross-type relevance has proven product value;
- apply lifecycle preference only after relevance so an exact archived record remains reachable;
- add stable human-readable and identity tie-breakers, then a final unique id;
- return match field and match mode when the client needs to explain or render why a row matched;
- treat caller wildcard characters as literals unless wildcard syntax is an explicit product feature.

Tiered ranking is easier to test and explain than an opaque score. Full-text or semantic ranking should
arrive only when product evidence shows that explicit tiers are insufficient.

## Bound Every Group With Limit Plus One

A compact cross-domain surface needs honest truncation without the cost and coupling of exact totals.

Useful rules:

- choose a small server-owned group limit;
- fetch at most `limit + 1` rows;
- return the first `limit` rows and derive `hasMore` from the extra row;
- never run an exact count merely to decorate a transient search dialog;
- provide an overflow destination only where a canonical, scalable result page already exists;
- keep every SQL branch independently limited even when the aggregate response is bounded overall.

Limit-plus-one communicates that more matches exist without promising exact result counts or requiring
every domain to expose paging.

## Preserve Privacy At The Transport And Logging Boundaries

Search text can contain sensitive project context even when the operation is read-only.

Useful rules:

- carry query text in a validated POST body when URL persistence and shareability are not product
  requirements;
- log the normalized route path rather than the original URL with query parameters;
- do not log request bodies or normalized search text by default;
- parameterize SQL and map persistence failures to a stable public error;
- mark user-specific search responses `private, no-store`;
- keep raw causes available only through a deliberate future observability boundary with redaction.

POST does not make search inherently private. Privacy depends on the complete path through browser
history, proxies, application logging, error mapping, caching, and persistence.

## Load Shell Tools Only When Invoked

A globally reachable tool does not need to increase every route's initial bundle.

Useful rules:

- keep the visible trigger and shortcut listener small;
- dynamically import the launcher and substantial dialog component on first use;
- guard the in-flight import/open operation so repeated input creates one overlay;
- rely on a proven overlay primitive for focus trapping, dismissal, scroll blocking, and restoration;
- close the tool before route or actor context changes;
- inspect both the initial bundle and the lazy feature chunk in production builds.

This pattern keeps global reachability separate from eager loading. It is suitable for substantial
shell utilities, not a reason to fragment trivial controls.

## Reject Stale Responses Explicitly

Debounce and cancellation improve efficiency, but correctness should not depend on cancellation alone.

Useful rules:

- normalize the query before deciding whether a request is valid;
- debounce broad requests and cancel superseded client subscriptions;
- assign each prepared query a generation and accept a response only for the current generation;
- capture actor or workspace identity when the tool opens;
- close and destroy the tool before identity changes;
- reset prior response and error state when a new valid query begins;
- make retry issue a fresh request for the current normalized query.

Generation checks protect against transports or test doubles that complete after cancellation and make
the stale-response rule visible in the feature state model.

## Keep Destination Mapping Pure And Canonical

Search results should open existing product destinations instead of inventing parallel navigation
semantics.

Useful rules:

- map each concrete result type through one exhaustive pure destination function;
- reuse canonical query serializers when handing overflow to an existing result page;
- use URL fragments for durable section targets when route reuse and lazy content can honor them;
- test initial navigation, same-component id changes, and same-URL fragment activation separately;
- close the dialog before navigation so overlay focus restoration cannot fight destination focus;
- do not persist transient query state merely to support routing.

Canonical destinations let search improve access without becoming a second application model.

## Prove Index Eligibility Without Misrepresenting Local Plans

Small deterministic databases often prefer sequential scans even when production-shaped indexes are
correct.

Useful rules:

- capture normal `EXPLAIN ANALYZE` plans without planner manipulation;
- separately disable sequential and plain index scans only for a clearly labeled eligibility proof;
- assert finite limit nodes for every normal group query;
- assert expected trigram indexes only in the separate eligibility plans;
- measure the complete sequential aggregate under representative temporary volume;
- create evidence inside a transaction and roll it back after measurement;
- describe local timings as evidence, not a production SLA.

This distinguishes two questions: whether the local workload is bounded and fast enough, and whether
the schema provides an index path when table size and selectivity justify it.

## Deliberate Non-Abstractions

v0.2.8 does not introduce a provider registry, generic command palette, universal search result,
cross-domain repository framework, relevance-score engine, query analytics pipeline, external search
adapter, or generic fragment-scrolling service.

The current evidence supports focused reusable ideas:

- concrete grouped read contracts;
- deterministic rank tiers;
- limit-plus-one truncation;
- privacy-preserving ephemeral search transport;
- lazy shell-owned tools;
- stale-response generations;
- pure canonical destination mapping;
- separate normal-plan and index-eligibility evidence.

A broader abstraction should wait for another feature with materially similar heterogeneous reads,
ranking, privacy, lifecycle, overflow, and destination requirements. Keeping the current implementation
specific makes future differences visible rather than hiding them behind premature extension points.
