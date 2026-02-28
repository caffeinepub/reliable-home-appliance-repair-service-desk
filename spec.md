# Specification

## Summary
**Goal:** Fix the owner principal in the backend stable variable so that the correct Internet Identity principal has full owner access.

**Planned changes:**
- In `backend/main.mo`, set the stable owner principal variable to `q5rzs-s67ph-qtb5w-e66j5-2iqax-vlwa5-5pqxy-yosti-xhcis-ocfw6-yqe` using `Principal.fromText(...)`.
- Update `hasPermission(caller, #owner)` to perform a direct equality comparison against this stable var, not via the roles TrieMap.
- Remove any previously hardcoded owner principal value.
- Ensure all inventory endpoints (`createPart`, `getPart`, `listParts`, `updatePart`, `deletePart`, `usePartOnJob`) use the updated owner principal check so the owner can perform all inventory CRUD operations without access-denied errors.

**User-visible outcome:** Logging in with the correct Internet Identity principal grants full owner access, including Settings, labor rate management, owner-only metrics, and all inventory operations.
