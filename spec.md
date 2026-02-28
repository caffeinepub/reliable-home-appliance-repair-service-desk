# Specification

## Summary
**Goal:** Add labor line items and parts tracking to job detail, signature capture on login/profile setup with blob storage, and photo capture/upload on jobs.

**Planned changes:**
- Extend the backend Job record with a `laborLineItems` field; add `addLaborLineItem` and `removeLaborLineItem` endpoints (restricted to #authorized)
- Add a Labor section on the Job Detail page showing line items (rate name, type, hours, amount) with an inline Add Labor form and running labor subtotal
- Add a Parts Used section on the Job Detail page showing parts (name, SKU, quantity, unit cost) with an inline Add Part form using the existing `usePartOnJob` endpoint and a running parts subtotal
- Add a `storeUserSignature(sig: Blob)` endpoint and `getUserSignature()` query on the backend, storing blobs in a stable TrieMap keyed by caller principal
- Add an optional signature capture canvas (mouse/touch) on the Login or Profile Setup page with Clear and Save buttons; Save converts canvas to Blob and calls `storeUserSignature`; user can skip
- Extend the backend Job record with a `photos` field; add `addJobPhoto` and `removeJobPhoto` endpoints (restricted to #authorized), persisted in stable storage
- Add a Photos section on the Job Detail page with thumbnail previews, a Take Photo / Upload button (using `<input accept="image/*" capture="environment">`), and per-thumbnail delete icons calling `removeJobPhoto`

**User-visible outcome:** Technicians can log labor rates and parts against a job with running subtotals, capture and store their signature during login/profile setup, and take or upload photos directly on a job record.
