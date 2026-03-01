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
  // Support both /jobs/new (no param) and /jobs/$jobId (with param)
  const params = useParams({ strict: false }) as { jobId?: string };
  // isNew when there's no jobId param at all (route: /jobs/new)
  const isNew = !params.jobId;
  const jobId = !isNew ? BigInt(params.jobId!) : null;

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
  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!actor || !identity) return;
    if (!clientId) { setSaveError('Please select a client'); return; }
    setSaving(true);
    setSaveError(null);
    try {
      // Use BigInt-safe max ID calculation to avoid Math.max(-Infinity) on empty arrays
      let newId: bigint;
      if (isNew) {
        if (allJobs.length > 0) {
          const maxId = allJobs.reduce((max, j) => (j.id > max ? j.id : max), allJobs[0].id);
          newId = maxId + BigInt(1);
        } else {
          newId = BigInt(Date.now());
        }
      } else {
        newId = jobId!;
      }

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

  // ── Delete job ──
  const handleDelete = async () => {
    if (!actor || !jobId) return;
    try {
      await actor.deleteJob(jobId);
      await queryClient.invalidateQueries({ queryKey: ['jobs'] });
      navigate({ to: '/jobs' });
    } catch (e: any) {
      setSaveError(e?.message || 'Failed to delete job');
    }
  };

  // ── Stripe checkout ──
  const handleStripeCheckout = async () => {
    if (!actor || !jobId) return;
    setStripeLoading(true);
    setStripeError(null);
    try {
      const items: ShoppingItem[] = [];

      if (laborSubtotal > 0) {
        items.push({
          productName: 'Labor',
          productDescription: 'Labor charges',
          currency: 'usd',
          quantity: BigInt(1),
          priceInCents: BigInt(Math.round(laborSubtotal)),
        });
      }

      if (partsSubtotal > 0) {
        items.push({
          productName: 'Parts',
          productDescription: 'Parts and materials',
          currency: 'usd',
          quantity: BigInt(1),
          priceInCents: BigInt(Math.round(partsSubtotal)),
        });
      }

      if (taxAmount > 0) {
        items.push({
          productName: 'Tax',
          productDescription: `Tax (${taxRate}%)`,
          currency: 'usd',
          quantity: BigInt(1),
          priceInCents: BigInt(Math.round(taxAmount)),
        });
      }

      if (items.length === 0) {
        setStripeError('No items to charge');
        return;
      }

      const baseUrl = `${window.location.protocol}//${window.location.host}`;
      const result = await actor.createCheckoutSession(
        items,
        `${baseUrl}/payment-success`,
        `${baseUrl}/payment-failure`
      );
      const session = JSON.parse(result) as { id: string; url: string };
      if (!session?.url) throw new Error('Stripe session missing url');
      window.location.href = session.url;
    } catch (e: any) {
      setStripeError(e?.message || 'Failed to create checkout session');
    } finally {
      setStripeLoading(false);
    }
  };

  if (!isNew && jobLoading) {
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
          {isNew ? 'New Job' : 'Edit Job'}
        </h1>
        <Button size="sm" onClick={() => handleSave()} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
          {isNew ? 'Create' : 'Save'}
        </Button>
      </div>

      <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
        {saveError && (
          <div className="bg-destructive/10 text-destructive text-sm rounded-lg px-4 py-3">
            {saveError}
          </div>
        )}

        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Job Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Client */}
            <div className="space-y-1">
              <Label>Client *</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a client..." />
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

            {/* Status */}
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

            {/* Notes */}
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Job description, appliance details, issues found..."
                rows={3}
              />
            </div>

            {/* Tax Rate */}
            <div className="space-y-1">
              <Label>Tax Rate (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.001"
                value={taxRate}
                onChange={e => setTaxRate(parseFloat(e.target.value) || 0)}
                placeholder="8.875"
              />
            </div>
          </CardContent>
        </Card>

        {/* Labor Line Items — only available after job is saved */}
        {!isNew && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Labor</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Existing labor items */}
              {laborItems.length > 0 && (
                <div className="space-y-2">
                  {laborItems.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2 p-2 bg-muted/50 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.rateType === RateType.hourly
                            ? `${item.hours}h × ${centsToDisplay(item.rateAmount)}/hr`
                            : `Flat: ${centsToDisplay(item.rateAmount)}`}
                          {item.description ? ` · ${item.description}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-semibold text-foreground">
                          {centsToDisplay(item.totalAmount)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                          onClick={() => handleRemoveLabor(idx)}
                          disabled={removingLaborIdx === idx}
                        >
                          {removingLaborIdx === idx
                            ? <Loader2 size={12} className="animate-spin" />
                            : <X size={12} />}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add labor form */}
              <div className="space-y-3 pt-2 border-t border-border">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Add Labor</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Name</Label>
                    <Input
                      value={laborName}
                      onChange={e => setLaborName(e.target.value)}
                      placeholder="e.g. Diagnostic Fee"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Type</Label>
                    <Select value={laborType} onValueChange={v => setLaborType(v as 'hourly' | 'flat')}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="flat">Flat Rate</SelectItem>
                        <SelectItem value="hourly">Hourly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Rate ($)</Label>
                    <Input
                      value={laborRate}
                      onChange={e => setLaborRate(e.target.value)}
                      placeholder="0.00"
                      type="number"
                      min="0"
                      step="0.01"
                      className="h-8 text-sm"
                    />
                  </div>
                  {laborType === 'hourly' && (
                    <div className="space-y-1">
                      <Label className="text-xs">Hours</Label>
                      <Input
                        value={laborHours}
                        onChange={e => setLaborHours(e.target.value)}
                        placeholder="0"
                        type="number"
                        min="0"
                        step="0.25"
                        className="h-8 text-sm"
                      />
                    </div>
                  )}
                  <div className={`space-y-1 ${laborType === 'hourly' ? '' : 'col-span-2'}`}>
                    <Label className="text-xs">Description</Label>
                    <Input
                      value={laborDesc}
                      onChange={e => setLaborDesc(e.target.value)}
                      placeholder="Optional description"
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={handleAddLabor}
                  disabled={addingLabor || !laborName.trim() || !laborRate.trim()}
                  className="w-full"
                >
                  {addingLabor ? <Loader2 size={14} className="animate-spin mr-1" /> : <Plus size={14} className="mr-1" />}
                  Add Labor Item
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Parts — only available after job is saved */}
        {!isNew && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Parts Used</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {jobParts.length > 0 && (
                <div className="space-y-2">
                  {jobParts.map(part => (
                    <div key={part.id.toString()} className="flex items-center justify-between gap-2 p-2 bg-muted/50 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{part.name}</p>
                        <p className="text-xs text-muted-foreground">#{part.partNumber}</p>
                      </div>
                      <span className="text-sm font-semibold text-foreground shrink-0">
                        {centsToDisplay(part.unitCost)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {availableParts.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-border">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Add Part</p>
                  <div className="flex gap-2">
                    <Select value={selectedPartId} onValueChange={setSelectedPartId}>
                      <SelectTrigger className="flex-1 h-8 text-sm">
                        <SelectValue placeholder="Select part..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableParts.map(p => (
                          <SelectItem key={p.id.toString()} value={p.id.toString()}>
                            {p.name} (qty: {p.quantityOnHand.toString()})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={partQty}
                      onChange={e => setPartQty(e.target.value)}
                      type="number"
                      min="1"
                      className="w-16 h-8 text-sm"
                      placeholder="Qty"
                    />
                    <Button
                      size="sm"
                      onClick={handleAddPart}
                      disabled={addingPart || !selectedPartId}
                      className="h-8"
                    >
                      {addingPart ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    </Button>
                  </div>
                </div>
              )}

              {jobParts.length === 0 && availableParts.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-2">
                  No parts available. Add parts in Inventory first.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Photos — only available after job is saved */}
        {!isNew && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Photos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {job?.photos && job.photos.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {job.photos.map((photo, idx) => (
                    <div key={idx} className="relative group rounded-lg overflow-hidden bg-muted aspect-square">
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
                        {removingPhotoIdx === idx
                          ? <Loader2 size={12} className="animate-spin" />
                          : <X size={12} />}
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
                className="w-full"
                onClick={() => photoInputRef.current?.click()}
                disabled={uploadingPhoto}
              >
                {uploadingPhoto
                  ? <Loader2 size={16} className="animate-spin mr-2" />
                  : <Camera size={16} className="mr-2" />}
                {uploadingPhoto ? 'Uploading...' : 'Add Photo'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Totals — only available after job is saved */}
        {!isNew && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Labor</span>
                <span>${(laborSubtotal / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Parts</span>
                <span>${(partsSubtotal / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax ({taxRate}%)</span>
                <span>${(taxAmount / 100).toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span>${(totalAmount / 100).toFixed(2)}</span>
              </div>

              {stripeError && (
                <div className="bg-destructive/10 text-destructive text-sm rounded-lg px-3 py-2">
                  {stripeError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate({ to: '/invoice/$jobId', params: { jobId: jobId!.toString() } })}
                >
                  <FileText size={14} className="mr-1" />
                  Invoice
                </Button>
                <Button
                  size="sm"
                  onClick={handleStripeCheckout}
                  disabled={stripeLoading || totalAmount === 0}
                >
                  {stripeLoading
                    ? <Loader2 size={14} className="animate-spin mr-1" />
                    : <CreditCard size={14} className="mr-1" />}
                  Charge
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Delete — only available after job is saved */}
        {!isNew && (
          <Button
            variant="destructive"
            className="w-full"
            onClick={handleDelete}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Job
          </Button>
        )}

        {/* Hint for new jobs */}
        {isNew && (
          <p className="text-xs text-muted-foreground text-center">
            Save the job first, then you can add labor, parts, and photos.
          </p>
        )}
      </div>
    </div>
  );
}
