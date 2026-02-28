# Specification

## Summary
**Goal:** Fix the invoice title, add fully custom labor line item entry on the job screen, add a per-job tax rate field, remove all Google Review link references, ensure photo blob storage works, and preserve the Stripe payment section.

**Planned changes:**
- Change the primary business name heading on the Invoice/Estimate preview page and PDF export to "Reliable Home Appliance Repair LLC"
- Replace the labor entry form on the Job Detail page with a fully custom/manual labor line item form (free-text name, hourly or flat type, hours field for hourly only, editable rate/amount, optional description, computed amount per line, running labor subtotal, remove button per item)
- Add a tax rate input field (default 8.875%) to the Job Detail page that computes and displays pre-tax subtotal, tax amount (labeled with rate), and post-tax total; include all three values on the Invoice/Estimate preview and PDF export
- Remove all Google Review URL references, buttons, links, and constants from the entire frontend codebase
- Verify and re-implement if needed the job photo blob storage section on the Job Detail page (Take Photo / Upload button, thumbnail previews, delete per photo)
- Ensure the Stripe payment section remains intact and passes the post-tax total to createPaymentIntent

**User-visible outcome:** Users can create jobs with custom labor entries and a configurable tax rate, view correct totals on the job screen and invoice, download a PDF with "Reliable Home Appliance Repair LLC" as the title including tax breakdown, upload and delete job photos, and process Stripe payments — with no Google Review links anywhere in the app.
