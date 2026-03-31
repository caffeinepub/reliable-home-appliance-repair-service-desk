import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useNavigate, useParams } from "@tanstack/react-router";
import {
  ArrowLeft,
  CreditCard,
  Download,
  FileCode,
  Loader2,
  Mail,
  MessageSquare,
  Printer,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import SignatureCapture from "../components/SignatureCapture";
import type { JobPartLineItem } from "../hooks/useQueries";
import { useGetJob, useGetJobPartLineItems } from "../hooks/useQueries";
import { useGetClient } from "../hooks/useQueries";
import {
  useCreateCheckoutSession,
  useIsStripeConfigured,
} from "../hooks/useQueries";
import {
  useGetUserSignature,
  useStoreUserSignature,
} from "../hooks/useQueries";

const COMPANY_NAME = "Reliable Home Appliance Repair LLC";
const COMPANY_PHONE1 = "(845) 636-3574";
const COMPANY_PHONE2 = "(845) 544-3077";
const COMPANY_EMAIL = "rhappliance1@gmail.com";

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(nanos: bigint): string {
  return new Date(Number(nanos) / 1_000_000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function InvoicePreviewPage() {
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { jobId?: string };
  const jobId = params.jobId ? BigInt(params.jobId) : null;

  const { data: stripeConfigured } = useIsStripeConfigured();
  const createCheckoutSession = useCreateCheckoutSession();
  const { data: job, isLoading: jobLoading } = useGetJob(jobId);
  const { data: fetchedPartLineItems } = useGetJobPartLineItems(jobId);
  const { data: client, isLoading: clientLoading } = useGetClient(
    job ? job.clientId : null,
  );
  const { data: existingSig, isLoading: sigLoading } = useGetUserSignature();
  const storeSignature = useStoreUserSignature();

  const [sigImageUrl, setSigImageUrl] = useState<string | null>(null);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [taxRateStr, setTaxRateStr] = useState("8.125");

  useEffect(() => {
    if (existingSig && existingSig.length > 0) {
      const plain = new ArrayBuffer(existingSig.length);
      const view = new Uint8Array(plain);
      for (let i = 0; i < existingSig.length; i++) {
        view[i] = existingSig[i];
      }
      const blob = new Blob([view], { type: "image/png" });
      const url = URL.createObjectURL(blob);
      setSigImageUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setSigImageUrl(null);
  }, [existingSig]);

  const handleSignatureSave = async (bytes: Uint8Array) => {
    try {
      await storeSignature.mutateAsync(bytes);
      toast.success("Signature saved");
      setShowSignaturePad(false);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to save signature";
      toast.error(msg);
    }
  };

  const handleSignatureClear = () => {
    setSigImageUrl(null);
    setShowSignaturePad(true);
  };

  if (jobLoading || clientLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-muted-foreground">Job not found.</p>
        <Button variant="outline" onClick={() => navigate({ to: "/jobs" })}>
          Back to Jobs
        </Button>
      </div>
    );
  }

  const partLineItems: JobPartLineItem[] = fetchedPartLineItems ?? [];

  const partCost = partLineItems.reduce(
    (s, i) => s + Number(i.unitPrice) * Number(i.quantity),
    0,
  );
  const laborCost = job.laborLineItems.reduce(
    (s, i) => s + Number(i.totalAmount),
    0,
  );
  const taxRate =
    Math.max(0, Math.min(100, Number.parseFloat(taxRateStr) || 0)) / 100;
  const subtotal = partCost + laborCost;
  const tax = Math.round(subtotal * taxRate);
  const total = subtotal + tax;

  const clientName = client?.name ?? "Customer";
  const clientEmail = client?.email ?? "";
  const clientPhone = client?.phone ?? "";

  const buildInvoiceHTML = () => {
    const partRows = partLineItems
      .map(
        (item) =>
          `<tr>
            <td style="padding:6px 0;border-bottom:1px solid #eee">
              ${item.name}${item.partNumber ? ` <span style="color:#888;font-size:.8em">#${item.partNumber}</span>` : ""}
              ${item.description ? ` — ${item.description}` : ""}
              <span style="color:#888;font-size:.8em"> (qty ${item.quantity})</span>
            </td>
            <td style="padding:6px 0;border-bottom:1px solid #eee;text-align:right">${formatCents(Number(item.unitPrice) * Number(item.quantity))}</td>
          </tr>`,
      )
      .join("");

    const laborRows = job.laborLineItems
      .map(
        (item) =>
          `<tr>
            <td style="padding:6px 0;border-bottom:1px solid #eee">${item.name}${item.description ? ` — ${item.description}` : ""}</td>
            <td style="padding:6px 0;border-bottom:1px solid #eee;text-align:right">${formatCents(Number(item.totalAmount))}</td>
          </tr>`,
      )
      .join("");

    const photosHTML =
      job.photos && job.photos.length > 0
        ? `<div style="margin-top:32px;border-top:1px solid #eee;padding-top:20px">
          <p style="font-size:.75rem;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#888;margin-bottom:12px">Job Photos</p>
          <div style="display:flex;flex-wrap:wrap;gap:10px">
            ${job.photos.map((p) => `<img src="${p.getDirectURL()}" style="width:180px;height:140px;object-fit:cover;border-radius:6px;border:1px solid #ddd" />`).join("")}
          </div>
        </div>`
        : "";

    const notesHTML = job.notes
      ? `<div style="margin-bottom:24px;padding:14px 16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px">
          <p style="font-size:.75rem;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#888;margin:0 0 6px">Notes</p>
          <p style="font-size:.9rem;color:#374151;line-height:1.6;margin:0">${job.notes}</p>
        </div>`
      : "";

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Estimate / Invoice — Job #${job.id}</title>
  <style>
    *{box-sizing:border-box}
    body{font-family:system-ui,-apple-system,sans-serif;max-width:700px;margin:32px auto;padding:0 24px;color:#111;background:#fff}
    h1{font-size:1.3rem;margin:0;color:#15803d;font-weight:700}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:20px;border-bottom:2px solid #15803d}
    .company-info{font-size:.82rem;color:#555;line-height:1.7;margin-top:4px}
    .job-meta{text-align:right;font-size:.82rem;color:#555;line-height:1.7}
    .job-meta strong{font-size:1rem;color:#111;display:block}
    .client-block{margin-bottom:20px;padding:12px 14px;background:#f0fdf4;border-radius:6px;font-size:.88rem;line-height:1.6}
    .client-block strong{font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#166534;display:block;margin-bottom:4px}
    table{width:100%;border-collapse:collapse;margin-bottom:8px}
    th{text-align:left;padding:7px 0;border-bottom:2px solid #111;font-size:.75rem;text-transform:uppercase;letter-spacing:.06em;color:#555}
    .section-label{font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#888;padding:10px 0 4px}
    .total-row td{padding:5px 0;font-size:.93rem;color:#555}
    .subtotal-divider td{border-top:1px solid #ddd;padding-top:6px}
    .grand-total td{font-weight:700;font-size:1.05rem;border-top:2px solid #111;padding-top:8px;color:#111}
    .sig-section{margin-top:36px;border-top:1px solid #ddd;padding-top:18px}
    .waiver-section{margin-top:20px;padding:12px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;font-size:.8rem;color:#78350f;line-height:1.6}
    .footer-note{margin-top:36px;font-size:.72rem;color:#9ca3af;text-align:center;padding-top:16px;border-top:1px solid #f0f0f0}
    @media print{
      body{margin:16px}
      .no-print{display:none!important}
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${COMPANY_NAME}</h1>
      <div class="company-info">
        ${COMPANY_PHONE1} &nbsp;&bull;&nbsp; ${COMPANY_PHONE2}<br/>
        ${COMPANY_EMAIL}
      </div>
    </div>
    <div class="job-meta">
      <strong>Job #${job.id}</strong>
      ${formatDate(job.date)}<br/>
      <span style="text-transform:capitalize;background:#dcfce7;color:#166534;padding:2px 8px;border-radius:99px;font-size:.75rem;font-weight:600">${job.status}</span>
    </div>
  </div>

  <div class="client-block">
    <strong>Bill To</strong>
    ${clientName}<br/>
    ${clientPhone ? `${clientPhone}<br/>` : ""}
    ${clientEmail ? `${clientEmail}` : ""}
  </div>

  ${notesHTML}

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th style="text-align:right">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${partLineItems.length > 0 ? `<tr><td colspan="2" class="section-label">Parts</td></tr>${partRows}` : ""}
      ${job.laborLineItems.length > 0 ? `<tr><td colspan="2" class="section-label">Labor</td></tr>${laborRows}` : ""}
    </tbody>
    <tfoot>
      <tr class="total-row subtotal-divider">
        <td>Subtotal</td>
        <td style="text-align:right">${formatCents(subtotal)}</td>
      </tr>
      <tr class="total-row">
        <td>Tax (${taxRateStr}%)</td>
        <td style="text-align:right">${formatCents(tax)}</td>
      </tr>
      <tr class="grand-total">
        <td>Total</td>
        <td style="text-align:right">${formatCents(total)}</td>
      </tr>
    </tfoot>
  </table>

  ${
    sigImageUrl
      ? `<div class="sig-section">
          <p style="font-size:.75rem;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#888;margin-bottom:10px">Customer Signature</p>
          <img src="${sigImageUrl}" style="max-height:90px;border-bottom:1px solid #999;display:block"/>
        </div>`
      : ""
  }

  ${job.damageWaiver?.enabled ? `<div class="waiver-section"><strong style="display:block;margin-bottom:4px">Damage Waiver</strong>${job.damageWaiver.waiverText}</div>` : ""}

  ${photosHTML}

  <div class="footer-note">
    Thank you for choosing ${COMPANY_NAME}! &nbsp;&bull;&nbsp; ${COMPANY_PHONE1} &nbsp;&bull;&nbsp; ${COMPANY_EMAIL}
  </div>
</body>
</html>`;
  };

  const handleViewHTML = () => {
    const html = buildInvoiceHTML();
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
    } else {
      toast.error("Pop-up blocked. Please allow pop-ups for this site.");
    }
  };

  const handleDownloadPDF = () => {
    const html = buildInvoiceHTML();
    const win = window.open("", "_blank");
    if (!win) {
      toast.error("Pop-up blocked. Please allow pop-ups for this site.");
      return;
    }
    win.document.write(html);
    win.document.close();
    setTimeout(() => {
      win.focus();
      win.print();
    }, 500);
    toast.info("Use the print dialog to save as PDF");
  };

  const handleSendEmail = () => {
    const subject = encodeURIComponent(`Invoice / Estimate for Job #${job.id}`);
    const partsLines = partLineItems
      .map(
        (i) =>
          `${i.name}${i.partNumber ? ` (#${i.partNumber})` : ""} x${i.quantity}: ${formatCents(Number(i.unitPrice) * Number(i.quantity))}`,
      )
      .join("\n");
    const laborLines = job.laborLineItems
      .map((i) => `${i.name}: ${formatCents(Number(i.totalAmount))}`)
      .join("\n");
    const body = encodeURIComponent(
      `Hi ${clientName},\n\nPlease find your invoice summary below:\n\nJob #${job.id} — ${formatDate(job.date)}\n${
        partsLines ? `Parts:\n${partsLines}\n` : ""
      }${laborLines ? `Labor:\n${laborLines}\n` : ""}\nSubtotal: ${formatCents(subtotal)}\nTax (${taxRateStr}%): ${formatCents(tax)}\nTotal: ${formatCents(total)}\n\nThank you for choosing ${COMPANY_NAME}!\n${COMPANY_PHONE1} | ${COMPANY_EMAIL}`,
    );
    const to = encodeURIComponent(clientEmail);
    window.open(`mailto:${to}?subject=${subject}&body=${body}`, "_self");
  };

  const handleSendText = () => {
    const body = encodeURIComponent(
      `Hi ${clientName}! Your repair estimate from ${COMPANY_NAME}:\nJob #${job.id} — Total: ${formatCents(total)}\nQuestions? Call ${COMPANY_PHONE1}`,
    );
    window.open(`sms:${clientPhone}?body=${body}`, "_self");
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-36 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 no-print">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate({ to: `/jobs/${jobId}` })}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold font-display">Invoice / Estimate</h1>
      </div>

      {/* Share / Export Actions */}
      <div className="grid grid-cols-2 gap-2 no-print sm:grid-cols-4">
        <Button
          variant="outline"
          size="sm"
          onClick={handleViewHTML}
          className="flex items-center gap-1.5"
          data-ocid="invoice.html.button"
        >
          <FileCode className="h-4 w-4" />
          View HTML
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownloadPDF}
          className="flex items-center gap-1.5"
          data-ocid="invoice.save_pdf.button"
        >
          <Download className="h-4 w-4" />
          Save as PDF
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSendEmail}
          className="flex items-center gap-1.5"
          data-ocid="invoice.email.button"
        >
          <Mail className="h-4 w-4" />
          Send Email
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSendText}
          className="flex items-center gap-1.5"
          data-ocid="invoice.text.button"
        >
          <MessageSquare className="h-4 w-4" />
          Send Text
        </Button>
        {stripeConfigured && (
          <Button
            variant="default"
            size="sm"
            disabled={createCheckoutSession.isPending}
            onClick={async () => {
              if (!job) return;
              try {
                const rawResponse = await createCheckoutSession.mutateAsync({
                  items: [
                    {
                      productName: `Service Invoice #${job.id}`,
                      currency: "usd",
                      priceInCents: BigInt(Math.round(total)),
                      quantity: 1n,
                      productDescription: "Appliance repair service",
                    },
                  ],
                  successUrl: window.location.href,
                  cancelUrl: window.location.href,
                });
                // Parse Stripe JSON response — fix: don't use blanket catch that swallows Stripe errors
                let paymentUrl: string;
                let parsedResp: Record<string, unknown> | null = null;
                try {
                  parsedResp = JSON.parse(rawResponse) as Record<
                    string,
                    unknown
                  >;
                } catch {
                  /* not JSON */
                }
                if (parsedResp?.error) {
                  const stripeErr = parsedResp.error as Record<string, unknown>;
                  throw new Error(
                    String(
                      stripeErr.message || stripeErr.code || "Stripe API error",
                    ),
                  );
                }
                if (typeof parsedResp?.url === "string") {
                  paymentUrl = parsedResp.url;
                } else if (rawResponse.startsWith("https://")) {
                  paymentUrl = rawResponse;
                } else {
                  throw new Error(
                    `No payment URL in response. Raw: ${rawResponse.slice(0, 300)}`,
                  );
                }
                window.open(paymentUrl, "_blank");
                try {
                  await navigator.clipboard.writeText(paymentUrl);
                } catch {
                  // clipboard optional
                }
                toast.success("Payment link opened in new tab");
              } catch (err: unknown) {
                // Handle both standard Error instances and ICP agent rejection objects
                const msg =
                  err instanceof Error
                    ? err.message
                    : typeof err === "object" &&
                        err !== null &&
                        "message" in err
                      ? String((err as { message: unknown }).message)
                      : String(err);
                toast.error(msg || "Failed to create payment link");
              }
            }}
            className="flex items-center gap-1.5 bg-green-700 hover:bg-green-800 text-white"
            data-ocid="invoice.pay_now.button"
          >
            {createCheckoutSession.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CreditCard className="h-4 w-4" />
            )}
            Pay Now
          </Button>
        )}
      </div>

      {/* Invoice Document */}
      <div
        id="invoice-document"
        className="bg-card border rounded-xl p-6 space-y-6 shadow-sm print:shadow-none print:border-none"
      >
        {/* Company Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <img
                src="/assets/generated/logo-wrench-gear-house-transparent.dim_200x200.png"
                alt="Reliable Home Appliance Repair LLC"
                className="h-9 w-9 object-contain"
              />
              <h2 className="text-base font-bold font-display leading-tight text-green-700 dark:text-green-400">
                Reliable Home Appliance Repair LLC
              </h2>
            </div>
            <p className="text-sm text-muted-foreground">
              {COMPANY_PHONE1} | {COMPANY_PHONE2}
            </p>
            <p className="text-sm text-muted-foreground">{COMPANY_EMAIL}</p>
          </div>
          <div className="text-sm text-right">
            <p className="font-semibold text-base">Job #{job.id.toString()}</p>
            <p className="text-muted-foreground">{formatDate(job.date)}</p>
            <p className="text-muted-foreground capitalize">{job.status}</p>
          </div>
        </div>

        <Separator />

        {/* Client Info */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            Bill To
          </p>
          <p className="font-medium">{clientName}</p>
          {clientPhone && (
            <p className="text-sm text-muted-foreground">{clientPhone}</p>
          )}
          {clientEmail && (
            <p className="text-sm text-muted-foreground">{clientEmail}</p>
          )}
        </div>

        {/* Notes */}
        {job.notes && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Notes
            </p>
            <p className="text-sm">{job.notes}</p>
          </div>
        )}

        <Separator />

        {/* Parts Line Items */}
        {partLineItems.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Parts
            </p>
            {partLineItems.map((item, idx) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: invoice line items positional
                key={`inv-part-${idx}`}
                className="flex justify-between text-sm py-1"
              >
                <div>
                  <span>{item.name}</span>
                  {item.partNumber && (
                    <span className="text-muted-foreground ml-1 text-xs">
                      #{item.partNumber}
                    </span>
                  )}
                  {item.description && (
                    <span className="text-muted-foreground ml-1">
                      — {item.description}
                    </span>
                  )}
                  <span className="text-muted-foreground ml-1 text-xs">
                    ×{Number(item.quantity)}
                  </span>
                </div>
                <span>
                  {formatCents(Number(item.unitPrice) * Number(item.quantity))}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Labor Line Items */}
        <div className="space-y-2">
          {partLineItems.length > 0 && (
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Labor
            </p>
          )}
          <div className="flex justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground pb-1 border-b">
            <span>Description</span>
            <span>Amount</span>
          </div>

          {job.laborLineItems.length === 0 && partLineItems.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">
              No items added.
            </p>
          )}

          {job.laborLineItems.length === 0 && partLineItems.length > 0 && (
            <p className="text-sm text-muted-foreground py-1">
              No labor items.
            </p>
          )}

          {job.laborLineItems.map((item, idx) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: invoice line items positional
              key={`inv-labor-${idx}`}
              className="flex justify-between text-sm py-1"
            >
              <div>
                <span>{item.name}</span>
                {item.description && (
                  <span className="text-muted-foreground ml-1">
                    — {item.description}
                  </span>
                )}
              </div>
              <span>{formatCents(Number(item.totalAmount))}</span>
            </div>
          ))}
        </div>

        <Separator />

        {/* Tax Rate Input */}
        <div className="flex items-center gap-3 no-print">
          <Label className="text-sm text-muted-foreground whitespace-nowrap">
            Tax Rate (%)
          </Label>
          <Input
            type="number"
            min="0"
            max="100"
            step="0.001"
            value={taxRateStr}
            onChange={(e) => setTaxRateStr(e.target.value)}
            className="w-24 h-7 text-right text-sm"
            data-ocid="invoice.tax_rate_input"
          />
        </div>

        {/* Totals */}
        <div className="space-y-1.5 text-sm">
          {partCost > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Parts</span>
              <span>{formatCents(partCost)}</span>
            </div>
          )}
          {laborCost > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Labor</span>
              <span>{formatCents(laborCost)}</span>
            </div>
          )}
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span>{formatCents(subtotal)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Tax ({taxRateStr}%)</span>
            <span>{formatCents(tax)}</span>
          </div>
          <Separator />
          <div className="flex justify-between font-bold text-base pt-1">
            <span>Total</span>
            <span>{formatCents(total)}</span>
          </div>
        </div>

        <Separator />

        {/* Signature Section */}
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Customer Signature
          </p>

          {sigLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading signature…
            </div>
          ) : sigImageUrl && !showSignaturePad ? (
            <div className="space-y-2">
              <div className="border rounded-lg p-3 bg-muted/20">
                <img
                  src={sigImageUrl}
                  alt="Customer signature"
                  className="max-h-24 object-contain"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSignatureClear}
                className="no-print"
              >
                Re-sign
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <SignatureCapture
                onSave={handleSignatureSave}
                onSkip={() => setShowSignaturePad(false)}
                isSaving={storeSignature.isPending}
              />
            </div>
          )}
        </div>

        {/* Job Photos */}
        {job.photos && job.photos.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Job Photos
              </p>
              <div className="grid grid-cols-2 gap-2">
                {job.photos.map((photo, idx) => (
                  <img
                    // biome-ignore lint/suspicious/noArrayIndexKey: photo order stable
                    key={`preview-photo-${idx}`}
                    src={photo.getDirectURL()}
                    alt={`Site documentation ${idx + 1}`}
                    className="w-full h-36 object-cover rounded-lg border border-border"
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {/* Damage Waiver */}
        {job.damageWaiver?.enabled && (
          <>
            <Separator />
            <div className="text-xs text-muted-foreground leading-relaxed">
              <p className="font-semibold mb-1">Damage Waiver</p>
              <p>{job.damageWaiver.waiverText}</p>
            </div>
          </>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground pt-2 pb-2">
          Thank you for choosing {COMPANY_NAME}!
        </div>
      </div>

      {/* Print button */}
      <div className="no-print">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => window.print()}
        >
          <Printer className="h-4 w-4 mr-2" />
          Print
        </Button>
      </div>
    </div>
  );
}
