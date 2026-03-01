# Specification

## Summary
**Goal:** Clean up the Job Detail page's Stripe UI, move the damage waiver to be a job-only option that flows into the invoice preview, and enable signed estimates to be shared via PDF, HTML, email, and SMS.

**Planned changes:**
- Remove all explanatory/instructional text from the Stripe payment section on the Job Detail page, keeping only the "Charge via Stripe" button and the Paid/Unpaid badge.
- Add a Damage Waiver toggle/checkbox to the Job Detail page (off by default); when enabled, reveal an editable text field pre-populated with the default waiver text and persist both the enabled state and text on the job record.
- Remove the damage waiver from any location other than the Job Detail page (as a job option) and the Invoice/Estimate preview page (when enabled for that job).
- On the Invoice/Estimate preview page, when the job has the waiver enabled, display the waiver text prominently before the signature section.
- After a customer saves their signature on the Invoice/Estimate preview page, render the signature image inline in the "Customer Signature" area.
- Add a "Download PDF" button that exports the full invoice including the inline signature via html2canvas + jsPDF.
- Add a "Download HTML" button that generates and downloads a self-contained .html file of the invoice with the signature embedded as a base64 data URL.
- Add a "Share via Email" button that opens a mailto: link with subject "Your Estimate from Reliable Home Appliance Repair LLC" and a pre-filled plain-text body containing client name, job date, post-tax total, and a note about the signed estimate.
- Add a "Share via SMS" button that opens an sms: link with the message "Your estimate from Reliable Home Appliance Repair LLC is ready. Total: $[amount]. Please reply to confirm."

**User-visible outcome:** Technicians can optionally attach an editable damage waiver to a job, which appears on the estimate before the customer signs. Once signed, the invoice can be shared with the customer as a PDF, HTML file, email, or SMS — all including the captured signature. The Job Detail page's Stripe section is also decluttered to show only the essential button and status badge.
