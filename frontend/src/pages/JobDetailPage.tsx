import { useState, useEffect } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Trash2, Camera, X, Calendar, Clock, ChevronDown, ChevronUp, CreditCard, FileText, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGetJob, useCreateJob, useUpdateJob, useListClients, useListParts, useListLaborRates, useUpdateJobPayment, useUpdateDamageWaiver } from '@/hooks/useQueries';
import { useActor } from '@/hooks/useActor';
import { useInternetIdentity } from '@/hooks/useInternetIdentity';
import { ExternalBlob, JobStatus, RateType, type Job, type LaborLineItem } from '@/backend';

const DEFAULT_WAIVER_TEXT =
  'I acknowledge that pre-existing damage, cosmetic issues, or conditions not caused by the repair technician are not the responsibility of Reliable Home Appliance Repair LLC. By signing below, I agree to these terms.';

const TIME_WINDOWS = [
  { label: '8 AM – 10 AM', start: 8, end: 10 },
  { label: '10 AM – 12 PM', start: 10, end: 12 },
  { label: '12 PM – 2 PM', start: 12, end: 14 },
  { label: '2 PM – 4 PM', start: 14, end: 16 },
  { label: '4 PM – 6 PM', start: 16, end: 18 },
  { label: '6 PM – 8 PM', start: 18, end: 20 },
];

