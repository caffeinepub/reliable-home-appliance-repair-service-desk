import React, { useRef, useState, useEffect } from 'react';
import { useParams, useNavigate, useSearch } from '@tanstack/react-router';
import { ArrowLeft, Download, Printer, PenLine, Loader2, RotateCcw, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGetJob, useGetClient, useListParts, useStoreUserSignature } from '../hooks/useQueries';
import { useSignaturePad } from '../hooks/useSignaturePad';

const BUSINESS_NAME = 'Reliable Home Appliance Repair LLC';
const BUSINESS_PHONE_1 = '(845) 544-3077';
const BUSINESS_PHONE_2 = '(845) 636-3574';
const BUSINESS_EMAIL = 'rhappliance1@gmail.com';

function toSafeUint8Array(input: Uint8Array): Uint8Array<ArrayBuffer> {
  const buf = new ArrayBuffer(input.byteLength);
  new Uint8Array(buf).set(input);
  return new Uint8Array(buf);
}

export default function InvoicePreviewPage() {
  const { jobId } = useParams({ from: '/invoice/$jobId' });
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { taxRate?: string };
  const invoiceRef = useRef<HTMLDivElement>(null);

  const taxRate = parseFloat(search.taxRate || '8.875');

  const jobIdBig = BigInt(jobId);
  const { data: job, isLoading: jobLoading } = useGetJob(jobIdBig);
  const { data: client, isLoading: clientLoading } = useGetClient(job?.clientId ?? null);
  const { data: allParts = [] } = useListParts();
  const storeSignatureMutation = useStoreUserSignature();

  // Signature pad — always called unconditionally at the top level
  const {
    canvasRef: clientCanvasRef,
    clear: clearClientSig,
    getSignatureBytes: getClientSigBytes,
    isEmpty: clientSigIsEmpty,
  } = useSignaturePad();

  const [clientSigSaved, setClientSigSaved] = useState(false);
  const [clientSigDataUrl, setClientSigDataUrl] = useState<string | null>(null);
  const [clientSigError, setClientSigError] = useState('');
  const [isSavingSig, setIsSavingSig] = useState(false);

  const handleSaveClientSignature = async () => {
    setClientSigError('');
    if (clientSigIsEmpty) {
      setClientSigError('Please draw the customer signature before saving.');
      return;
    }
    setIsSavingSig(true);
    try {
      const bytes = await getClientSigBytes();
      if (!bytes) {
        setClientSigError('Failed to capture signature.');
        setIsSavingSig(false);
        return;
      }
      const safe = toSafeUint8Array(bytes);

      // Save to backend
      await storeSignatureMutation.mutateAsync(safe);

      // Capture data URL from canvas for inline display & PDF export
      const canvas = clientCanvasRef.current;
      const dataUrl = canvas ? canvas.toDataURL('image/png') : null;
      setClientSigDataUrl(dataUrl);
      setClientSigSaved(true);
    } catch {
      setClientSigError('Failed to save signature. Please try again.');
    } finally {
      setIsSavingSig(false);
    }
  };

  const handleClearClientSignature = () => {
    clearClientSig();
    setClientSigSaved(false);
    setClientSigError('');
    setClientSigDataUrl(null);
  };

  // ── Derived totals ──
  const jobParts = allParts.filter(
    (p) => p.jobId !== undefined && p.jobId !== null && job && p.jobId === job.id
  );
  const partsSubtotal = jobParts.reduce((sum, p) => sum + Number(p.unitCost), 0);
  const laborSubtotal = (job?.laborLineItems || []).reduce(
    (sum, item) => sum + Number(item.totalAmount),
    0
  );
  const subtotal = partsSubtotal + laborSubtotal;
  const taxAmount = subtotal * (taxRate / 100);
  const grandTotal = subtotal + taxAmount;

  const formatCurrency = (cents: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

  const formatDate = (time: bigint) =>
    new Date(Number(time) / 1_000_000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

  const buildInvoiceHTML = (): string => {
    if (!job || !client) return '';

    const laborRows = (job.laborLineItems || [])
      .map(
        (item) => `
        <tr>
          <td style="padding:8px 4px 8px 0;border-bottom:1px solid #f0f0f0;font-size:13px">
            <div style="font-weight:500">${item.name}</div>
            ${item.description ? `<div style="font-size:11px;color:#888">${item.description}</div>` : ''}
          </td>
          <td style="padding:8px 4px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:12px;white-space:nowrap">
            ${formatCurrency(Number(item.rateAmount))}/${item.rateType === 'hourly' ? 'hr' : 'flat'}
          </td>
          <td style="padding:8px 4px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:12px">
            ${item.rateType === 'hourly' ? item.hours.toFixed(1) : '—'}
          </td>
          <td style="padding:8px 0 8px 4px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600;font-size:13px;white-space:nowrap">
            ${formatCurrency(Number(item.totalAmount))}
          </td>
        </tr>`
      )
      .join('');

    const partRows = jobParts
      .map(
        (part) => `
        <tr>
          <td style="padding:8px 4px 8px 0;border-bottom:1px solid #f0f0f0;font-size:13px">
            <div style="font-weight:500">${part.name}</div>
            ${part.partNumber ? `<div style="font-size:11px;color:#888">#${part.partNumber}</div>` : ''}
          </td>
          <td style="padding:8px 4px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:12px">1</td>
          <td style="padding:8px 0 8px 4px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600;font-size:13px;white-space:nowrap">
            ${formatCurrency(Number(part.unitCost))}
          </td>
        </tr>`
      )
      .join('');

    const clientSigSection = clientSigDataUrl
      ? `<div style="margin-top:28px;padding-top:16px;border-top:2px solid #e0e0e0">
           <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#2d6a4f;margin-bottom:10px">Customer Signature</div>
           <img src="${clientSigDataUrl}" alt="Customer Signature" style="max-height:90px;max-width:100%;border:1px solid #e0e0e0;border-radius:4px;display:block" />
           <div style="margin-top:6px;font-size:11px;color:#888">Signed on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
         </div>`
      : `<div style="margin-top:28px;padding-top:16px;border-top:2px solid #e0e0e0">
           <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#2d6a4f;margin-bottom:10px">Customer Signature</div>
           <div style="height:60px;border:1px solid #ccc;border-radius:4px;background:#fafafa"></div>
           <div style="margin-top:6px;font-size:11px;color:#888">Date: _______________</div>
         </div>`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Invoice - ${client.name} - Job #${job.id}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a1a1a;background:#fff;padding:32px 24px;max-width:680px;margin:0 auto}
    @media print{body{padding:16px}}
    table{border-collapse:collapse;width:100%}
  </style>
</head>
<body>
  <div style="margin-bottom:28px;padding-bottom:20px;border-bottom:2px solid #2d6a4f">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
      <div>
        <div style="font-size:18px;font-weight:700;color:#2d6a4f">${BUSINESS_NAME}</div>
        <div style="font-size:12px;color:#666;margin-top:3px">${BUSINESS_PHONE_1} &nbsp;|&nbsp; ${BUSINESS_PHONE_2}</div>
        <div style="font-size:12px;color:#666;margin-top:2px">${BUSINESS_EMAIL}</div>
      </div>
    </div>
    <div>
      <div style="font-size:26px;font-weight:800;color:#2d6a4f">INVOICE</div>
      <div style="font-size:12px;color:#666;margin-top:3px">Job #${job.id.toString().padStart(5, '0')}</div>
      <div style="font-size:12px;color:#666">${formatDate(job.date)}</div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:28px">
    <div>
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#2d6a4f;margin-bottom:6px">Bill To</div>
      <div style="font-weight:600;font-size:14px">${client.name}</div>
      ${client.address ? `<div style="font-size:12px;color:#555;margin-top:2px">${client.address}</div>` : ''}
      ${client.phone ? `<div style="font-size:12px;color:#555">${client.phone}</div>` : ''}
      ${client.email ? `<div style="font-size:12px;color:#555">${client.email}</div>` : ''}
    </div>
    <div>
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#2d6a4f;margin-bottom:6px">Job Details</div>
      <div style="font-size:12px;color:#555">Status: <strong style="text-transform:capitalize">${job.status}</strong></div>
      ${job.waiverType ? `<div style="font-size:12px;color:#555">Waiver: <strong style="text-transform:capitalize">${job.waiverType}</strong></div>` : ''}
      ${job.stripePaymentId ? `<div style="margin-top:4px;display:inline-block;padding:2px 8px;background:#e8f5e9;color:#2d6a4f;border-radius:4px;font-size:11px;font-weight:600">PAID</div>` : ''}
    </div>
  </div>

  ${jobParts.length > 0 ? `
  <div style="margin-bottom:20px">
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#2d6a4f;margin-bottom:8px">Parts</div>
    <table>
      <thead>
        <tr style="border-bottom:2px solid #e0e0e0">
          <th style="text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;color:#888;padding-bottom:6px">Part</th>
          <th style="text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;color:#888;padding-bottom:6px">Qty</th>
          <th style="text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;color:#888;padding-bottom:6px">Amount</th>
        </tr>
      </thead>
      <tbody>${partRows}</tbody>
    </table>
  </div>` : ''}

  ${(job.laborLineItems || []).length > 0 ? `
  <div style="margin-bottom:20px">
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#2d6a4f;margin-bottom:8px">Labor</div>
    <table>
      <thead>
        <tr style="border-bottom:2px solid #e0e0e0">
          <th style="text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;color:#888;padding-bottom:6px">Description</th>
          <th style="text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;color:#888;padding-bottom:6px">Rate</th>
          <th style="text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;color:#888;padding-bottom:6px">Hrs</th>
          <th style="text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;color:#888;padding-bottom:6px">Amount</th>
        </tr>
      </thead>
      <tbody>${laborRows}</tbody>
    </table>
  </div>` : ''}

  <div style="display:flex;justify-content:flex-end;margin-bottom:28px">
    <div style="width:240px">
      <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;color:#555">
        <span>Parts Subtotal</span><span>${formatCurrency(partsSubtotal)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;color:#555">
        <span>Labor Subtotal</span><span>${formatCurrency(laborSubtotal)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;color:#555;border-top:1px solid #e0e0e0;margin-top:4px">
        <span>Subtotal</span><span>${formatCurrency(subtotal)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;color:#555">
        <span>Tax (${taxRate}%)</span><span>${formatCurrency(Math.round(taxAmount))}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-top:2px solid #1a1a1a;font-weight:700;font-size:15px">
        <span>Total</span><span>${formatCurrency(Math.round(grandTotal))}</span>
      </div>
    </div>
  </div>

  ${job.notes ? `
  <div style="margin-bottom:20px;padding:12px;background:#fafafa;border:1px solid #e0e0e0;border-radius:6px">
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#888;margin-bottom:5px">Notes</div>
    <div style="font-size:12px;color:#444;white-space:pre-wrap">${job.notes}</div>
  </div>` : ''}

  ${clientSigSection}

  <div style="margin-top:36px;padding-top:14px;border-top:1px solid #e0e0e0;text-align:center;font-size:11px;color:#999">
    <p>Thank you for your business! — ${BUSINESS_NAME}</p>
    <p style="margin-top:3px">Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
  </div>
</body>
</html>`;
  };

  const handleDownload = () => {
    const html = buildInvoiceHTML();
    if (!html) return;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = client?.name.replace(/[^a-zA-Z0-9]/g, '-') ?? 'client';
    a.download = `Invoice-${safeName}-Job${jobId}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const html = buildInvoiceHTML();
    if (!html) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  if (jobLoading || clientLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!job || !client) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-muted-foreground">Invoice not found.</p>
        <Button variant="outline" onClick={() => navigate({ to: '/jobs' })}>
          Back to Jobs
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 pb-28">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-card border-b border-border px-3 py-3 flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: '/jobs' })}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-semibold text-foreground text-base">Invoice Preview</h1>
        <div className="flex gap-1.5">
          <Button variant="outline" size="icon" onClick={handlePrint} title="Print Invoice">
            <Printer className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleDownload} title="Download HTML">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Invoice Card */}
      <div className="w-full max-w-xl mx-auto px-3 py-5">
        <div ref={invoiceRef} className="bg-white text-gray-900 rounded-2xl shadow-md border border-gray-200 overflow-hidden">
          <div className="p-5">

            {/* ── Company Header ── */}
            <div className="mb-6 pb-5 border-b-2 border-green-700">
              <div className="flex items-center gap-3 mb-3">
                <img
                  src="/assets/generated/reliable-logo.dim_256x256.png"
                  alt="Logo"
                  className="h-12 w-12 object-contain flex-shrink-0"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-green-800 leading-tight">{BUSINESS_NAME}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">{BUSINESS_PHONE_1} · {BUSINESS_PHONE_2}</p>
                  <p className="text-xs text-gray-500">{BUSINESS_EMAIL}</p>
                </div>
              </div>
              <div className="flex items-end justify-between">
                <h1 className="text-2xl font-extrabold text-green-800 tracking-tight">INVOICE</h1>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-700">#{job.id.toString().padStart(5, '0')}</p>
                  <p className="text-xs text-gray-500">{formatDate(job.date)}</p>
                </div>
              </div>
            </div>

            {/* ── Bill To / Job Details ── */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-green-800 mb-1">Bill To</p>
                <p className="font-semibold text-sm">{client.name}</p>
                {client.address && <p className="text-xs text-gray-500 mt-0.5">{client.address}</p>}
                {client.phone && <p className="text-xs text-gray-500">{client.phone}</p>}
                {client.email && <p className="text-xs text-gray-500">{client.email}</p>}
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-green-800 mb-1">Job Details</p>
                <p className="text-xs text-gray-600">
                  Status: <strong className="capitalize">{job.status}</strong>
                </p>
                {job.waiverType && (
                  <p className="text-xs text-gray-600">
                    Waiver: <strong className="capitalize">{job.waiverType}</strong>
                  </p>
                )}
                {job.stripePaymentId && (
                  <span className="mt-1 inline-block px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs font-semibold">
                    PAID
                  </span>
                )}
              </div>
            </div>

            {/* ── Parts Table ── */}
            {jobParts.length > 0 && (
              <div className="mb-5">
                <p className="text-xs font-bold uppercase tracking-wide text-green-800 mb-2">Parts</p>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b-2 border-gray-200">
                      <th className="text-left text-xs font-bold uppercase text-gray-400 pb-1.5">Part</th>
                      <th className="text-right text-xs font-bold uppercase text-gray-400 pb-1.5">Qty</th>
                      <th className="text-right text-xs font-bold uppercase text-gray-400 pb-1.5">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobParts.map((part) => (
                      <tr key={String(part.id)} className="border-b border-gray-100">
                        <td className="py-2 pr-2">
                          <p className="font-medium text-sm">{part.name}</p>
                          {part.partNumber && <p className="text-xs text-gray-400">#{part.partNumber}</p>}
                        </td>
                        <td className="py-2 text-right text-xs text-gray-600">1</td>
                        <td className="py-2 text-right font-semibold text-sm">{formatCurrency(Number(part.unitCost))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── Labor Table ── */}
            {(job.laborLineItems || []).length > 0 && (
              <div className="mb-5">
                <p className="text-xs font-bold uppercase tracking-wide text-green-800 mb-2">Labor</p>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b-2 border-gray-200">
                      <th className="text-left text-xs font-bold uppercase text-gray-400 pb-1.5">Description</th>
                      <th className="text-right text-xs font-bold uppercase text-gray-400 pb-1.5">Rate</th>
                      <th className="text-right text-xs font-bold uppercase text-gray-400 pb-1.5">Hrs</th>
                      <th className="text-right text-xs font-bold uppercase text-gray-400 pb-1.5">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(job.laborLineItems || []).map((item, idx) => (
                      <tr key={idx} className="border-b border-gray-100">
                        <td className="py-2 pr-2">
                          <p className="font-medium text-sm">{item.name}</p>
                          {item.description && <p className="text-xs text-gray-400">{item.description}</p>}
                        </td>
                        <td className="py-2 text-right text-xs text-gray-600 whitespace-nowrap">
                          {formatCurrency(Number(item.rateAmount))}/{item.rateType === 'hourly' ? 'hr' : 'flat'}
                        </td>
                        <td className="py-2 text-right text-xs text-gray-600">
                          {item.rateType === 'hourly' ? item.hours.toFixed(1) : '—'}
                        </td>
                        <td className="py-2 text-right font-semibold text-sm whitespace-nowrap">
                          {formatCurrency(Number(item.totalAmount))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── Totals ── */}
            <div className="flex justify-end mb-6">
              <div className="w-56 space-y-1">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Parts Subtotal</span>
                  <span>{formatCurrency(partsSubtotal)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Labor Subtotal</span>
                  <span>{formatCurrency(laborSubtotal)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500 border-t border-gray-200 pt-1">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Tax ({taxRate}%)</span>
                  <span>{formatCurrency(Math.round(taxAmount))}</span>
                </div>
                <div className="flex justify-between font-bold text-base border-t-2 border-gray-900 pt-1.5">
                  <span>Total</span>
                  <span>{formatCurrency(Math.round(grandTotal))}</span>
                </div>
              </div>
            </div>

            {/* ── Notes ── */}
            {job.notes && (
              <div className="mb-5 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-xs font-bold uppercase text-gray-400 mb-1">Notes</p>
                <p className="text-xs text-gray-600 whitespace-pre-wrap">{job.notes}</p>
              </div>
            )}

            {/* ── Customer Signature (saved display) ── */}
            {clientSigDataUrl && (
              <div className="mb-5 pt-4 border-t-2 border-gray-200">
                <p className="text-xs font-bold uppercase tracking-wide text-green-800 mb-2">Customer Signature</p>
                <img
                  src={clientSigDataUrl}
                  alt="Customer Signature"
                  className="max-h-24 max-w-full border border-gray-200 rounded"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Signed on {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
            )}

          </div>{/* end p-5 */}
        </div>{/* end invoice card */}

        {/* ── Signature Pad (outside the white card, below it) ── */}
        <div className="mt-4 bg-card rounded-2xl shadow-sm border border-border p-4">
          <div className="flex items-center gap-2 mb-3">
            <PenLine size={16} className="text-primary" />
            <p className="text-sm font-semibold text-foreground">Customer Signature</p>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Have the customer sign below using their finger or mouse.
          </p>

          {/* Canvas wrapper — explicit height guarantees a non-zero drawing area */}
          <div
            className="relative rounded-lg border-2 border-dashed border-border bg-white overflow-hidden"
            style={{ height: '140px' }}
          >
            <canvas
              ref={clientCanvasRef}
              style={{
                display: 'block',
                width: '100%',
                height: '100%',
                touchAction: 'none',
                cursor: 'crosshair',
              }}
            />
            {clientSigIsEmpty && !clientSigSaved && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-gray-300 text-sm select-none">Sign here</span>
              </div>
            )}
          </div>

          {/* Error message */}
          {clientSigError && (
            <p className="text-destructive text-xs mt-2">{clientSigError}</p>
          )}

          {/* Success message */}
          {clientSigSaved && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mt-2">
              <Check size={15} />
              Signature saved successfully!
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 mt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClearClientSignature}
              disabled={clientSigIsEmpty || isSavingSig}
              className="rounded-lg"
            >
              <RotateCcw size={13} className="mr-1.5" />
              Clear
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveClientSignature}
              disabled={clientSigIsEmpty || isSavingSig || clientSigSaved}
              className="flex-1 bg-primary text-primary-foreground rounded-lg font-semibold"
            >
              {isSavingSig ? (
                <>
                  <Loader2 className="animate-spin mr-2" size={14} />
                  Saving...
                </>
              ) : clientSigSaved ? (
                <>
                  <Check size={14} className="mr-1.5" />
                  Saved!
                </>
              ) : (
                'Save Signature'
              )}
            </Button>
          </div>
        </div>

      </div>{/* end max-w-xl */}
    </div>
  );
}
