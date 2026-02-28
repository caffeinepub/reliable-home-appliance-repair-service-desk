# Specification

## Summary
**Goal:** Fix owner privilege loss by hardening the stable owner principal and role checks in the backend and frontend so the owner never loses access after canister upgrades.

**Planned changes:**
- Declare the owner principal (`q5rzs-s67ph-qtb5w-e66j5-2iqax-vlwa5-5pqxy-yosti-xhcis-ocfw6-yqe`) as a stable immutable constant in `backend/main.mo` that cannot be overwritten by upgrades, migrations, or role-management calls
- Rewrite the `hasPermission` helper so `#owner` checks use direct equality against the stable owner constant and never consult the roles TrieMap
- Audit and fix all owner-guarded endpoints (`setStripeKey`, `getStripeKey`, `addAuthorizedPrincipal`, `removeAuthorizedPrincipal`, `listAuthorizedPrincipals`, labor rate and package CRUD, etc.) to use the hardened permission check
- Ensure all standard CRUD endpoints accept any principal passing `hasPermission(caller, #authorized)`, supporting multiple technician/admin users
- Update the frontend Settings page (`SettingsPage.tsx`) to compare the authenticated principal against the hardcoded owner principal string locally, not relying solely on a backend role query
- Add a migration guard to preserve the stable owner principal across all future canister upgrades, with a comment documenting the owner principal in source

**User-visible outcome:** The owner principal always retains full access to the Settings screen, owner-only metrics, labor rates, and all admin functions after any canister upgrade, and the "Metrics restricted" banner no longer appears when the owner is logged in.
