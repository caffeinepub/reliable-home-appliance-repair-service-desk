# Specification

## Summary
**Goal:** Fix the "Actor not available" error that appears on the New Client page when an authenticated user attempts to create a client.

**Planned changes:**
- Fix `useActor.ts` to initialize the actor as soon as an authenticated identity is available, returning a loading state instead of an error while initialization is in progress, and caching the actor instance via React Query so it remains stable across renders
- Fix `useQueries.ts` so the `useCreateClient` mutation correctly receives and uses the actor reference, with no fallback to a no-op when the actor is undefined
- Update `ClientDetailPage.tsx` to guard the `createClient` mutation call so it only fires when the actor is confirmed non-null; show a loading spinner or "Please wait, connecting…" message on the Create button while the actor is initializing instead of displaying an error banner
- Replace the raw "Actor not available" error banner with a user-friendly message if the actor genuinely fails to initialize

**User-visible outcome:** An authenticated user can navigate to the New Client page without seeing an "Actor not available" error. The page shows a loading indicator while the actor initializes, and pressing Create with valid fields successfully creates the client and navigates back to the Clients list.
