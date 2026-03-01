# Specification

## Summary
**Goal:** Restore fully functional form submission for creating new clients and new jobs in the frontend.

**Planned changes:**
- Fix the Create/Save button in `ClientDetailPage.tsx` so that submitting the new-client form calls `createClient` with the entered field values and navigates to `/clients` on success.
- Fix the Create/Save button in `JobDetailPage.tsx` so that submitting the new-job form calls `createJob` with the entered field values and navigates away on success.
- Ensure `event.preventDefault()` is called where needed to prevent page reloads.
- Ensure mutation functions are invoked with the correct argument shapes matching backend signatures.
- Ensure async mutations are properly awaited or use `onSuccess`/`onError` callbacks for reliable navigation and error handling.
- Display error messages to the user when a mutation fails, keeping them on the form.
- Ensure the Create/Save button is never permanently disabled when the form has valid input.

**User-visible outcome:** Users can fill out the new client or new job form, click Create/Save, and have the record successfully created with navigation to the appropriate list or detail page. Errors are surfaced clearly if submission fails.
