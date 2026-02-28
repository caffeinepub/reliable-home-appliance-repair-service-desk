import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useActor } from '../hooks/useActor';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { Job, JobStatus, LaborLineItem, RateType, ExternalBlob, ShoppingItem } from '../backend';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Plus, Trash2, Camera, FileText, CreditCard, Loader2, X, Image } from 'lucide-react';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function centsToDisplay(cents: bigint): string {
  return `$${(Number(cents) / 100).toFixed(2)}`;
}

// ─── Local hooks ────────────────────────────────────────────────────────────

function useGetJob(jobId: bigint | null) {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ['job', jobId?.toString()],
    queryFn: async () => {
      if (!actor || jobId === null) return null;
      return actor.getJob(jobId);
    },
    enabled: !!actor && !isFetching && jobId !== null,
  });
}

function useListClients() {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listClients();
    },
    enabled: !!actor && !isFetching,
  });
}

function useListParts() {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ['parts'],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listParts();
    },
    enabled: !!actor && !isFetching,
  });
}

function useListJobs() {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ['jobs'],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listJobs();
    },
    enabled: !!actor && !isFetching,
  });
}

function useGetCallerProfile() {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ['callerProfile'],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getCallerUserProfile();
    },
    enabled: !!actor && !isFetching,
  });
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function JobDetailPage() {
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { jobId?: string };
  const jobId = params.jobId && params.jobId !== 'new' ? BigInt(params.jobId) : null;
  const isNew = !jobId;

  const { actor } = useActor();
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();

  const { data: job, isLoading: jobLoading } = useGetJob(jobId);
  const { data: clients = [] } = useListClients();
  const { data: allParts = [] } = useListParts();
  const { data: allJobs = [] } = useListJobs();
  const { data: callerProfile } = useGetCallerProfile();

  // ── Form state ──
  const [clientId, setClientId] = useState<string>('');
  const [status, setStatus] = useState<JobStatus>(JobStatus.open);
  const [notes, setNotes] = useState('');
  const [taxRate, setTaxRate] = useState<number>(8.875);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Labor form state ──
  const [laborName, setLaborName] = useState('');
  const [laborType, setLaborType] = useState<'hourly' | 'flat'>('flat');
  const [laborHours, setLaborHours] = useState('');
  const [laborRate, setLaborRate] = useState('');
  const [laborDesc, setLaborDesc] = useState('');
  const [addingLabor, setAddingLabor] = useState(false);
  const [removingLaborIdx, setRemovingLaborIdx] = useState<number | null>(null);

  // ── Parts state ──
  const [selectedPartId, setSelectedPartId] = useState<string>('');
  const [partQty, setPartQty] = useState('1');
  const [addingPart, setAddingPart] = useState(false);

  // ── Photos state ──
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [removingPhotoIdx, setRemovingPhotoIdx] = useState<number | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // ── Stripe state ──
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeError, setStripeError] = useState<string | null>(null);

  // ── Populate form when job loads ──
  useEffect(() => {
    if (job) {
      setClientId(job.clientId.toString());
      setStatus(job.status);
      setNotes(job.notes);
    }
  }, [job]);

  // ── Derived values ──
  const jobParts = allParts.filter(
    p => p.jobId !== undefined && p.jobId !== null && job && p.jobId === job.id
  );
  const partsSubtotal = jobParts.reduce((sum, p) => sum + Number(p.unitCost), 0);
  const laborItems = job?.laborLineItems || [];
  const laborSubtotal = laborItems.reduce((sum, l) => sum + Number(l.totalAmount), 0);
  const subtotal = partsSubtotal + laborSubtotal;
  const taxAmount = subtotal * (taxRate / 100);
  const totalAmount = subtotal + taxAmount;

  const selectedClient = clients.find(c => c.id.toString() === clientId);
  const availableParts = allParts.filter(p => Number(p.quantityOnHand) > 0 && !p.jobId);

  // ── Save job ──
  const handleSave = async () => {
    if (!actor || !identity) return;
    if (!clientId) { setSaveError('Please select a client'); return; }
    setSaving(true);
    setSaveError(null);
    try {
      const newId = isNew
        ? BigInt(allJobs.length > 0 ? Math.max(...allJobs.map(j => Number(j.id))) + 1 : 1)
        : jobId!;

      const jobData: Job = {
        id: newId,
        clientId: BigInt(clientId),
        tech: identity.getPrincipal(),
        date: isNew
          ? BigInt(Date.now()) * BigInt(1_000_000)
          : (job?.date ?? BigInt(Date.now()) * BigInt(1_000_000)),
        status,
        notes,
        photos: job?.photos || [],
        estimate: job?.estimate,
        waiverType: job?.waiverType,
        laborLineItems: job?.laborLineItems || [],
        stripePaymentId: job?.stripePaymentId,
      };

      if (isNew) {
        await actor.createJob(jobData);
      } else {
        await actor.updateJob(jobData);
      }
      await queryClient.invalidateQueries({ queryKey: ['jobs'] });
      await queryClient.invalidateQueries({ queryKey: ['job', newId.toString()] });
      if (isNew) {
        navigate({ to: '/jobs/$jobId', params: { jobId: newId.toString() } });
      }
    } catch (e: any) {
      setSaveError(e?.message || 'Failed to save job');
    } finally {
      setSaving(false);
    }
  };

  // ── Add labor ──
  const handleAddLabor = async () => {
    if (!actor || !jobId || !laborName.trim() || !laborRate.trim()) return;
    setAddingLabor(true);
    try {
      const rateAmountCents = Math.round(parseFloat(laborRate) * 100);
      const hours = laborType === 'hourly' ? parseFloat(laborHours) || 0 : 0;
      const totalCents =
        laborType === 'hourly'
          ? Math.round(hours * rateAmountCents)
          : rateAmountCents;

      const item: LaborLineItem = {
        name: laborName.trim(),
        rateType: laborType === 'hourly' ? RateType.hourly : RateType.flat,
        hours,
        rateAmount: BigInt(rateAmountCents),
        description: laborDesc.trim(),
        totalAmount: BigInt(totalCents),
      };
      await actor.addLaborLineItem(jobId, item);
      await queryClient.invalidateQueries({ queryKey: ['job', jobId.toString()] });
      setLaborName('');
      setLaborType('flat');
      setLaborHours('');
      setLaborRate('');
      setLaborDesc('');
    } catch (e: any) {
      console.error('Failed to add labor:', e);
    } finally {
      setAddingLabor(false);
    }
  };

  // ── Remove labor ──
  const handleRemoveLabor = async (index: number) => {
    if (!actor || !jobId) return;
    setRemovingLaborIdx(index);
    try {
      await actor.removeLaborLineItem(jobId, BigInt(index));
      await queryClient.invalidateQueries({ queryKey: ['job', jobId.toString()] });
    } catch (e: any) {
      console.error('Failed to remove labor:', e);
    } finally {
      setRemovingLaborIdx(null);
    }
  };

  // ── Add part to job ──
  const handleAddPart = async () => {
    if (!actor || !jobId || !selectedPartId) return;
    setAddingPart(true);
    try {
      await actor.usePartOnJob(BigInt(selectedPartId), jobId, BigInt(parseInt(partQty) || 1));
      await queryClient.invalidateQueries({ queryKey: ['parts'] });
      await queryClient.invalidateQueries({ queryKey: ['job', jobId.toString()] });
      setSelectedPartId('');
      setPartQty('1');
    } catch (e: any) {
      console.error('Failed to add part:', e);
    } finally {
      setAddingPart(false);
    }
  };

  // ── Upload photo ──
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!actor || !jobId || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    setUploadingPhoto(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const blob = ExternalBlob.fromBytes(bytes);
      await actor.addJobPhoto(jobId, blob);
      await queryClient.invalidateQueries({ queryKey: ['job', jobId.toString()] });
    } catch (e: any) {
      console.error('Failed to upload photo:', e);
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  // ── Remove photo ──
  const handleRemovePhoto = async (index: number) => {
    if (!actor || !jobId) return;
    setRemovingPhotoIdx(index);
    try {
      await actor.removeJobPhoto(jobId, BigInt(index));
      await queryClient.invalidateQueries({ queryKey: ['job', jobId.toString()] });
    } catch (e: any) {
      console.error('Failed to remove photo:', e);
    } finally {
      setRemovingPhotoIdx(null);
    }
  };

  // ── Stripe checkout ──
  const handleStripeCheckout = async () => {
    if (!actor || !jobId) return;
    setStripeLoading(true);
    setStripeError(null);
    try {
      const totalCents = Math.round(totalAmount);
      const items: ShoppingItem[] = [
        {
          productName: `Job #${jobId} - ${selectedClient?.name || 'Service'}`,
          productDescription: notes || 'Appliance repair service',
          currency: 'usd',
          quantity: BigInt(1),
          priceInCents: BigInt(totalCents),
        },
      ];
      const baseUrl = `${window.location.protocol}//${window.location.host}`;
      const result = await actor.createCheckoutSession(
        items,
        `${baseUrl}/payment-success`,
        `${baseUrl}/payment-failure`
      );
      const session = JSON.parse(result);
      if (!session?.url) throw new Error('Stripe session missing url');
      window.location.href = session.url;
    } catch (e: any) {
      setStripeError(e?.message || 'Failed to create checkout session');
    } finally {
      setStripeLoading(false);
    }
  };

  // ── Navigate to invoice ──
  const handleViewInvoice = () => {
    if (!jobId) return;
    navigate({
      to: '/invoice/$jobId',
      params: { jobId: jobId.toString() },
      search: { taxRate: taxRate.toString() },
    });
  };

  if (jobLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: '/jobs' })}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Jobs
        </Button>
        <h1 className="font-semibold text-foreground">
          {isNew ? 'New Job' : `Job #${jobId}`}
        </h1>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
          {isNew ? 'Create' : 'Save'}
        </Button>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {saveError && (
          <div className="bg-destructive/10 text-destructive text-sm rounded-lg px-4 py-3">
            {saveError}
          </div>
        )}

        {/* ── Job Info ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Job Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>Client *</Label>
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

            <div className="space-y-1">
              <Label>Status</Label>
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

            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Describe the job, appliance, issue..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* ── Parts from Inventory ── */}
        {!isNew && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Parts from Inventory</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {jobParts.length > 0 && (
                <div className="space-y-2">
                  {jobParts.map(part => (
                    <div
                      key={part.id.toString()}
                      className="flex items-center justify-between bg-muted/40 rounded-lg px-3 py-2 text-sm"
                    >
                      <div>
                        <span className="font-medium">{part.name}</span>
                        {part.partNumber && (
                          <span className="text-muted-foreground ml-2">#{part.partNumber}</span>
                        )}
                      </div>
                      <span className="font-semibold">{centsToDisplay(part.unitCost)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-semibold pt-1 border-t border-border">
                    <span>Parts Subtotal</span>
                    <span>{formatCents(partsSubtotal)}</span>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Select value={selectedPartId} onValueChange={setSelectedPartId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select part from inventory" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableParts.map(p => (
                      <SelectItem key={p.id.toString()} value={p.id.toString()}>
                        {p.name} — {centsToDisplay(p.unitCost)} (qty:{' '}
                        {p.quantityOnHand.toString()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min="1"
                  value={partQty}
                  onChange={e => setPartQty(e.target.value)}
                  className="w-16"
                  placeholder="Qty"
                />
                <Button size="sm" onClick={handleAddPart} disabled={addingPart || !selectedPartId}>
                  {addingPart ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Labor ── */}
        {!isNew && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Labor</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {laborItems.length > 0 && (
                <div className="space-y-2">
                  {laborItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-muted/40 rounded-lg px-3 py-2 text-sm"
                    >
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">{item.name}</span>
                        {item.description && (
                          <span className="text-muted-foreground ml-2 text-xs">
                            {item.description}
                          </span>
                        )}
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {item.rateType === RateType.hourly
                            ? `${item.hours}h × ${centsToDisplay(item.rateAmount)}/hr`
                            : 'Flat rate'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        <span className="font-semibold">{centsToDisplay(item.totalAmount)}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleRemoveLabor(idx)}
                          disabled={removingLaborIdx === idx}
                        >
                          {removingLaborIdx === idx ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Trash2 className="w-3 h-3" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-semibold pt-1 border-t border-border">
                    <span>Labor Subtotal</span>
                    <span>{formatCents(laborSubtotal)}</span>
                  </div>
                </div>
              )}

              {/* Add labor form */}
              <div className="border border-border rounded-lg p-3 space-y-3 bg-muted/20">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Add Labor
                </p>

                <div className="space-y-1">
                  <Label className="text-xs">Description *</Label>
                  <Input
                    value={laborName}
                    onChange={e => setLaborName(e.target.value)}
                    placeholder="e.g. Diagnostic, Compressor replacement..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Type</Label>
                    <Select
                      value={laborType}
                      onValueChange={v => setLaborType(v as 'hourly' | 'flat')}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="flat">Flat Rate</SelectItem>
                        <SelectItem value="hourly">Hourly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">
                      {laborType === 'hourly' ? 'Rate ($/hr)' : 'Amount ($)'}
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={laborRate}
                      onChange={e => setLaborRate(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {laborType === 'hourly' && (
                  <div className="space-y-1">
                    <Label className="text-xs">Hours</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.25"
                      value={laborHours}
                      onChange={e => setLaborHours(e.target.value)}
                      placeholder="0.0"
                    />
                  </div>
                )}

                {laborRate && (
                  <div className="text-sm text-muted-foreground">
                    Line total:{' '}
                    <span className="font-semibold text-foreground">
                      {laborType === 'hourly'
                        ? formatCents(
                            Math.round(
                              (parseFloat(laborHours) || 0) * parseFloat(laborRate) * 100
                            )
                          )
                        : formatCents(Math.round(parseFloat(laborRate) * 100))}
                    </span>
                  </div>
                )}

                <div className="space-y-1">
                  <Label className="text-xs">Notes (optional)</Label>
                  <Input
                    value={laborDesc}
                    onChange={e => setLaborDesc(e.target.value)}
                    placeholder="Additional details..."
                  />
                </div>

                <Button
                  size="sm"
                  onClick={handleAddLabor}
                  disabled={addingLabor || !laborName.trim() || !laborRate.trim()}
                  className="w-full"
                >
                  {addingLabor ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  Add Labor Line
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Tax & Totals ── */}
        {!isNew && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tax &amp; Total</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <Label className="w-28 shrink-0">Tax Rate (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.001"
                  value={taxRate}
                  onChange={e => setTaxRate(parseFloat(e.target.value) || 0)}
                  className="w-32"
                />
              </div>
              <Separator />
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Parts Subtotal</span>
                  <span>{formatCents(partsSubtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Labor Subtotal</span>
                  <span>{formatCents(laborSubtotal)}</span>
                </div>
                <div className="flex justify-between font-medium border-t border-border pt-1 mt-1">
                  <span>Subtotal</span>
                  <span>{formatCents(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax ({taxRate}%)</span>
                  <span>{formatCents(Math.round(taxAmount))}</span>
                </div>
                <div className="flex justify-between text-base font-bold text-primary border-t-2 border-primary pt-2 mt-1">
                  <span>Total</span>
                  <span>{formatCents(Math.round(totalAmount))}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Photos ── */}
        {!isNew && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Image className="w-4 h-4" />
                Photos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {job?.photos && job.photos.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {job.photos.map((photo, idx) => (
                    <div
                      key={idx}
                      className="relative group aspect-square rounded-lg overflow-hidden bg-muted"
                    >
                      <img
                        src={photo.getDirectURL()}
                        alt={`Job photo ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => handleRemovePhoto(idx)}
                        disabled={removingPhotoIdx === idx}
                        className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        {removingPhotoIdx === idx ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <X className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handlePhotoUpload}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => photoInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="w-full"
              >
                {uploadingPhoto ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4 mr-2" />
                    Take Photo / Upload
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── Stripe Payment ── */}
        {!isNew && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Payment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                {job?.stripePaymentId ? (
                  <Badge className="bg-green-600 text-white">Paid</Badge>
                ) : (
                  <Badge variant="outline">Unpaid</Badge>
                )}
              </div>
              {job?.stripePaymentId && (
                <p className="text-xs text-muted-foreground">
                  Payment ID: {job.stripePaymentId}
                </p>
              )}
              {stripeError && <p className="text-xs text-destructive">{stripeError}</p>}
              {!job?.stripePaymentId && (
                <Button
                  onClick={handleStripeCheckout}
                  disabled={stripeLoading || totalAmount <= 0}
                  className="w-full"
                >
                  {stripeLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>Charge via Stripe — {formatCents(Math.round(totalAmount))}</>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Invoice / Estimate ── */}
        {!isNew && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Invoice / Estimate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={handleViewInvoice} className="w-full">
                <FileText className="w-4 h-4 mr-2" />
                View / Print Invoice
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
