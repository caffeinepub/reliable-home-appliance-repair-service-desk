import React, { useRef, useState, useEffect } from 'react';
import { useParams, useNavigate, useSearch } from '@tanstack/react-router';
import { ArrowLeft, Download, Printer, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGetJob, useGetClient, useGetUserSignature, useStoreUserSignature, useListParts } from '../hooks/useQueries';
import { useSignaturePad } from '../hooks/useSignaturePad';
import { RateType } from '../backend';

const BUSINESS_NAME = 'Reliable Home Appliance Repair LLC';
const BUSINESS_PHONE = '(631) 831-3333';
const BUSINESS_EMAIL = 'reliablehomeappliancerepair@gmail.com';

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
  const { data: client, isLoading: clientLoading } = useGetClient(job?.clientId);
  const { data: allParts = [] } = useListParts();
  const { data: existingSigBytes } = useGetUserSignature();
  const storeSignature = useStoreUserSignature();

  const { canvasRef, clear, getSignatureBytes, isEmpty } = useSignaturePad();
  const [sigSaved, setSigSaved] = useState(false);
  const [sigError, setSigError] = useState('');
  const [existingSigUrl, setExistingSigUrl] = useState<string | null>(null);

  useEffect(() => {
    if (existingSigBytes && existingSigBytes.length > 0) {
      const safe = toSafeUint8Array(existingSigBytes);
      const blob = new Blob([safe], { type: 'image/png' });
      const url = URL.createObjectURL(blob);
      setExistingSigUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [existingSigBytes]);

  const handleSaveSignature = async () => {
    setSigError('');
    if (isEmpty) {
      setSigError('Please draw your signature before saving.');
      return;
    }
    const bytes = await getSignatureBytes();
    if (!bytes) {
      setSigError('Failed to capture signature.');
      return;
    }
    try {
      await storeSignature.mutateAsync(bytes);
      setSigSaved(true);
      const safe = toSafeUint8Array(bytes);
      const blob = new Blob([safe], { type: 'image/png' });
      const url = URL.createObjectURL(blob);
      setExistingSigUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    } catch {
      setSigError('Failed to save signature. Please try again.');
    }
  };

  // ── Derived totals ──
  const jobParts = allParts.filter(
    p => p.jobId !== undefined && p.jobId !== null && job && p.jobId === job.id
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
        item => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;">
            <div style="font-weight:500">${item.name}</div>
            ${item.description ? `<div style="font-size:11px;color:#888">${item.description}</div>` : ''}
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:right">
            ${formatCurrency(Number(item.rateAmount))}/${item.rateType === 'hourly' ? 'hr' : 'flat'}
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:right">
            ${item.rateType === 'hourly' ? item.hours.toFixed(1) : '1'}
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:500">
            ${formatCurrency(Number(item.totalAmount))}
          </td>
        </tr>`
      )
      .join('');

    const partRows = jobParts
      .map(
        part => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;">
            <div style="font-weight:500">${part.name}</div>
            ${part.partNumber ? `<div style="font-size:11px;color:#888">#${part.partNumber}</div>` : ''}
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:right">—</td>
          <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:right">1</td>
          <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:500">
            ${formatCurrency(Number(part.unitCost))}
          </td>
        </tr>`
      )
      .join('');

    const sigSection = existingSigUrl
      ? `<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e0e0e0">
           <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#666;margin-bottom:8px">Technician Signature</div>
           <img src="${existingSigUrl}" alt="Signature" style="max-height:80px;border:1px solid #e0e0e0;border-radius:4px" />
         </div>`
      : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Invoice - ${client.name} - Job #${job.id}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a1a1a;background:#fff;padding:40px;max-width:720px;margin:0 auto}
    @media print{body{padding:20px}}
  </style>
</head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:24px;border-bottom:2px solid #2d6a4f">
    <div>
      <div style="font-size:20px;font-weight:700;color:#2d6a4f">${BUSINESS_NAME}</div>
      <div style="font-size:12px;color:#666;margin-top:4px">${BUSINESS_PHONE}</div>
      <div style="font-size:12px;color:#666">${BUSINESS_EMAIL}</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:28px;font-weight:800;color:#2d6a4f">INVOICE</div>
      <div style="font-size:12px;color:#666;margin-top:4px">Job #${job.id.toString().padStart(5, '0')}</div>
      <div style="font-size:12px;color:#666">${formatDate(job.date)}</div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:32px">
    <div>
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#2d6a4f;margin-bottom:8px">Bill To</div>
      <div style="font-weight:600">${client.name}</div>
      ${client.address ? `<div style="font-size:13px;color:#555;margin-top:2px">${client.address}</div>` : ''}
      ${client.phone ? `<div style="font-size:13px;color:#555">${client.phone}</div>` : ''}
      ${client.email ? `<div style="font-size:13px;color:#555">${client.email}</div>` : ''}
    </div>
    <div>
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#2d6a4f;margin-bottom:8px">Job Details</div>
      <div style="font-size:13px;color:#555">Status: <strong style="text-transform:capitalize">${job.status}</strong></div>
      ${job.waiverType ? `<div style="font-size:13px;color:#555">Waiver: <strong style="text-transform:capitalize">${job.waiverType}</strong></div>` : ''}
      ${job.stripePaymentId ? `<div style="margin-top:4px;display:inline-block;padding:2px 8px;background:#e8f5e9;color:#2d6a4f;border-radius:4px;font-size:11px;font-weight:600">PAID</div>` : ''}
    </div>
  </div>

  <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
    <thead>
      <tr style="border-bottom:2px solid #e0e0e0">
        <th style="text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#666;padding-bottom:8px">Description</th>
        <th style="text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#666;padding-bottom:8px">Rate</th>
        <th style="text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#666;padding-bottom:8px">Qty/Hrs</th>
        <th style="text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#666;padding-bottom:8px">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${partRows}
      ${laborRows}
    </tbody>
  </table>

  <div style="display:flex;justify-content:flex-end;margin-bottom:32px">
    <div style="width:260px">
      <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#555">
        <span>Parts Subtotal</span><span>${formatCurrency(partsSubtotal)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#555">
        <span>Labor Subtotal</span><span>${formatCurrency(laborSubtotal)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#555;border-top:1px solid #e0e0e0;margin-top:4px">
        <span>Subtotal</span><span>${formatCurrency(subtotal)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#555">
        <span>Tax (${taxRate}%)</span><span>${formatCurrency(Math.round(taxAmount))}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:10px 0;border-top:2px solid #1a1a1a;font-weight:700;font-size:15px">
        <span>Total</span><span>${formatCurrency(Math.round(grandTotal))}</span>
      </div>
    </div>
  </div>

  ${job.notes ? `
  <div style="margin-bottom:24px;padding:12px;background:#fafafa;border:1px solid #e0e0e0;border-radius:8px">
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#666;margin-bottom:6px">Notes</div>
    <div style="font-size:13px;color:#444;white-space:pre-wrap">${job.notes}</div>
  </div>` : ''}

  ${sigSection}

  <div style="margin-top:40px;padding-top:16px;border-top:1px solid #e0e0e0;text-align:center;font-size:11px;color:#999">
    <p>Thank you for your business! — ${BUSINESS_NAME}</p>
    <p style="margin-top:4px">Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
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
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: '/jobs' })}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-semibold text-foreground">Invoice Preview</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={handlePrint} title="Print Invoice">
            <Printer className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleDownload} title="Download HTML">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Invoice Content */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div ref={invoiceRef} className="bg-white text-gray-900 rounded-xl shadow-lg p-8">
          {/* Company Header */}
          <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-green-700">
            <div className="flex items-center gap-3">
              <img
                src="/assets/generated/reliable-logo.dim_256x256.png"
                alt="Logo"
                className="h-16 w-16 object-contain"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <div>
                <h2 className="text-xl font-bold text-green-800">{BUSINESS_NAME}</h2>
                <p className="text-sm text-gray-500">{BUSINESS_PHONE}</p>
                <p className="text-sm text-gray-500">{BUSINESS_EMAIL}</p>
              </div>
            </div>
            <div className="text-right">
              <h1 className="text-3xl font-bold text-green-800">INVOICE</h1>
              <p className="text-sm text-gray-500 mt-1">#{job.id.toString().padStart(5, '0')}</p>
              <p className="text-sm text-gray-500">{formatDate(job.date)}</p>
            </div>
          </div>

          {/* Bill To */}
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Bill To
              </h3>
              <p className="font-semibold text-gray-900">{client.name}</p>
              {client.address && <p className="text-sm text-gray-600">{client.address}</p>}
              {client.phone && <p className="text-sm text-gray-600">{client.phone}</p>}
              {client.email && <p className="text-sm text-gray-600">{client.email}</p>}
            </div>
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Job Details
              </h3>
              <p className="text-sm text-gray-600">
                Status: <span className="font-medium capitalize">{job.status}</span>
              </p>
              {job.waiverType && (
                <p className="text-sm text-gray-600">
                  Waiver: <span className="font-medium capitalize">{job.waiverType}</span>
                </p>
              )}
              {job.stripePaymentId && (
                <span className="inline-block mt-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                  Paid
                </span>
              )}
            </div>
          </div>

          {/* Parts Line Items */}
          {jobParts.length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Parts
              </h3>
              <table className="w-full mb-2">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider pb-2">Part</th>
                    <th className="text-right text-xs font-semibold text-gray-400 uppercase tracking-wider pb-2">Qty</th>
                    <th className="text-right text-xs font-semibold text-gray-400 uppercase tracking-wider pb-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {jobParts.map((part, idx) => (
                    <tr key={idx} className="border-b border-gray-100">
                      <td className="py-2 text-sm text-gray-700">
                        <div className="font-medium">{part.name}</div>
                        {part.partNumber && <div className="text-xs text-gray-400">#{part.partNumber}</div>}
                      </td>
                      <td className="py-2 text-sm text-gray-700 text-right">1</td>
                      <td className="py-2 text-sm font-medium text-gray-900 text-right">
                        {formatCurrency(Number(part.unitCost))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Labor Line Items */}
          {job.laborLineItems.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Labor
              </h3>
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider pb-2">Description</th>
                    <th className="text-right text-xs font-semibold text-gray-400 uppercase tracking-wider pb-2">Rate</th>
                    <th className="text-right text-xs font-semibold text-gray-400 uppercase tracking-wider pb-2">Qty/Hrs</th>
                    <th className="text-right text-xs font-semibold text-gray-400 uppercase tracking-wider pb-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {job.laborLineItems.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-100">
                      <td className="py-3 text-sm text-gray-700">
                        <div className="font-medium">{item.name}</div>
                        {item.description && (
                          <div className="text-xs text-gray-400">{item.description}</div>
                        )}
                      </td>
                      <td className="py-3 text-sm text-gray-700 text-right">
                        {formatCurrency(Number(item.rateAmount))}/
                        {item.rateType === RateType.hourly ? 'hr' : 'flat'}
                      </td>
                      <td className="py-3 text-sm text-gray-700 text-right">
                        {item.rateType === RateType.hourly ? item.hours.toFixed(1) : '1'}
                      </td>
                      <td className="py-3 text-sm font-medium text-gray-900 text-right">
                        {formatCurrency(Number(item.totalAmount))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Totals */}
          <div className="flex justify-end mb-8">
            <div className="w-72 space-y-1">
              <div className="flex justify-between py-1 text-sm text-gray-600">
                <span>Parts Subtotal</span>
                <span>{formatCurrency(partsSubtotal)}</span>
              </div>
              <div className="flex justify-between py-1 text-sm text-gray-600">
                <span>Labor Subtotal</span>
                <span>{formatCurrency(laborSubtotal)}</span>
              </div>
              <div className="flex justify-between py-1 text-sm text-gray-600 border-t border-gray-200 pt-2">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between py-1 text-sm text-gray-600">
                <span>Tax ({taxRate}%)</span>
                <span>{formatCurrency(Math.round(taxAmount))}</span>
              </div>
              <div className="flex justify-between py-2 border-t-2 border-gray-900 font-bold text-gray-900 text-base">
                <span>Total</span>
                <span>{formatCurrency(Math.round(grandTotal))}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {job.notes && (
            <div className="mb-8 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Notes
              </h3>
              <p className="text-sm text-gray-600">{job.notes}</p>
            </div>
          )}

          {/* Signature Section */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Technician Signature
            </h3>

            {existingSigUrl ? (
              <div className="mb-4">
                <img
                  src={existingSigUrl}
                  alt="Saved Signature"
                  className="max-h-20 border border-gray-200 rounded"
                />
                {sigSaved && (
                  <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" /> Signature saved
                  </p>
                )}
              </div>
            ) : (
              <div className="mb-4">
                <p className="text-xs text-gray-500 mb-2">Draw your signature below:</p>
                <canvas
                  ref={canvasRef}
                  width={400}
                  height={120}
                  className="border border-gray-300 rounded-lg bg-white touch-none w-full"
                  style={{ maxWidth: '400px' }}
                />
                {sigError && <p className="text-xs text-red-500 mt-1">{sigError}</p>}
                <div className="flex gap-2 mt-2">
                  <Button size="sm" variant="outline" onClick={clear}>
                    Clear
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveSignature}
                    disabled={storeSignature.isPending || isEmpty}
                  >
                    {storeSignature.isPending ? 'Saving...' : 'Save Signature'}
                  </Button>
                </div>
              </div>
            )}

            {/* Customer signature line */}
            <div className="mt-6">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
                Customer Signature
              </h3>
              <div className="border-b border-gray-400 w-64 h-16" />
              <p className="text-xs text-gray-400 mt-1">
                By signing, customer authorizes the work described above.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-4 border-t border-gray-200 text-center text-xs text-gray-400">
            <p>Thank you for your business! — {BUSINESS_NAME}</p>
            <p className="mt-1">
              Generated{' '}
              {new Date().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
