# Reliable Home Appliance Repair Service Desk

## Current State
- Backend has `isCallerAdmin()` that checks hardcoded owner principal first, then AccessControl
- Frontend `useIsOwner` hook uses query key `["isOwner"]` without identity — causes stale caching where anonymous result (false) can persist after login
- No Stripe payment link/button on estimates or invoices
- `createCheckoutSession` exists in backend but no frontend hook or UI

## Requested Changes (Diff)

### Add
- `useCreateCheckoutSession` mutation hook in useQueries.ts
- "Pay Now" Stripe button on InvoicePreviewPage (shown when Stripe is configured)
- "Send Payment Link" on estimate section in JobDetailPage (shown when Stripe is configured)

### Modify
- `useIsOwner` query key to include principal string, ensuring fresh fetch after login/logout
- `useIsOwner` to add `refetchOnMount: 'always'` and remove stale cache
- Settings page: ensure `isOwner` re-evaluates after actor is ready

### Remove
- Nothing

## Implementation Plan
1. Fix `useIsOwner` in useQueries.ts — add principal to query key
2. Add `useCreateCheckoutSession` hook
3. Add `useIsStripeConfigured` check in InvoicePreviewPage and show "Pay Now" button
4. Add payment link generation to JobDetailPage estimate section