export default function JobDetailPage() {
  const { jobId } = useParams({ strict: false }) as { jobId?: string };
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { actor } = useActor();
  const { identity } = useInternetIdentity();
  const isNew = !jobId || jobId === 'new';

  const { data: job, isLoading: jobLoading } = useGetJob(isNew ? null : Number(jobId));
  const { data: clients = [] } = useListClients();
  const { data: parts = [] } = useListParts();
  const { data: laborRates = [] } = useListLaborRates();
  const createJob = useCreateJob();
  const updateJob = useUpdateJob();
  const updateJobPayment = useUpdateJobPayment();
  const updateDamageWaiverMutation = useUpdateDamageWaiver();

  const [clientId, setClientId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState<JobStatus>(JobStatus.open);
  const [notes, setNotes] = useState('');
  const [laborItems, setLaborItems] = useState<LaborLineItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Calendar scheduling
  const [scheduledDate, setScheduledDate] = useState('');
  const [selectedWindow, setSelectedWindow] = useState('');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [showCalendar, setShowCalendar] = useState(false);

  // Stripe
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeError, setStripeError] = useState('');

  // Damage waiver
  const [waiverEnabled, setWaiverEnabled] = useState(false);
  const [waiverText, setWaiverText] = useState(DEFAULT_WAIVER_TEXT);
  const [waiverSaving, setWaiverSaving] = useState(false);

  useEffect(() => {
    if (job) {
      setClientId(String(job.clientId));
      setDate(new Date(Number(job.date) / 1_000_000).toISOString().split('T')[0]);
      setStatus(job.status);
      setNotes(job.notes);
      setLaborItems(job.laborLineItems || []);
      if (job.damageWaiver) {
        setWaiverEnabled(job.damageWaiver.enabled);
        setWaiverText(job.damageWaiver.waiverText || DEFAULT_WAIVER_TEXT);
      }
      if (job.scheduledStart) {
        const d = new Date(Number(job.scheduledStart) / 1_000_000);
        setScheduledDate(d.toISOString().split('T')[0]);
      }
    }
  }, [job]);

  const getJobParts = () => parts.filter(p => p.jobId === BigInt(jobId || 0));

  const calcLaborTotal = () =>
    laborItems.reduce((sum, item) => sum + Number(item.totalAmount), 0);

  const calcPartsTotal = () =>
    getJobParts().reduce((sum, p) => sum + Number(p.unitCost), 0);

  const calcSubtotal = () => calcLaborTotal() + calcPartsTotal();
  const calcTax = () => Math.round(calcSubtotal() * 0.08875);
  const calcTotal = () => calcSubtotal() + calcTax();

  const addLaborItem = () => {
    const rate = laborRates[0];
    const newItem: LaborLineItem = {
      name: rate ? rate.name : 'Labor',
      rateType: rate ? rate.rateType : RateType.hourly,
      hours: 1,
      rateAmount: rate ? rate.amount : BigInt(0),
      description: '',
      totalAmount: rate ? rate.amount : BigInt(0),
    };
    setLaborItems([...laborItems, newItem]);
  };

  const updateLaborItem = (index: number, field: keyof LaborLineItem, value: unknown) => {
    const updated = [...laborItems];
    updated[index] = { ...updated[index], [field]: value };
    // Recalculate total
    const item = updated[index];
    if (item.rateType === RateType.hourly) {
      updated[index].totalAmount = BigInt(Math.round(item.hours * Number(item.rateAmount)));
    } else {
      updated[index].totalAmount = item.rateAmount;
    }
    setLaborItems(updated);
  };

  const removeLaborItem = (index: number) => {
    setLaborItems(laborItems.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!actor || !identity) return;
    if (!clientId) { setError('Please select a client'); return; }
    setError('');
    setSaving(true);
    try {
      const dateMs = new Date(date).getTime();
      const dateNs = BigInt(dateMs) * BigInt(1_000_000);

      let scheduledStartNs: bigint | null = null;
      let scheduledEndNs: bigint | null = null;

      if (scheduledDate) {
        const baseDate = new Date(scheduledDate);
        if (selectedWindow && selectedWindow !== 'custom') {
          const win = TIME_WINDOWS.find(w => w.label === selectedWindow);
          if (win) {
            const start = new Date(baseDate);
            start.setHours(win.start, 0, 0, 0);
            const end = new Date(baseDate);
            end.setHours(win.end, 0, 0, 0);
            scheduledStartNs = BigInt(start.getTime()) * BigInt(1_000_000);
            scheduledEndNs = BigInt(end.getTime()) * BigInt(1_000_000);
          }
        } else if (selectedWindow === 'custom' && customStart && customEnd) {
          const [sh, sm] = customStart.split(':').map(Number);
          const [eh, em] = customEnd.split(':').map(Number);
          const start = new Date(baseDate);
          start.setHours(sh, sm, 0, 0);
          const end = new Date(baseDate);
          end.setHours(eh, em, 0, 0);
          scheduledStartNs = BigInt(start.getTime()) * BigInt(1_000_000);
          scheduledEndNs = BigInt(end.getTime()) * BigInt(1_000_000);
        }
      }

      const jobData: Job = {
        id: isNew ? BigInt(Date.now()) : BigInt(jobId!),
        clientId: BigInt(clientId),
        tech: identity.getPrincipal(),
        date: dateNs,
        status,
        notes,
        photos: job?.photos || [],
        estimate: job?.estimate,
        waiverType: job?.waiverType,
        laborLineItems: laborItems,
        stripePaymentId: job?.stripePaymentId,
        scheduledStart: scheduledStartNs ?? undefined,
        scheduledEnd: scheduledEndNs ?? undefined,
        damageWaiver: { enabled: waiverEnabled, waiverText },
      };

      if (isNew) {
        await createJob.mutateAsync(jobData);
      } else {
        await updateJob.mutateAsync(jobData);
      }
      navigate({ to: '/jobs' });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save job');
    } finally {
      setSaving(false);
    }
  };

  const handleStripeCharge = async () => {
    if (!actor || !job) return;
    setStripeLoading(true);
    setStripeError('');
    try {
      const amountCents = BigInt(Math.round(calcTotal()));
      const result = await actor.createPaymentIntent(job.id, amountCents);
      const parsed = JSON.parse(result);
      if (parsed?.id) {
        await updateJobPayment.mutateAsync({ jobId: Number(job.id), paymentIntentId: parsed.id });
        queryClient.invalidateQueries({ queryKey: ['job', Number(jobId)] });
      }
    } catch (e: unknown) {
      setStripeError(e instanceof Error ? e.message : 'Payment failed');
    } finally {
      setStripeLoading(false);
    }
  };

  const handleWaiverToggle = async (enabled: boolean) => {
    setWaiverEnabled(enabled);
    if (!isNew && jobId && actor) {
      setWaiverSaving(true);
      try {
        await updateDamageWaiverMutation.mutateAsync({
          jobId: Number(jobId),
          waiver: { enabled, waiverText },
        });
      } catch {
        // silently fail, will be saved on main save
      } finally {
        setWaiverSaving(false);
      }
    }
  };

  const handleWaiverTextChange = async (text: string) => {
    setWaiverText(text);
  };

  const handleWaiverTextBlur = async () => {
    if (!isNew && jobId && actor) {
      setWaiverSaving(true);
      try {
        await updateDamageWaiverMutation.mutateAsync({
          jobId: Number(jobId),
          waiver: { enabled: waiverEnabled, waiverText },
        });
      } catch {
        // silently fail
      } finally {
        setWaiverSaving(false);
      }
    }
  };

  if (!isNew && jobLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const isPaid = !!job?.stripePaymentId;
  const jobPartsForDisplay = getJobParts();

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: '/jobs' })}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold font-rajdhani">
          {isNew ? 'New Job' : `Job #${jobId}`}
        </h1>
        {!isNew && (
          <Badge variant={isPaid ? 'default' : 'outline'} className="ml-auto">
            {isPaid ? 'Paid' : 'Unpaid'}
          </Badge>
        )}
      </div>

      <div className="px-4 py-4 space-y-5 max-w-2xl mx-auto">
        {error && (
          <div className="bg-destructive/10 text-destructive text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {/* Client & Date */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Job Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Client</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select client…" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(c => (
                    <SelectItem key={String(c.id)} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={v => setStatus(v as JobStatus)}>
                <SelectTrigger className="mt-1">
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
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Job notes…"
                className="mt-1"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Calendar Scheduling */}
        <Card>
          <CardHeader className="pb-3">
            <button
              className="flex items-center justify-between w-full text-left"
              onClick={() => setShowCalendar(!showCalendar)}
            >
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Schedule Appointment
              </CardTitle>
              {showCalendar ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </CardHeader>
          {showCalendar && (
            <CardContent className="space-y-4">
              <div>
                <Label>Appointment Date</Label>
                <Input
                  type="date"
                  value={scheduledDate}
                  onChange={e => setScheduledDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Time Window</Label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {TIME_WINDOWS.map(w => (
                    <button
                      key={w.label}
                      onClick={() => setSelectedWindow(w.label)}
                      className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
                        selectedWindow === w.label
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border hover:bg-muted'
                      }`}
                    >
                      <Clock className="h-3 w-3 inline mr-1" />
                      {w.label}
                    </button>
                  ))}
                  <button
                    onClick={() => setSelectedWindow('custom')}
                    className={`px-3 py-2 rounded-lg text-sm border transition-colors col-span-2 ${
                      selectedWindow === 'custom'
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    Custom Time
                  </button>
                </div>
              </div>
              {selectedWindow === 'custom' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Start Time</Label>
                    <Input type="time" value={customStart} onChange={e => setCustomStart(e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label>End Time</Label>
                    <Input type="time" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="mt-1" />
                  </div>
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {/* Labor Line Items */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Labor</CardTitle>
              <Button variant="outline" size="sm" onClick={addLaborItem}>
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {laborItems.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">No labor items yet</p>
            )}
            {laborItems.map((item, idx) => (
              <div key={idx} className="border border-border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Input
                    value={item.name}
                    onChange={e => updateLaborItem(idx, 'name', e.target.value)}
                    placeholder="Labor name"
                    className="text-sm h-8 flex-1 mr-2"
                  />
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeLaborItem(idx)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">Type</Label>
                    <Select
                      value={item.rateType}
                      onValueChange={v => updateLaborItem(idx, 'rateType', v as RateType)}
                    >
                      <SelectTrigger className="h-8 text-xs mt-0.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={RateType.hourly}>Hourly</SelectItem>
                        <SelectItem value={RateType.flat}>Flat</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {item.rateType === RateType.hourly && (
                    <div>
                      <Label className="text-xs">Hours</Label>
                      <Input
                        type="number"
                        value={item.hours}
                        onChange={e => updateLaborItem(idx, 'hours', parseFloat(e.target.value) || 0)}
                        className="h-8 text-xs mt-0.5"
                        step="0.5"
                        min="0"
                      />
                    </div>
                  )}
                  <div>
                    <Label className="text-xs">Rate ($)</Label>
                    <Input
                      type="number"
                      value={Number(item.rateAmount)}
                      onChange={e => updateLaborItem(idx, 'rateAmount', BigInt(Math.round(parseFloat(e.target.value) || 0)))}
                      className="h-8 text-xs mt-0.5"
                      min="0"
                    />
                  </div>
                </div>
                <div className="text-right text-sm font-medium text-primary">
                  Total: ${Number(item.totalAmount).toFixed(2)}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Parts */}
        {!isNew && jobPartsForDisplay.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Parts Used</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {jobPartsForDisplay.map(p => (
                  <div key={String(p.id)} className="flex justify-between text-sm">
                    <span>{p.name}</span>
                    <span className="font-medium">${Number(p.unitCost).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Totals */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Totals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Labor</span>
              <span>${calcLaborTotal().toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Parts</span>
              <span>${calcPartsTotal().toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax (8.875%)</span>
              <span>${(calcTax() / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-semibold text-base border-t border-border pt-2 mt-2">
              <span>Total</span>
              <span>${(calcTotal() / 100).toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Damage Waiver — Job-level option */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Damage Waiver
              </CardTitle>
              <div className="flex items-center gap-2">
                {waiverSaving && <span className="text-xs text-muted-foreground">Saving…</span>}
                <Switch
                  checked={waiverEnabled}
                  onCheckedChange={handleWaiverToggle}
                />
              </div>
            </div>
          </CardHeader>
          {waiverEnabled && (
            <CardContent>
              <Label className="text-xs text-muted-foreground mb-1 block">
                Waiver text (editable — will appear on estimate for client signature)
              </Label>
              <Textarea
                value={waiverText}
                onChange={e => handleWaiverTextChange(e.target.value)}
                onBlur={handleWaiverTextBlur}
                rows={4}
                className="text-sm"
              />
            </CardContent>
          )}
        </Card>

        {/* Stripe Payment */}
        {!isNew && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Payment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <Badge variant={isPaid ? 'default' : 'outline'}>
                  {isPaid ? 'Paid' : 'Unpaid'}
                </Badge>
                {isPaid && (
                  <span className="text-xs text-muted-foreground font-mono truncate max-w-[200px]">
                    {job?.stripePaymentId}
                  </span>
                )}
              </div>
              {!isPaid && (
                <Button
                  onClick={handleStripeCharge}
                  disabled={stripeLoading}
                  className="w-full"
                >
                  {stripeLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      Processing…
                    </span>
                  ) : (
                    'Charge via Stripe'
                  )}
                </Button>
              )}
              {stripeError && (
                <p className="text-xs text-destructive">{stripeError}</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Generate Estimate */}
        {!isNew && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate({ to: `/jobs/${jobId}/invoice` })}
          >
            <FileText className="h-4 w-4 mr-2" />
            Generate Estimate / Invoice
          </Button>
        )}

        {/* Save */}
        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              Saving…
            </span>
          ) : (
            isNew ? 'Create Job' : 'Save Changes'
          )}
        </Button>
      </div>
    </div>
  );
}
