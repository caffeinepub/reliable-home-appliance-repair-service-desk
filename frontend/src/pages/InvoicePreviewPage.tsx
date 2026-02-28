import { useState } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useGetJob, useGetClient, useListLaborRates } from '../hooks/useQueries';
import { Variant_open_complete_inProgress } from '../backend';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ArrowLeft,
  Download,
  Share2,
  FileText,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';

function formatJobDate(timestamp: bigint): string {
  try {
    const ms = Number(timestamp / BigInt(1_000_000));
    return format(new Date(ms), 'MMMM d, yyyy');
  } catch {
    return 'Unknown date';
  }
}

function formatJobDateShort(timestamp: bigint): string {
  try {
    const ms = Number(timestamp / BigInt(1_000_000));
    return format(new Date(ms), 'yyyy-MM-dd');
  } catch {
    return 'unknown';
  }
}

function formatCurrency(cents: bigint): string {
  return `$${(Number(cents) / 100).toFixed(2)}`;
}

function statusLabel(status: Variant_open_complete_inProgress): string {
  switch (status) {
    case Variant_open_complete_inProgress.open: return 'Open';
    case Variant_open_complete_inProgress.inProgress: return 'In Progress';
    case Variant_open_complete_inProgress.complete: return 'Complete';
  }
}

