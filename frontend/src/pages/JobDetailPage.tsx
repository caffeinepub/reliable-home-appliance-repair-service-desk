import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Plus, Trash2, FileText, Star, CreditCard, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useGetJob,
  useCreateJob,
  useUpdateJob,
  useDeleteJob,
  useListClients,
  useListJobs,
  useListLaborRates,
  useAddLaborLineItem,
  useRemoveLaborLineItem,
  useListParts,
  useIsStripeConfigured,
  useCreateCheckoutSession,
} from '../hooks/useQueries';
import { JobStatus, RateType, WaiverType } from '../backend';
import type { LaborLineItem } from '../backend';
import { useInternetIdentity } from '../hooks/useInternetIdentity';

const DEFAULT_GOOGLE_REVIEW_URL =
  'https://www.google.com/search?client=safari&hs=bqlU&sca_esv=477fbb8c9f03b619&hl=en-us&biw=393&bih=695&sxsrf=ANbL-n4RtO1QhvuqwZK_dXDG4LEsJQO68g:1772317989694&q=www.appliancerepairwalden.com+reviews&uds=ALYpb_kZB5BOMUFlRqxCQelgPO46flvNFV4llOp9FXmtgN0bFd_59aFqnzrv2lL_22fdcKjO_3pVePgz54Y0AhVY-GXqXefnH1qx8tFczBBdwApAdYXTD4RJ2fBkcTn2WMvET_C7noP7FDKpQdsny6qiyHWQVVEzt_rbESpi998me2Rg_kwCVEN74ocI_4XPNR22msLdpmHbL8GYbInBlVUBwAcIKp_O7ifZcZcIuUQQZROm0YQtZPTCZ3SVevvuwibzruurIRfjpjjybvX9x_eguP-hCuWxArDZZrO09vSYhCpocS_cwWMGzY0Rwgw8zjgH5WGiY2fHfDs2UCkdDDuktP48v8L24SA8xc5Ab-2pYFO3nVVnJjMPVJpHFf0r559CWqf2c7qmL2DlIq9LVmUhwLfYHaubp-qPmWjWko6lXf2oCXBA71Y3Lp6zVnH89YUnvqoKlmf1B2-nVHIk0CujdXTh7wl4QKF-8kTjNbCWi5TusYLAhMY&si=AL3DRZEsmMGCryMMFSHJ3StBhOdZ2-6yYkXd_doETEE1OR-qOR1dDOzNahzjiSdI7VdJYDnJGXelcQqzXSy0Yqcso2TsW1Ly5cwaMJIgfN94_biTlzTkpCdTbGgRuaEYR62-qzW3A8vAeLXPm0nS58Y2B2F8ZX0rKA%3D%3D&sa=X&ved=2ahUKEwiYrtGBn_2SAxVXE1kFHQkkMeYQk8gLegQIIhAB&ictx=1&stq=1&cs=0&lei=YG2jaeaXGK6l5NoPp7HaiAw#ebo=1';

