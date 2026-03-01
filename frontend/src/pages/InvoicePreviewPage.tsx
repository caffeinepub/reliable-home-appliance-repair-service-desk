import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { ArrowLeft, Download, Mail, MessageSquare, FileText, CheckCircle, Loader2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useGetJob, useListClients, useListParts, useGetDamageWaiver, useUpdateEstimate } from '@/hooks/useQueries';
import { useSignaturePad } from '@/hooks/useSignaturePad';
import { useActor } from '@/hooks/useActor';

const TAX_RATE = 0.08875;
const COMPANY_NAME = 'Reliable Home Appliance Repair LLC';

function formatDate(ns: bigint) {
  return new Date(Number(ns) / 1_000_000).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

function formatCurrency(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function InvoicePreviewPage() {
  const { jobId } = useParams({ strict: false }) as { jobId?: string };
  const navigate = useNavigate();
  const { actor } = useActor();

  const { data: job } = useGetJob(jobId ? Number(jobId) : null);
  const { data: clients = [] } = useListClients();
  const { data: parts = [] } = useListParts();
  const { data: damageWaiver } = useGetDamageWaiver(jobId ? Number(jobId) : null);
  const updateEstimate = useUpdateEstimate();

  const invoiceRef = useRef<HTMLDivElement>(null);
  const { canvasRef, clear, getSignatureBytes, isEmpty } = useSignaturePad();

  const [savedSignatureUrl, setSavedSignatureUrl] = useState<string | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [signSaved, setSignSaved] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const client = clients.find(c => c.id === job?.clientId);
  const jobParts = parts.filter(p => p.jobId === job?.id);

  const laborTotal = (job?.laborLineItems || []).reduce((s, i) => s + Number(i.totalAmount), 0);
  const partsTotal = jobParts.reduce((s, p) => s + Number(p.unitCost), 0);
  const subtotal = laborTotal + partsTotal;
  const tax = Math.round(subtotal * TAX_RATE);
  const total = subtotal + tax;

  // Load existing signature if estimate already signed
  useEffect(() => {
    if (job?.estimate?.sigData) {
      const blob = new Blob([new Uint8Array(job.estimate.sigData)], { type: 'image/png' });
      const url = URL.createObjectURL(blob);
      setSavedSignatureUrl(url);
      setSignSaved(true);
    }
  }, [job?.estimate?.sigData]);

  const handleSaveSignature = async () => {
    if (isEmpty || !actor || !job) return;
    setIsSigning(true);
    try {
      const bytes = getSignatureBytes();
      if (!bytes) throw new Error('No signature data');

      const canvas = canvasRef.current;
      if (canvas) {
        const dataUrl = canvas.toDataURL('image/png');
        setSavedSignatureUrl(dataUrl);
      }

      await updateEstimate.mutateAsync({
        jobId: Number(job.id),
        estimate: {
          amount: BigInt(total),
          sigData: bytes,
          sigTime: BigInt(Date.now()) * BigInt(1_000_000),
        },
      });
      setSignSaved(true);
    } catch (e) {
      console.error('Failed to save signature', e);
    } finally {
      setIsSigning(false);
    }
  };

  const buildInvoiceHTML = useCallback((signatureDataUrl?: string) => {
    const sigHtml = signatureDataUrl
      ? `<img src="${signatureDataUrl}" style="max-height:80px;border:1px solid #ccc;border-radius:4px;" alt="Customer Signature" />`
      : '<p style="color:#999;font-style:italic;">Not yet signed</p>';

    const waiverHtml =
      damageWaiver?.enabled
        ? `<div style="margin:24px 0;padding:16px;border:1px solid #fde68a;border-radius:8px;background:#fffbeb;">
            <h3 style="margin:0 0 8px;font-size:14px;font-weight:600;color:#92400e;">Damage Waiver</h3>
            <p style="margin:0;font-size:13px;color:#78350f;line-height:1.6;">${damageWaiver.waiverText}</p>
          </div>`
        : '';

    const laborRows = (job?.laborLineItems || [])
      .map(
        item =>
          `<tr>
            <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;">${item.name}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;text-align:center;">${item.rateType === 'hourly' ? item.hours + ' hr' : 'Flat'}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;text-align:right;">$${Number(item.rateAmount).toFixed(2)}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;text-align:right;">$${Number(item.totalAmount).toFixed(2)}</td>
          </tr>`
      )
      .join('');

    const partsRows = jobParts
      .map(
        p =>
          `<tr>
            <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;">${p.name}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;text-align:center;">—</td>
            <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;text-align:right;">—</td>
            <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;text-align:right;">$${Number(p.unitCost).toFixed(2)}</td>
          </tr>`
      )
      .join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Estimate — ${COMPANY_NAME}</title>
<style>
  body { font-family: Arial, sans-serif; color: #111; margin: 0; padding: 32px; background: #fff; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th { background: #f3f4f6; padding: 8px 12px; text-align: left; font-size: 13px; }
  td { font-size: 13px; }
  .grand-total td { font-weight: bold; font-size: 15px; border-top: 2px solid #111; }
</style>
</head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;">
    <div>
      <h1>${COMPANY_NAME}</h1>
      <p style="margin:4px 0;color:#555;font-size:13px;">Professional Appliance Repair</p>
    </div>
    <div style="text-align:right;">
      <p style="margin:0;font-size:13px;color:#555;">Date: ${job ? formatDate(job.date) : ''}</p>
      <p style="margin:4px 0;font-size:13px;color:#555;">Job #${jobId}</p>
    </div>
  </div>

  <div style="margin-bottom:24px;padding:16px;background:#f9fafb;border-radius:8px;">
    <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Bill To</p>
    <p style="margin:0;font-size:14px;font-weight:600;">${client?.name || '—'}</p>
    <p style="margin:2px 0;font-size:13px;color:#555;">${client?.phone || ''}</p>
    <p style="margin:2px 0;font-size:13px;color:#555;">${client?.address || ''}</p>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th style="text-align:center;">Qty/Hrs</th>
        <th style="text-align:right;">Rate</th>
        <th style="text-align:right;">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${laborRows}
      ${partsRows}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="3" style="padding:8px 12px;text-align:right;color:#555;">Subtotal</td>
        <td style="padding:8px 12px;text-align:right;">${formatCurrency(subtotal)}</td>
      </tr>
      <tr>
        <td colspan="3" style="padding:8px 12px;text-align:right;color:#555;">Tax (8.875%)</td>
        <td style="padding:8px 12px;text-align:right;">${formatCurrency(tax)}</td>
      </tr>
    </tfoot>
    <tfoot class="grand-total">
      <tr>
        <td colspan="3" style="padding:12px;text-align:right;">Total</td>
        <td style="padding:12px;text-align:right;">${formatCurrency(total)}</td>
      </tr>
    </tfoot>
  </table>

  ${waiverHtml}

  <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;">
    <p style="font-size:13px;color:#374151;font-weight:600;margin-bottom:8px;">Customer Signature</p>
    ${sigHtml}
    <p style="font-size:11px;color:#9ca3af;margin-top:8px;">Signed on ${new Date().toLocaleDateString()}</p>
  </div>
</body>
</html>`;
  }, [job, client, jobParts, damageWaiver, subtotal, tax, total, jobId]);

  const handleDownloadHTML = useCallback(() => {
    const html = buildInvoiceHTML(savedSignatureUrl || undefined);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `estimate-job-${jobId}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }, [buildInvoiceHTML, savedSignatureUrl, jobId]);

  // PDF export: open a print-optimised version of the HTML in a new window
  const handleDownloadPDF = useCallback(async () => {
    setIsExportingPdf(true);
    try {
      const html = buildInvoiceHTML(savedSignatureUrl || undefined);
      const printHtml = html.replace(
        '</style>',
        `@media print { body { margin: 0; padding: 20px; } }
        </style>
        <script>window.onload = function(){ window.print(); window.onafterprint = function(){ window.close(); }; }<\/script>`
      );
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(printHtml);
        win.document.close();
      }
    } finally {
      setIsExportingPdf(false);
    }
  }, [buildInvoiceHTML, savedSignatureUrl]);

  const handleShareEmail = useCallback(() => {
    const subject = encodeURIComponent(`Your Estimate from ${COMPANY_NAME}`);
    const body = encodeURIComponent(
      `Dear ${client?.name || 'Valued Customer'},\n\n` +
      `Please find your signed estimate from ${COMPANY_NAME} below.\n\n` +
      `Job Date: ${job ? formatDate(job.date) : ''}\n` +
      `Total: ${formatCurrency(total)}\n\n` +
      `Your signed estimate is attached. Please reply if you have any questions.\n\n` +
      `Thank you for choosing ${COMPANY_NAME}!`
    );
    window.location.href = `mailto:${client?.email || ''}?subject=${subject}&body=${body}`;
  }, [client, job, total]);

  const handleShareSMS = useCallback(() => {
    const msg = encodeURIComponent(
      `Your estimate from ${COMPANY_NAME} is ready. Total: ${formatCurrency(total)}. Please reply to confirm.`
    );
    window.location.href = `sms:${client?.phone || ''}?body=${msg}`;
  }, [client, total]);

  if (!job) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const showWaiver = damageWaiver?.enabled;

  const ShareButtons = () => (
    <div className="grid grid-cols-2 gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleDownloadPDF}
        disabled={isExportingPdf}
        className="flex items-center gap-1.5"
      >
        {isExportingPdf ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Printer className="h-4 w-4" />
        )}
        Save as PDF
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleDownloadHTML}
        className="flex items-center gap-1.5"
      >
        <FileText className="h-4 w-4" />
        Download HTML
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleShareEmail}
        className="flex items-center gap-1.5"
      >
        <Mail className="h-4 w-4" />
        Share via Email
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleShareSMS}
        className="flex items-center gap-1.5"
      >
        <MessageSquare className="h-4 w-4" />
        Share via SMS
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: `/jobs/${jobId}` })}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold font-rajdhani">Estimate / Invoice</h1>
        {signSaved && (
          <Badge variant="default" className="ml-auto flex items-center gap-1">
            <CheckCircle className="h-3 w-3" /> Signed
          </Badge>
        )}
      </div>

      {/* Share Actions — shown above invoice once signed */}
      {signSaved && (
        <div className="px-4 pt-4 pb-2 max-w-2xl mx-auto">
          <ShareButtons />
        </div>
      )}

      {/* Invoice Content */}
      <div className="px-4 max-w-2xl mx-auto mt-4">
        <div ref={invoiceRef} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
          {/* Company Header */}
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2">
              <img
                src="/assets/generated/reliable-logo.dim_256x256.png"
                alt="Logo"
                className="h-10 w-10 rounded-lg object-cover"
              />
              <div>
                <h1 className="text-base font-bold text-gray-900 leading-tight">{COMPANY_NAME}</h1>
                <p className="text-xs text-gray-500">Professional Appliance Repair</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Date: {formatDate(job.date)}</p>
              <p className="text-xs text-gray-500">Job #{jobId}</p>
            </div>
          </div>

          {/* Client Info */}
          {client && (
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Bill To</p>
              <p className="font-medium text-gray-900">{client.name}</p>
              {client.phone && <p className="text-sm text-gray-600">{client.phone}</p>}
              {client.address && <p className="text-sm text-gray-600">{client.address}</p>}
              {client.email && <p className="text-sm text-gray-600">{client.email}</p>}
            </div>
          )}

          {/* Notes */}
          {job.notes && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes</p>
              <p className="text-sm text-gray-700">{job.notes}</p>
            </div>
          )}

          {/* Line Items */}
          <div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600">Description</th>
                  <th className="text-center px-3 py-2 text-xs font-semibold text-gray-600">Qty/Hrs</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-gray-600">Rate</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-gray-600">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(job.laborLineItems || []).map((item, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="px-3 py-2 text-gray-800">{item.name}</td>
                    <td className="px-3 py-2 text-center text-gray-600">
                      {item.rateType === 'hourly' ? `${item.hours} hr` : 'Flat'}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600">${Number(item.rateAmount).toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-medium">${Number(item.totalAmount).toFixed(2)}</td>
                  </tr>
                ))}
                {jobParts.map((p, i) => (
                  <tr key={`part-${i}`} className="border-b border-gray-100">
                    <td className="px-3 py-2 text-gray-800">{p.name}</td>
                    <td className="px-3 py-2 text-center text-gray-600">—</td>
                    <td className="px-3 py-2 text-right text-gray-600">—</td>
                    <td className="px-3 py-2 text-right font-medium">${Number(p.unitCost).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="px-3 py-2 text-right text-gray-500 text-xs">Subtotal</td>
                  <td className="px-3 py-2 text-right text-sm">{formatCurrency(subtotal)}</td>
                </tr>
                <tr>
                  <td colSpan={3} className="px-3 py-2 text-right text-gray-500 text-xs">Tax (8.875%)</td>
                  <td className="px-3 py-2 text-right text-sm">{formatCurrency(tax)}</td>
                </tr>
                <tr className="border-t-2 border-gray-900">
                  <td colSpan={3} className="px-3 py-3 text-right font-bold">Total</td>
                  <td className="px-3 py-3 text-right font-bold text-lg">{formatCurrency(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Damage Waiver — shown only when enabled for this job */}
          {showWaiver && (
            <div className="border border-amber-200 bg-amber-50 rounded-lg p-4">
              <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-2">Damage Waiver</p>
              <p className="text-sm text-amber-900 leading-relaxed">{damageWaiver!.waiverText}</p>
            </div>
          )}

          {/* Signature Section */}
          <div className="border-t border-gray-200 pt-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">Customer Signature</p>

            {signSaved && savedSignatureUrl ? (
              <div className="space-y-2">
                <img
                  src={savedSignatureUrl}
                  alt="Customer Signature"
                  className="max-h-20 border border-gray-200 rounded-lg bg-white"
                />
                <p className="text-xs text-gray-500">
                  Signed on {new Date().toLocaleDateString()}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-gray-500">
                  {showWaiver
                    ? 'By signing below, you acknowledge the damage waiver above and authorize this estimate.'
                    : 'Please sign below to authorize this estimate.'}
                </p>
                <div
                  className="border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 overflow-hidden"
                  style={{ height: 160, touchAction: 'none' }}
                >
                  <canvas
                    ref={canvasRef}
                    style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }}
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={clear} className="flex-1">
                    Clear
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveSignature}
                    disabled={isEmpty || isSigning}
                    className="flex-1"
                  >
                    {isSigning ? (
                      <span className="flex items-center gap-1.5">
                        <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                      </span>
                    ) : (
                      'Save Signature'
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Share buttons also shown below invoice when signed */}
        {signSaved && (
          <div className="mt-4 pb-8">
            <ShareButtons />
          </div>
        )}
      </div>
    </div>
  );
}
