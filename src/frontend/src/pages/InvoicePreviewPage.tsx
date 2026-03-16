import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useNavigate, useParams } from "@tanstack/react-router";
import {
  ArrowLeft,
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
import { useGetJob } from "../hooks/useQueries";
import { useGetClient } from "../hooks/useQueries";
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

  const { data: job, isLoading: jobLoading } = useGetJob(jobId);
  const { data: client, isLoading: clientLoading } = useGetClient(
    job ? job.clientId : null,
  );
  const { data: existingSig, isLoading: sigLoading } = useGetUserSignature();
  const storeSignature = useStoreUserSignature();

  const [sigImageUrl, setSigImageUrl] = useState<string | null>(null);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [taxRateStr, setTaxRateStr] = useState("8.875");

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

  // biome-ignore lint/suspicious/noExplicitAny: new backend field
  const partLineItems: JobPartLineItem[] = (job as any)?.partLineItems ?? [];

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

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Invoice / Estimate — Job #${job.id}</title>
  <style>
    body{font-family:system-ui,sans-serif;max-width:680px;margin:40px auto;padding:0 20px;color:#111}
    h1{font-size:1.4rem;margin:0;color:#15803d}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px}
    .company{font-size:.85rem;color:#555;line-height:1.6}
    .client-block{margin-bottom:24px}
    table{width:100%;border-collapse:collapse}
    th{text-align:left;padding:6px 0;border-bottom:2px solid #111;font-size:.8rem;text-transform:uppercase;letter-spacing:.05em}
    .section-label{font-size:.75rem;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#888;padding:8px 0 4px}
    .total-row td{padding:4px 0;font-size:.95rem}
    .grand-total td{font-weight:700;font-size:1.1rem;border-top:2px solid #111;padding-top:8px}
    .sig-section{margin-top:40px;border-top:1px solid #ddd;padding-top:20px}
    @media print{body{margin:20px}}
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${COMPANY_NAME}</h1>
      <div class="company">
        ${COMPANY_PHONE1} &nbsp;|&nbsp; ${COMPANY_PHONE2}<br/>
        ${COMPANY_EMAIL}
      </div>
    </div>
    <div style="text-align:right;font-size:.85rem;color:#555">
      <strong>Job #${job.id}</strong><br/>
      ${formatDate(job.date)}<br/>
      Status: ${job.status}
    </div>
  </div>

  <div class="client-block">
    <strong>Bill To:</strong><br/>
    ${clientName}<br/>
    ${clientPhone ? `${clientPhone}<br/>` : ""}
    ${clientEmail ? `${clientEmail}<br/>` : ""}
  </div>

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
      <tr class="total-row">
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
          <p style="font-size:.85rem;color:#555;margin-bottom:8px">Customer Signature</p>
          <img src="${sigImageUrl}" style="max-height:80px;border-bottom:1px solid #999"/>
        </div>`
      : ""
  }

  <p style="margin-top:40px;font-size:.75rem;color:#999;text-align:center">
    Thank you for choosing ${COMPANY_NAME}!
  </p>
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
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc) {
      toast.error("Could not generate PDF");
      document.body.removeChild(iframe);
      return;
    }
    doc.open();
    doc.write(html);
    doc.close();
    iframe.contentWindow?.focus();
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 2000);
    }, 500);
    toast.info('Use "Save as PDF" in the print dialog to download.');
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
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24 space-y-6">
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
          data-ocid="invoice.pdf.button"
        >
          <Download className="h-4 w-4" />
          Download PDF
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
        <div className="text-center text-xs text-muted-foreground pt-2">
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