export default function JobDetailPage() {
  const params = useParams({ strict: false }) as { jobId?: string };
  const jobId = params.jobId;
  const navigate = useNavigate();
  const { identity } = useInternetIdentity();
  const isNew = !jobId || jobId === 'new';

  const { data: job, isLoading: jobLoading } = useGetJob(isNew ? undefined : BigInt(jobId!));
  const { data: clients = [] } = useListClients();
  const { data: allJobs = [] } = useListJobs();
  const { data: laborRates = [] } = useListLaborRates();
  const { data: parts = [] } = useListParts();
  const { data: stripeConfigured } = useIsStripeConfigured();
  const createCheckoutSession = useCreateCheckoutSession();

  const createJob = useCreateJob();
  const updateJob = useUpdateJob();
  const deleteJob = useDeleteJob();
  const addLaborLineItem = useAddLaborLineItem();
  const removeLaborLineItem = useRemoveLaborLineItem();

  const [clientId, setClientId] = useState('');
  const [status, setStatus] = useState<JobStatus>(JobStatus.open);
  const [notes, setNotes] = useState('');
  const [waiverType, setWaiverType] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Labor line item form
  const [laborName, setLaborName] = useState('');
  const [laborDesc, setLaborDesc] = useState('');
  const [laborRateType, setLaborRateType] = useState<RateType>(RateType.hourly);
  const [laborRateAmount, setLaborRateAmount] = useState('');
  const [laborHours, setLaborHours] = useState('1');
  const [stripeError, setStripeError] = useState('');
  const [stripeLoading, setStripeLoading] = useState(false);

  useEffect(() => {
    if (job) {
      setClientId(job.clientId.toString());
      setStatus(job.status);
      setNotes(job.notes);
      setWaiverType(job.waiverType ?? '');
    }
  }, [job]);

  const getNextJobId = (): bigint => {
    if (!allJobs || allJobs.length === 0) return BigInt(1);
    const maxId = allJobs.reduce((max, j) => (j.id > max ? j.id : max), BigInt(0));
    return maxId + BigInt(1);
  };

  const handleSelectLaborRate = (rateId: string) => {
    const rate = laborRates.find(r => r.id.toString() === rateId);
    if (rate) {
      setLaborName(rate.name);
      setLaborRateType(rate.rateType);
      setLaborRateAmount((Number(rate.amount) / 100).toFixed(2));
    }
  };

  const handleSave = async () => {
    if (!clientId || !identity) return;
    setIsSaving(true);
    try {
      const principal = identity.getPrincipal();
      const waiverVal = waiverType && waiverType !== 'none'
        ? (waiverType as WaiverType)
        : undefined;
      const jobData = {
        id: isNew ? getNextJobId() : BigInt(jobId!),
        clientId: BigInt(clientId),
        tech: principal,
        date: isNew ? BigInt(Date.now() * 1_000_000) : job!.date,
        status,
        notes,
        photos: job?.photos ?? [],
        estimate: job?.estimate,
        waiverType: waiverVal,
        laborLineItems: job?.laborLineItems ?? [],
        stripePaymentId: job?.stripePaymentId,
      };
      if (isNew) {
        await createJob.mutateAsync(jobData as any);
      } else {
        await updateJob.mutateAsync(jobData as any);
      }
      navigate({ to: '/jobs' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!job) return;
    await deleteJob.mutateAsync(job.id);
    navigate({ to: '/jobs' });
  };

  const handleAddLaborItem = async () => {
    if (!job || !laborName || !laborRateAmount) return;
    const rateAmountCents = Math.round(parseFloat(laborRateAmount) * 100);
    const hours = parseFloat(laborHours) || 1;
    const totalAmount =
      laborRateType === RateType.hourly
        ? Math.round(rateAmountCents * hours)
        : rateAmountCents;
    const item: LaborLineItem = {
      name: laborName,
      description: laborDesc,
      rateType: laborRateType,
      rateAmount: BigInt(rateAmountCents),
      hours,
      totalAmount: BigInt(totalAmount),
    };
    await addLaborLineItem.mutateAsync({ jobId: job.id, item });
    setLaborName('');
    setLaborDesc('');
    setLaborRateAmount('');
    setLaborHours('1');
  };

  const handleRemoveLaborItem = async (index: number) => {
    if (!job) return;
    await removeLaborLineItem.mutateAsync({ jobId: job.id, index: BigInt(index) });
  };

  const handleStripeCharge = async () => {
    if (!job) return;
    setStripeError('');
    setStripeLoading(true);
    try {
      const laborSubtotal = job.laborLineItems.reduce(
        (sum, item) => sum + Number(item.totalAmount),
        0
      );
      const estimateAmount = job.estimate ? Number(job.estimate.amount) : 8500;
      const total = estimateAmount + laborSubtotal;
      const client = clients.find(c => c.id === job.clientId);
      const session = await createCheckoutSession.mutateAsync([
        {
          productName: `Job #${job.id.toString()} - ${client?.name ?? 'Customer'}`,
          productDescription: job.notes || 'Appliance Repair Service',
          currency: 'usd',
          quantity: BigInt(1),
          priceInCents: BigInt(total),
        },
      ]);
      if (!session?.url) throw new Error('Stripe session missing url');
      window.location.href = session.url;
    } catch (err: any) {
      setStripeError(err.message || 'Failed to create Stripe session');
    } finally {
      setStripeLoading(false);
    }
  };

  const handleRequestReview = () => {
    const client = clients.find(c => c.id === job?.clientId);
    const url = client?.googleReviewUrl || DEFAULT_GOOGLE_REVIEW_URL;
    window.open(url, '_blank');
  };

  if (!isNew && jobLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const jobParts = parts.filter(p => p.jobId !== undefined && p.jobId === job?.id);
  const laborSubtotal =
    job?.laborLineItems.reduce((sum, item) => sum + Number(item.totalAmount), 0) ?? 0;
  const estimateAmount = job?.estimate ? Number(job.estimate.amount) : 0;
  const grandTotal = estimateAmount + laborSubtotal;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: '/jobs' })}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-semibold text-foreground">{isNew ? 'New Job' : 'Edit Job'}</h1>
        <div className="flex gap-2">
          {!isNew && job?.status === JobStatus.complete && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRequestReview}
              title="Request Google Review"
            >
              <Star className="h-5 w-5 text-yellow-500" />
            </Button>
          )}
          {!isNew && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                navigate({ to: '/invoice/$jobId', params: { jobId: jobId! } })
              }
              title="View Invoice"
            >
              <FileText className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Basic Info */}
        <div className="bg-card rounded-xl border border-border p-4 space-y-4">
          <h2 className="font-semibold text-foreground">Job Information</h2>

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1 block">Client</label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map(c => (
                  <SelectItem key={c.id.toString()} value={c.id.toString()}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1 block">Status</label>
            <Select value={status} onValueChange={v => setStatus(v as JobStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={JobStatus.open}>Open</SelectItem>
                <SelectItem value={JobStatus.inProgress}>In Progress</SelectItem>
                <SelectItem value={JobStatus.complete}>Complete</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1 block">
              Waiver Type
            </label>
            <Select value={waiverType} onValueChange={setWaiverType}>
              <SelectTrigger>
                <SelectValue placeholder="Select waiver type (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value={WaiverType.general}>General</SelectItem>
                <SelectItem value={WaiverType.preexisting}>Pre-existing</SelectItem>
                <SelectItem value={WaiverType.potential}>Potential</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1 block">Notes</label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Job notes..."
              rows={3}
            />
          </div>
        </div>

        {/* Labor Line Items */}
        {!isNew && (
          <div className="bg-card rounded-xl border border-border p-4 space-y-4">
            <h2 className="font-semibold text-foreground">Labor</h2>

            {job?.laborLineItems && job.laborLineItems.length > 0 && (
              <div className="space-y-2">
                {job.laborLineItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.rateType === RateType.hourly
                          ? `${item.hours}h × $${(Number(item.rateAmount) / 100).toFixed(2)}/hr`
                          : `Flat: $${(Number(item.rateAmount) / 100).toFixed(2)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        ${(Number(item.totalAmount) / 100).toFixed(2)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => handleRemoveLaborItem(idx)}
                        disabled={removeLaborLineItem.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add Labor Form */}
            <div className="space-y-3 border-t border-border pt-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Add Labor Item
              </p>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Quick-fill from rate
                </label>
                <Select onValueChange={handleSelectLaborRate}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Select a labor rate..." />
                  </SelectTrigger>
                  <SelectContent>
                    {laborRates.map(r => (
                      <SelectItem key={r.id.toString()} value={r.id.toString()}>
                        {r.name} — ${(Number(r.amount) / 100).toFixed(2)}/
                        {r.rateType === RateType.hourly ? 'hr' : 'flat'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Name"
                  value={laborName}
                  onChange={e => setLaborName(e.target.value)}
                  className="h-8 text-sm"
                />
                <Select
                  value={laborRateType}
                  onValueChange={v => setLaborRateType(v as RateType)}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={RateType.hourly}>Hourly</SelectItem>
                    <SelectItem value={RateType.flat}>Flat</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Rate ($)"
                  value={laborRateAmount}
                  onChange={e => setLaborRateAmount(e.target.value)}
                  type="number"
                  min="0"
                  step="0.01"
                  className="h-8 text-sm"
                />
                {laborRateType === RateType.hourly && (
                  <Input
                    placeholder="Hours"
                    value={laborHours}
                    onChange={e => setLaborHours(e.target.value)}
                    type="number"
                    min="0"
                    step="0.5"
                    className="h-8 text-sm"
                  />
                )}
              </div>
              <Input
                placeholder="Description (optional)"
                value={laborDesc}
                onChange={e => setLaborDesc(e.target.value)}
                className="h-8 text-sm"
              />
              <Button
                size="sm"
                onClick={handleAddLaborItem}
                disabled={!laborName || !laborRateAmount || addLaborLineItem.isPending}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-1" />
                {addLaborLineItem.isPending ? 'Adding...' : 'Add Labor Item'}
              </Button>
            </div>
          </div>
        )}

        {/* Parts Used */}
        {!isNew && jobParts.length > 0 && (
          <div className="bg-card rounded-xl border border-border p-4 space-y-3">
            <h2 className="font-semibold text-foreground">Parts Used</h2>
            {jobParts.map(part => (
              <div
                key={part.id.toString()}
                className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{part.name}</p>
                  <p className="text-xs text-muted-foreground">#{part.partNumber}</p>
                </div>
                <span className="text-sm font-semibold text-foreground">
                  ${(Number(part.unitCost) / 100).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Payment Section */}
        {!isNew && (
          <div className="bg-card rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-foreground">Payment</h2>
              {job?.stripePaymentId ? (
                <Badge className="bg-green-100 text-green-700 border-green-200">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Paid
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  <XCircle className="h-3 w-3 mr-1" />
                  Unpaid
                </Badge>
              )}
            </div>

            {/* Cost Summary */}
            <div className="bg-muted/30 rounded-lg p-3 space-y-1 text-sm">
              {estimateAmount > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Diagnostic Fee</span>
                  <span>${(estimateAmount / 100).toFixed(2)}</span>
                </div>
              )}
              {laborSubtotal > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Labor</span>
                  <span>${(laborSubtotal / 100).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-foreground border-t border-border pt-1 mt-1">
                <span>Total</span>
                <span>${(grandTotal / 100).toFixed(2)}</span>
              </div>
            </div>

            {!job?.stripePaymentId && (
              <>
                {stripeConfigured ? (
                  <Button
                    className="w-full"
                    onClick={handleStripeCharge}
                    disabled={stripeLoading || grandTotal === 0}
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    {stripeLoading
                      ? 'Redirecting to Stripe...'
                      : `Charge $${(grandTotal / 100).toFixed(2)} via Stripe`}
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground text-center">
                    Configure Stripe in Settings to enable payments.
                  </p>
                )}
                {stripeError && (
                  <p className="text-xs text-destructive">{stripeError}</p>
                )}
              </>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button
            className="w-full"
            onClick={handleSave}
            disabled={isSaving || !clientId}
          >
            {isSaving ? 'Saving...' : isNew ? 'Create Job' : 'Save Changes'}
          </Button>

          {!isNew && (
            <>
              {showDeleteConfirm ? (
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={handleDelete}
                    disabled={deleteJob.isPending}
                  >
                    {deleteJob.isPending ? 'Deleting...' : 'Confirm Delete'}
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowDeleteConfirm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  Delete Job
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
