# Specification

## Summary
**Goal:** Fix the owner principal to the correct value, restrict labor rate mutations and Dashboard metrics to the owner role only, and surface Labor Rates and Inventory summary cards on the Dashboard.

**Planned changes:**
- Update the stable owner principal in `backend/main.mo` to `w3w26-hrxnk-kfpaw-7trqf-ngcqt-xm3i3-qebzp-vtech-eqcjs-nahkw-fae` so all `#owner` permission checks use the correct identity
- Block `#authorized` (non-owner) callers from calling `createLaborRate`, `updateLaborRate`, `deleteLaborRate`, and `setStripeKey`
- Add a **Labor Rates** summary card on the Dashboard, visible only to `#owner`, listing current rates (name, type, amount) with a "Manage Labor Rates" button linking to Settings → Labor Rates
- Add an **Inventory** summary card on the Dashboard, visible to both `#owner` and `#authorized`, showing total part count and low-stock count (parts where quantity ≤ lowStockThreshold) with a "View Inventory" button
- Hide the existing Dashboard metrics cards (open jobs, in-progress, complete, total clients, revenue) from `#authorized` users; only `#owner` sees them
- `#authorized` users on the Dashboard continue to see the recent jobs list and the Inventory card

**User-visible outcome:** The correct owner (Ryan's principal) has exclusive access to labor rate management and Dashboard metrics, while the authorized user retains standard CRUD access. Both roles see an Inventory summary on the Dashboard, and only the owner sees Labor Rates and metrics cards.