function buildInvoiceHTML(params: {
  jobId: string;
  clientName: string;
  clientPhone: string;
  clientAddress: string;
  clientEmail: string;
  jobDate: string;
  jobNotes: string;
  jobStatus: string;
  maintenancePackage: string;
  waiverType: string;
  estimateAmount: string;
  laborRates: string;
  stripePaymentId: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Invoice - ${params.clientName} - ${params.jobDate}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; background: #fff; padding: 40px; max-width: 700px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 2px solid #2d6a4f; }
    .company-name { font-size: 20px; font-weight: 700; color: #2d6a4f; }
    .company-sub { font-size: 12px; color: #666; margin-top: 4px; }
    .invoice-label { text-align: right; }
    .invoice-label h1 { font-size: 28px; font-weight: 800; color: #2d6a4f; letter-spacing: -0.5px; }
    .invoice-label p { font-size: 12px; color: #666; margin-top: 4px; }
    .section { margin-bottom: 24px; }
    .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #2d6a4f; margin-bottom: 8px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .info-block p { font-size: 13px; line-height: 1.6; color: #333; }
    .info-block strong { color: #1a1a1a; }
    .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0; font-size: 13px; }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { color: #666; }
    .detail-value { font-weight: 600; color: #1a1a1a; }
    .total-box { background: #f0faf5; border: 1px solid #2d6a4f; border-radius: 8px; padding: 16px; margin-top: 16px; display: flex; justify-content: space-between; align-items: center; }
    .total-label { font-size: 14px; font-weight: 600; color: #2d6a4f; }
    .total-amount { font-size: 24px; font-weight: 800; color: #2d6a4f; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; background: #e8f5e9; color: #2d6a4f; }
    .notes-box { background: #fafafa; border: 1px solid #e0e0e0; border-radius: 8px; padding: 12px; font-size: 13px; color: #444; line-height: 1.6; white-space: pre-wrap; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e0e0e0; text-align: center; font-size: 11px; color: #999; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company-name">Reliable Home Appliance Repair</div>
      <div class="company-sub">Professional Appliance Service</div>
    </div>
    <div class="invoice-label">
      <h1>INVOICE</h1>
      <p>Job #${params.jobId}</p>
      <p>${params.jobDate}</p>
    </div>
  </div>

  <div class="section">
    <div class="info-grid">
      <div class="info-block">
        <div class="section-title">Bill To</div>
        <p><strong>${params.clientName}</strong></p>
        ${params.clientPhone ? `<p>${params.clientPhone}</p>` : ''}
        ${params.clientEmail ? `<p>${params.clientEmail}</p>` : ''}
        ${params.clientAddress ? `<p>${params.clientAddress}</p>` : ''}
      </div>
      <div class="info-block">
        <div class="section-title">Job Details</div>
        <p>Status: <span class="badge">${params.jobStatus}</span></p>
        ${params.maintenancePackage ? `<p style="margin-top:6px">Package: <strong>${params.maintenancePackage}</strong></p>` : ''}
        ${params.waiverType ? `<p style="margin-top:4px">Waiver: <strong>${params.waiverType}</strong></p>` : ''}
        ${params.stripePaymentId ? `<p style="margin-top:4px">Payment ID: <strong>${params.stripePaymentId}</strong></p>` : ''}
      </div>
    </div>
  </div>

  ${params.jobNotes ? `
  <div class="section">
    <div class="section-title">Service Notes</div>
    <div class="notes-box">${params.jobNotes}</div>
  </div>` : ''}

  ${params.laborRates ? `
  <div class="section">
    <div class="section-title">Labor Rates Applied</div>
    <div class="notes-box">${params.laborRates}</div>
  </div>` : ''}

  <div class="section">
    <div class="section-title">Summary</div>
    ${params.estimateAmount ? `
    <div class="total-box">
      <div class="total-label">Estimate Total</div>
      <div class="total-amount">${params.estimateAmount}</div>
    </div>` : `
    <div class="detail-row">
      <span class="detail-label">Estimate</span>
      <span class="detail-value">Pending</span>
    </div>`}
  </div>

  <div class="footer">
    <p>Thank you for choosing Reliable Home Appliance Repair LLC</p>
    <p style="margin-top:4px">Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
  </div>
</body>
</html>`;
}

export default function InvoicePreviewPage() {
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { jobId?: string };
  const jobId = params.jobId ? BigInt(params.jobId) : null;

  const { data: job, isLoading: jobLoading } = useGetJob(jobId);
  const { data: client, isLoading: clientLoading } = useGetClient(job ? job.clientId : null);
  const { data: laborRates } = useListLaborRates();

  const [shareError, setShareError] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const canShare = typeof navigator !== 'undefined' && !!navigator.share;

  const buildParams = () => {
    if (!job || !client) return null;
    return {
      jobId: job.id.toString(),
      clientName: client.name,
      clientPhone: client.phone,
      clientAddress: client.address,
      clientEmail: client.email ?? '',
      jobDate: formatJobDate(job.date),
      jobNotes: job.notes,
      jobStatus: statusLabel(job.status),
      maintenancePackage: job.maintenancePackage ?? '',
      waiverType: job.waiverType ?? '',
      estimateAmount: job.estimate ? formatCurrency(job.estimate.amount) : '',
      laborRates: laborRates && laborRates.length > 0
        ? laborRates.map((r) => `${r.name} — ${r.rateType === 'hourly' ? `$${(Number(r.amount) / 100).toFixed(2)}/hr` : `$${(Number(r.amount) / 100).toFixed(2)} flat`}`).join('\n')
        : '',
      stripePaymentId: job.stripePaymentId ?? '',
    };
  };

  const getFileName = () => {
    if (!job || !client) return 'Invoice.html';
    const safeName = client.name.replace(/[^a-zA-Z0-9]/g, '-');
    const dateStr = formatJobDateShort(job.date);
    return `Invoice-${safeName}-${dateStr}.html`;
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const p = buildParams();
      if (!p) return;
      const html = buildInvoiceHTML(p);
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = getFileName();
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShare = async () => {
    setShareError('');
    setIsSharing(true);
    try {
      const p = buildParams();
      if (!p) return;
      const html = buildInvoiceHTML(p);
      const fileName = getFileName();

      const htmlBlob = new Blob([html], { type: 'text/html' });
      const htmlFile = new File([htmlBlob], fileName, { type: 'text/html' });

      const shareData: ShareData = {
        title: `Invoice - ${p.clientName} - ${p.jobDate}`,
        text: `Invoice for ${p.clientName} — Job #${p.jobId}${p.estimateAmount ? ` — ${p.estimateAmount}` : ''}`,
      };

      // Try sharing with file if supported
      if (navigator.canShare && navigator.canShare({ files: [htmlFile] })) {
        await navigator.share({ ...shareData, files: [htmlFile] });
      } else {
        await navigator.share(shareData);
      }
    } catch (err: unknown) {
      const error = err as Error;
      // AbortError means user cancelled — not a real error
      if (error?.name !== 'AbortError') {
        setShareError('Share failed. Try downloading instead.');
      }
    } finally {
      setIsSharing(false);
    }
  };

  const isLoading = jobLoading || clientLoading;

  if (isLoading) {
    return (
      <div className="px-4 py-5 space-y-4">
        <Skeleton className="h-8 w-32 rounded-xl" />
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-12 rounded-xl" />
      </div>
    );
  }

  if (!job || !client) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <AlertCircle size={32} className="text-destructive mb-3" />
        <p className="text-foreground font-semibold">Job not found</p>
        <button
          onClick={() => navigate({ to: '/jobs' })}
          className="text-primary text-sm mt-2"
        >
          Back to Jobs
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 py-5 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate({ to: '/jobs/$jobId', params: { jobId: job.id.toString() } })}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={18} />
          <span className="text-sm font-medium">Job</span>
        </button>
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-primary" />
          <h2 className="font-display font-bold text-lg text-foreground">Invoice Preview</h2>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button
          onClick={handleDownload}
          disabled={isDownloading}
          className="flex-1 bg-primary text-primary-foreground rounded-xl font-semibold"
          size="sm"
        >
          {isDownloading ? (
            <Loader2 size={15} className="animate-spin mr-2" />
          ) : (
            <Download size={15} className="mr-2" />
          )}
          Download HTML
        </Button>

        {canShare ? (
          <Button
            onClick={handleShare}
            disabled={isSharing}
            variant="outline"
            className="flex-1 rounded-xl font-semibold border-primary text-primary hover:bg-primary/10"
            size="sm"
          >
            {isSharing ? (
              <Loader2 size={15} className="animate-spin mr-2" />
            ) : (
              <Share2 size={15} className="mr-2" />
            )}
            Share
          </Button>
        ) : (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex-1">
                  <Button
                    disabled
                    variant="outline"
                    className="w-full rounded-xl font-semibold opacity-40"
                    size="sm"
                  >
                    <Share2 size={15} className="mr-2" />
                    Share
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>Sharing is not supported on this browser</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {shareError && (
        <p className="text-destructive text-xs text-center">{shareError}</p>
      )}

      {/* Invoice Preview Card */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        {/* Invoice Header */}
        <div className="bg-primary px-5 py-4 flex items-start justify-between">
          <div>
            <p className="text-primary-foreground font-display font-bold text-base leading-tight">
              Reliable Home Appliance Repair
            </p>
            <p className="text-primary-foreground/70 text-xs mt-0.5">Professional Appliance Service</p>
          </div>
          <div className="text-right">
            <p className="text-primary-foreground font-bold text-xl">INVOICE</p>
            <p className="text-primary-foreground/70 text-xs">Job #{job.id.toString()}</p>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Client & Job Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-primary mb-1.5">Bill To</p>
              <p className="font-semibold text-sm text-foreground">{client.name}</p>
              {client.phone && <p className="text-xs text-muted-foreground mt-0.5">{client.phone}</p>}
              {client.email && <p className="text-xs text-muted-foreground">{client.email}</p>}
              {client.address && <p className="text-xs text-muted-foreground">{client.address}</p>}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-primary mb-1.5">Job Details</p>
              <p className="text-xs text-muted-foreground">Date: <span className="text-foreground font-medium">{formatJobDate(job.date)}</span></p>
              <div className="mt-1">
                <Badge
                  variant={job.status === Variant_open_complete_inProgress.complete ? 'default' : job.status === Variant_open_complete_inProgress.inProgress ? 'secondary' : 'destructive'}
                  className="text-xs"
                >
                  {statusLabel(job.status)}
                </Badge>
              </div>
              {job.maintenancePackage && (
                <p className="text-xs text-muted-foreground mt-1">
                  Package: <span className="text-foreground font-medium">{job.maintenancePackage}</span>
                </p>
              )}
            </div>
          </div>

          {/* Notes */}
          {job.notes && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-primary mb-1.5">Service Notes</p>
              <div className="bg-muted rounded-xl px-3 py-2.5">
                <p className="text-sm text-foreground whitespace-pre-wrap">{job.notes}</p>
              </div>
            </div>
          )}

          {/* Labor Rates */}
          {laborRates && laborRates.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-primary mb-1.5">Labor Rates</p>
              <div className="space-y-1.5">
                {laborRates.map((rate) => (
                  <div key={rate.id.toString()} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                    <span className="text-sm text-foreground">{rate.name}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {rate.rateType === 'hourly' ? 'Hourly' : 'Flat'}
                      </Badge>
                      <span className="text-sm font-semibold text-primary">
                        ${(Number(rate.amount) / 100).toFixed(2)}{rate.rateType === 'hourly' ? '/hr' : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Estimate Total */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-primary">Estimate Total</p>
              {job.stripePaymentId && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Payment ID: <span className="font-mono">{job.stripePaymentId}</span>
                </p>
              )}
            </div>
            <p className="text-2xl font-display font-bold text-primary">
              {job.estimate ? formatCurrency(job.estimate.amount) : 'Pending'}
            </p>
          </div>

          {/* Waiver */}
          {job.waiverType && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <AlertCircle size={12} />
              <span>Waiver signed: <span className="font-medium text-foreground capitalize">{job.waiverType}</span></span>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="pt-2 pb-4 text-center">
        <p className="text-muted-foreground text-xs">
          Built with ❤️ using{' '}
          <a
            href={`https://caffeine.ai/?utm_source=Caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary font-medium"
          >
            caffeine.ai
          </a>
          {' '}· © {new Date().getFullYear()} Reliable Home Appliance Repair LLC
        </p>
      </footer>
    </div>
  );
}
