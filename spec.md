# Reliable Home Appliance Repair Service Desk

## Current State
- Mobile-first service desk app with Motoko backend and React frontend
- Nav tabs: Dashboard, Clients, Jobs, Inventory, Settings
- Labor rates currently embedded in Settings page (owner-only)
- Settings page shows truncated principal ID with "Ryan" references
- Actor initialization causes "actor not available" errors when saving too quickly
- Delete functions exist in backend but frontend may be missing some UI hooks
- No analytics section
- No Google Maps routing view

## Requested Changes (Diff)

### Add
- Labor Rates as a dedicated nav tab (5th item, Settings moves to last)
- LaborRatesPage: full CRUD, custom rates, rate calculator for estimates
- Analytics card in Settings: income collected per technician (computed from jobs/labor data)
- Google Maps iframe embed in Calendar/Scheduling page for routing
- Settings: login/logout portal section at top
- Settings: display full principal ID in a copyable text field
- Settings: descriptive instructions for granting authorized user access (no names)

### Modify
- Settings page: remove all "Ryan" references, replace with generic "technician" instructions
- Settings page: show FULL principal ID (not truncated), with copy-to-clipboard button
- Settings page: add login/logout section at top
- Settings page: add analytics — income by technician (JB & RH labels allowed as initials only in display)
- Layout nav bar: add Labor Rates tab, reorder tabs
- Actor hook: improve initialization — disable save button with clear message, auto-retry, do not block indefinitely
- All CRUD pages: confirm delete buttons work for clients, jobs, inventory, labor rates

### Remove
- Labor rates section from Settings page
- "For Ryan" amber callout box from Settings
- Truncated principal ID display

## Implementation Plan
1. Create `LaborRatesPage.tsx` with full CRUD and rate calculator
2. Add `/labor-rates` route in `App.tsx`
3. Update `Layout.tsx` nav to include Labor Rates tab
4. Update `SettingsPage.tsx`: remove labor rates, remove Ryan refs, full principal ID with copy button, login/logout section, analytics section (income by tech)
5. Add Google Maps iframe to CalendarPage for routing visualization
6. Improve actor error handling across all pages — show "Connecting..." state, retry button, never silently fail
7. Verify delete buttons are present and working on Clients, Jobs, Inventory pages
