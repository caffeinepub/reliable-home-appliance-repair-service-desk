# Specification

## Summary
**Goal:** Fix all broken create/save flows for clients and inventory parts, and repair blob storage endpoints so that data is correctly persisted.

**Planned changes:**
- Audit and fix `ClientDetailPage.tsx` create mode: ensure the Save/Create button calls `createClient` on the backend actor with correct arguments, handles `event.preventDefault()`, and navigates to `/clients` on success.
- Audit and fix `InventoryPage.tsx` Add Part flow: ensure the submit button calls `createPart` with all entered fields (name, SKU, quantity, lowStockThreshold, unitCost) and refreshes the parts list on success.
- Audit and fix `InventoryPage.tsx` edit-part flow: ensure saving calls `updatePart` with correct ID and fields, and deleting calls `deletePart` with the correct ID.
- Audit and fix `useQueries.ts` mutation hooks for `createClient`, `createPart`, `updatePart`, `deletePart`, `addJobPhoto`, `removeJobPhoto`, and `storeUserSignature` to ensure each calls the correct actor method with the correct argument shape and a resolved actor reference.
- Audit and fix the backend Motoko actor (`backend/main.mo`) to verify `addJobPhoto`, `removeJobPhoto`, `storeUserSignature`, and `getUserSignature` use stable storage and are accessible to authorized callers.

**User-visible outcome:** Users can create new clients, add new inventory parts, edit and delete existing parts, and have all photo/signature blobs correctly saved and persisted across canister upgrades.
