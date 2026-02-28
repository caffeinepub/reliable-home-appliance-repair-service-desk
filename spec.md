# Specification

## Summary
**Goal:** Update the hardcoded owner principal in the Motoko backend to the app-derived Internet Identity principal for the actual owner.

**Planned changes:**
- Update the stable owner principal variable in `backend/main.mo` to `q5rzs-s67ph-qtb5w-e66j5-2iqax-vlwa5-5pqxy-yosti-xhcis-ocfw6-yqe`
- All `hasPermission(caller, #owner)` checks will now resolve to true for this principal

**User-visible outcome:** Logging in with the principal `q5rzs-s67ph-qtb5w-e66j5-2iqax-vlwa5-5pqxy-yosti-xhcis-ocfw6-yqe` grants full owner access, including the Settings screen, labor rates management, and owner-only dashboard metrics. The "Access Restricted" message will no longer appear for this user.
