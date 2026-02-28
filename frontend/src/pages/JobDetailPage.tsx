import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import {
  useGetJob,
  useCreateJob,
  useUpdateJob,
  useUpdateJobStatus,
  useDeleteJob,
  useListClients,
  useListJobs,
  useListLaborRates,
  useAddLaborLineItem,
  useRemoveLaborLineItem,
  useListParts,
  useUsePartOnJob,
  useAddJobPhoto,
  useRemoveJobPhoto,
} from '../hooks/useQueries';
import type { Job, LaborLineItem } from '../backend';
import { ExternalBlob, JobStatus, RateType, WaiverType } from '../backend';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  ArrowLeft, Trash2, Loader2, Clock, AlertCircle, CheckCircle2,
  FileText, Plus, X, Wrench, Package, Camera, ImageIcon
} from 'lucide-react';

interface JobDetailPageProps {
  mode: 'create' | 'edit';
}

interface JobFormData {
  clientId: string;
  notes: string;
  waiverType: string;
  maintenancePackage: string;
  status: JobStatus;
}

const emptyForm: JobFormData = {
  clientId: '',
  notes: '',
  waiverType: '',
  maintenancePackage: '',
  status: JobStatus.open,
};

const STATUS_OPTIONS = [
  { value: JobStatus.open, label: 'Open', icon: AlertCircle },
  { value: JobStatus.inProgress, label: 'In Progress', icon: Clock },
  { value: JobStatus.complete, label: 'Complete', icon: CheckCircle2 },
];

function statusBadgeVariant(status: JobStatus): 'destructive' | 'secondary' | 'default' {
  switch (status) {
    case JobStatus.open: return 'destructive';
    case JobStatus.inProgress: return 'secondary';
    case JobStatus.complete: return 'default';
  }
}

function formatCents(cents: bigint): string {
  return `$${(Number(cents) / 100).toFixed(2)}`;
}

// ─── Labor Section ────────────────────────────────────────────────────────────

interface LaborSectionProps {
  jobId: bigint;
  laborLineItems: LaborLineItem[];
}

function LaborSection({ jobId, laborLineItems }: LaborSectionProps) {
  const { data: laborRates = [] } = useListLaborRates();
  const addLabor = useAddLaborLineItem();
  const removeLabor = useRemoveLaborLineItem();

  const [showForm, setShowForm] = useState(false);
  const [selectedRateId, setSelectedRateId] = useState('');
  const [hours, setHours] = useState('');
  const [description, setDescription] = useState('');

  const selectedRate = laborRates.find((r) => r.id.toString() === selectedRateId);
  const isHourly = selectedRate?.rateType === RateType.hourly;

  const computedAmount = (): bigint => {
    if (!selectedRate) return BigInt(0);
    if (isHourly) {
      const h = parseFloat(hours) || 0;
      return BigInt(Math.round(Number(selectedRate.amount) * h));
    }
    return selectedRate.amount;
  };

  const handleAdd = async () => {
    if (!selectedRate) return;
    if (isHourly && (!hours || parseFloat(hours) <= 0)) return;
    const item: LaborLineItem = {
      laborRateId: selectedRate.id,
      rateType: selectedRate.rateType,
      hours: isHourly ? parseFloat(hours) : undefined,
      amount: computedAmount(),
      description: description.trim(),
    };
    try {
      await addLabor.mutateAsync({ jobId, laborLineItem: item });
      setSelectedRateId('');
      setHours('');
      setDescription('');
      setShowForm(false);
    } catch (err) {
      console.error('Failed to add labor:', err);
    }
  };

  const handleRemove = async (index: number) => {
    try {
      await removeLabor.mutateAsync({ jobId, index: BigInt(index) });
    } catch (err) {
      console.error('Failed to remove labor:', err);
    }
  };

  const subtotal = laborLineItems.reduce((sum, item) => sum + item.amount, BigInt(0));

  const getRateName = (rateId: bigint) =>
    laborRates.find((r) => r.id === rateId)?.name ?? `Rate #${rateId}`;

  return (
    <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wrench size={16} className="text-primary" />
          <h3 className="font-semibold text-sm text-foreground">Labor</h3>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowForm((v) => !v)}
          className="h-7 px-2 text-xs rounded-lg text-primary hover:bg-primary/10"
        >
          <Plus size={13} className="mr-1" />
          Add Labor
        </Button>
      </div>

      {laborLineItems.length > 0 ? (
        <div className="space-y-2">
          {laborLineItems.map((item, idx) => (
            <div
              key={idx}
              className="flex items-start justify-between gap-2 bg-muted/50 rounded-xl px-3 py-2"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-medium text-foreground truncate">
                    {getRateName(item.laborRateId)}
                  </span>
                  <Badge variant="outline" className="text-xs px-1.5 py-0 h-4">
                    {item.rateType === RateType.hourly ? 'Hourly' : 'Flat'}
                  </Badge>
                </div>
                {item.rateType === RateType.hourly && item.hours != null && (
                  <p className="text-xs text-muted-foreground mt-0.5">{item.hours}h</p>
                )}
                {item.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.description}</p>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-sm font-semibold text-foreground">{formatCents(item.amount)}</span>
                <button
                  type="button"
                  onClick={() => handleRemove(idx)}
                  disabled={removeLabor.isPending}
                  className="text-muted-foreground hover:text-destructive transition-colors p-0.5 rounded"
                >
                  {removeLabor.isPending ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <X size={13} />
                  )}
                </button>
              </div>
            </div>
          ))}
          <div className="flex justify-between items-center pt-1 border-t border-border">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Labor Subtotal</span>
            <span className="text-sm font-bold text-foreground">{formatCents(subtotal)}</span>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-2">No labor added yet.</p>
      )}

      {showForm && (
        <div className="border border-border rounded-xl p-3 space-y-3 bg-background">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Labor Rate</Label>
            <Select value={selectedRateId} onValueChange={setSelectedRateId}>
              <SelectTrigger className="rounded-lg h-9 text-sm">
                <SelectValue placeholder="Select a rate..." />
              </SelectTrigger>
              <SelectContent>
                {laborRates.length === 0 ? (
                  <SelectItem value="none" disabled>No rates configured</SelectItem>
                ) : (
                  laborRates.map((rate) => (
                    <SelectItem key={rate.id.toString()} value={rate.id.toString()}>
                      {rate.name} — {rate.rateType === RateType.hourly ? `${formatCents(rate.amount)}/hr` : `Flat ${formatCents(rate.amount)}`}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {isHourly && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Hours</Label>
              <Input
                type="number"
                min="0.25"
                step="0.25"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="e.g. 1.5"
                className="rounded-lg h-9 text-sm"
              />
              {selectedRate && hours && parseFloat(hours) > 0 && (
                <p className="text-xs text-muted-foreground">
                  Total: {formatCents(computedAmount())}
                </p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Description (optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description..."
              className="rounded-lg text-sm resize-none"
              rows={2}
            />
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => { setShowForm(false); setSelectedRateId(''); setHours(''); setDescription(''); }}
              className="rounded-lg flex-1"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleAdd}
              disabled={!selectedRateId || (isHourly && (!hours || parseFloat(hours) <= 0)) || addLabor.isPending}
              className="rounded-lg flex-1 bg-primary text-primary-foreground"
            >
              {addLabor.isPending ? <Loader2 size={14} className="animate-spin" /> : 'Add'}
            </Button>
          </div>
          {addLabor.isError && (
            <p className="text-destructive text-xs text-center">Failed to add labor. Try again.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Parts Section ────────────────────────────────────────────────────────────

interface PartsSectionProps {
  jobId: bigint;
}

function PartsSection({ jobId }: PartsSectionProps) {
  const { data: allParts = [] } = useListParts();
  const usePartMutation = useUsePartOnJob();

  const [showForm, setShowForm] = useState(false);
  const [selectedPartId, setSelectedPartId] = useState('');
  const [quantity, setQuantity] = useState('1');

  const usedParts = allParts.filter((p) => p.jobId != null && p.jobId === jobId);
  const availableParts = allParts.filter((p) => p.jobId == null || p.jobId === jobId);

  const subtotal = usedParts.reduce(
    (sum, p) => sum + p.unitCost * p.quantityOnHand,
    BigInt(0)
  );

  const handleAdd = async () => {
    if (!selectedPartId || !quantity || parseInt(quantity) <= 0) return;
    try {
      await usePartMutation.mutateAsync({
        partId: BigInt(selectedPartId),
        jobId,
        quantityUsed: BigInt(parseInt(quantity)),
      });
      setSelectedPartId('');
      setQuantity('1');
      setShowForm(false);
    } catch (err) {
      console.error('Failed to use part on job:', err);
    }
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package size={16} className="text-primary" />
          <h3 className="font-semibold text-sm text-foreground">Parts Used</h3>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowForm((v) => !v)}
          className="h-7 px-2 text-xs rounded-lg text-primary hover:bg-primary/10"
        >
          <Plus size={13} className="mr-1" />
          Add Part
        </Button>
      </div>

      {usedParts.length > 0 ? (
        <div className="space-y-2">
          {usedParts.map((part) => (
            <div
              key={part.id.toString()}
              className="flex items-start justify-between gap-2 bg-muted/50 rounded-xl px-3 py-2"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{part.name}</p>
                <p className="text-xs text-muted-foreground">SKU: {part.partNumber}</p>
                <p className="text-xs text-muted-foreground">Qty: {part.quantityOnHand.toString()}</p>
              </div>
              <span className="text-sm font-semibold text-foreground shrink-0">
                {formatCents(part.unitCost)}
                <span className="text-xs text-muted-foreground font-normal"> ea</span>
              </span>
            </div>
          ))}
          <div className="flex justify-between items-center pt-1 border-t border-border">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Parts Subtotal</span>
            <span className="text-sm font-bold text-foreground">{formatCents(subtotal)}</span>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-2">No parts added yet.</p>
      )}

      {showForm && (
        <div className="border border-border rounded-xl p-3 space-y-3 bg-background">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Part</Label>
            <Select value={selectedPartId} onValueChange={setSelectedPartId}>
              <SelectTrigger className="rounded-lg h-9 text-sm">
                <SelectValue placeholder="Select a part..." />
              </SelectTrigger>
              <SelectContent>
                {availableParts.length === 0 ? (
                  <SelectItem value="none" disabled>No parts available</SelectItem>
                ) : (
                  availableParts.map((part) => (
                    <SelectItem key={part.id.toString()} value={part.id.toString()}>
                      {part.name} — {part.partNumber} (Qty: {part.quantityOnHand.toString()})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Quantity</Label>
            <Input
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="1"
              className="rounded-lg h-9 text-sm"
            />
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => { setShowForm(false); setSelectedPartId(''); setQuantity('1'); }}
              className="rounded-lg flex-1"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleAdd}
              disabled={!selectedPartId || !quantity || parseInt(quantity) <= 0 || usePartMutation.isPending}
              className="rounded-lg flex-1 bg-primary text-primary-foreground"
            >
              {usePartMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : 'Add'}
            </Button>
          </div>
          {usePartMutation.isError && (
            <p className="text-destructive text-xs text-center">
              Failed to add part. Check quantity and try again.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Photos Section ───────────────────────────────────────────────────────────

interface PhotosSectionProps {
  jobId: bigint;
  photos: ExternalBlob[];
}

function PhotosSection({ jobId, photos }: PhotosSectionProps) {
  const addPhoto = useAddJobPhoto();
  const removePhoto = useRemoveJobPhoto();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      setUploadProgress(0);
      const blob = ExternalBlob.fromBytes(bytes).withUploadProgress((pct) => {
        setUploadProgress(pct);
      });
      await addPhoto.mutateAsync({ jobId, photo: blob });
    } catch (err) {
      console.error('Failed to upload photo:', err);
    } finally {
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (index: number) => {
    setDeletingIndex(index);
    try {
      await removePhoto.mutateAsync({ jobId, photoIndex: BigInt(index) });
    } catch (err) {
      console.error('Failed to remove photo:', err);
    } finally {
      setDeletingIndex(null);
    }
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ImageIcon size={16} className="text-primary" />
          <h3 className="font-semibold text-sm text-foreground">Photos</h3>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={addPhoto.isPending}
          className="h-7 px-2 text-xs rounded-lg text-primary hover:bg-primary/10"
        >
          <Camera size={13} className="mr-1" />
          Take / Upload
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {uploadProgress !== null && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Uploading...</span>
            <span>{uploadProgress}%</span>
          </div>
          <Progress value={uploadProgress} className="h-1.5 rounded-full" />
        </div>
      )}

      {addPhoto.isError && (
        <p className="text-destructive text-xs text-center">Failed to upload photo. Try again.</p>
      )}

      {photos.length > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((photo, idx) => (
            <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden bg-muted">
              <img
                src={photo.getDirectURL()}
                alt={`Job photo ${idx + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => handleDelete(idx)}
                disabled={deletingIndex === idx || removePhoto.isPending}
                className="absolute top-1 right-1 bg-black/60 hover:bg-destructive text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                {deletingIndex === idx ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : (
                  <X size={11} />
                )}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-6 text-muted-foreground/60 gap-2">
          <Camera size={28} />
          <p className="text-xs">No photos yet. Tap "Take / Upload" to add one.</p>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function JobDetailPage({ mode }: JobDetailPageProps) {
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { jobId?: string };
  const jobId = params.jobId ? BigInt(params.jobId) : null;
  const { identity } = useInternetIdentity();

  const { data: existingJob, isLoading: jobLoading } = useGetJob(mode === 'edit' ? jobId : null);
  const { data: clients } = useListClients();
  const { data: allJobs } = useListJobs();

  const createJob = useCreateJob();
  const updateJob = useUpdateJob();
  const updateJobStatus = useUpdateJobStatus();
  const deleteJob = useDeleteJob();

  const [form, setForm] = useState<JobFormData>(emptyForm);

  useEffect(() => {
    if (existingJob) {
      setForm({
        clientId: existingJob.clientId.toString(),
        notes: existingJob.notes,
        waiverType: existingJob.waiverType ?? '',
        maintenancePackage: existingJob.maintenancePackage ?? '',
        status: existingJob.status,
      });
    }
  }, [existingJob]);

  const handleChange = (field: keyof JobFormData, value: string | JobStatus) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const getNextId = (): bigint => {
    if (!allJobs || allJobs.length === 0) return BigInt(1);
    const maxId = allJobs.reduce((max, j) => (j.id > max ? j.id : max), BigInt(0));
    return maxId + BigInt(1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clientId) return;

    const waiverType = form.waiverType ? (form.waiverType as WaiverType) : undefined;

    const jobData: Job = {
      id: mode === 'edit' && jobId !== null ? jobId : getNextId(),
      clientId: BigInt(form.clientId),
      tech: identity!.getPrincipal(),
      date: mode === 'edit' && existingJob ? existingJob.date : BigInt(Date.now()) * BigInt(1_000_000),
      status: form.status,
      notes: form.notes.trim(),
      photos: mode === 'edit' && existingJob ? existingJob.photos : [],
      estimate: mode === 'edit' && existingJob ? existingJob.estimate : undefined,
      waiverType,
      maintenancePackage: form.maintenancePackage.trim() || undefined,
      stripePaymentId: mode === 'edit' && existingJob ? existingJob.stripePaymentId : undefined,
      laborLineItems: mode === 'edit' && existingJob ? existingJob.laborLineItems : [],
    };

    try {
      if (mode === 'create') {
        await createJob.mutateAsync(jobData);
      } else {
        await updateJob.mutateAsync(jobData);
      }
      navigate({ to: '/jobs' });
    } catch (err) {
      console.error('Failed to save job:', err);
    }
  };

  const handleStatusChange = async (newStatus: JobStatus) => {
    if (jobId === null) return;
    try {
      await updateJobStatus.mutateAsync({ jobId, newStatus });
      setForm((prev) => ({ ...prev, status: newStatus }));
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleDelete = async () => {
    if (jobId === null) return;
    try {
      await deleteJob.mutateAsync(jobId);
      navigate({ to: '/jobs' });
    } catch (err) {
      console.error('Failed to delete job:', err);
    }
  };

  const isPending = createJob.isPending || updateJob.isPending;
  const isError = createJob.isError || updateJob.isError;

  if (mode === 'edit' && jobLoading) {
    return (
      <div className="px-4 py-5 space-y-4">
        <Skeleton className="h-8 w-32 rounded-xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    );
  }

  const clientName = clients?.find((c) => c.id.toString() === form.clientId)?.name;

  return (
    <div className="px-4 py-5 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate({ to: '/jobs' })}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={18} />
          <span className="text-sm font-medium">Jobs</span>
        </button>
        <div className="flex items-center gap-1">
          {mode === 'edit' && existingJob && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate({ to: '/invoice/$jobId', params: { jobId: existingJob.id.toString() } })}
              className="text-primary hover:text-primary hover:bg-primary/10 rounded-xl h-8 px-2 text-xs font-medium"
            >
              <FileText size={14} className="mr-1" />
              Invoice
            </Button>
          )}
          {mode === 'edit' && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl">
                  <Trash2 size={18} />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-2xl mx-4">
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Job</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this job{clientName ? ` for ${clientName}` : ''}? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground rounded-xl"
                  >
                    {deleteJob.isPending ? <Loader2 className="animate-spin" size={16} /> : 'Delete'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <h2 className="font-display font-bold text-xl text-foreground">
          {mode === 'create' ? 'New Job' : 'Edit Job'}
        </h2>
        {mode === 'edit' && existingJob && (
          <Badge variant={statusBadgeVariant(form.status)}>
            {STATUS_OPTIONS.find((s) => s.value === form.status)?.label}
          </Badge>
        )}
      </div>

      {/* Status Quick-Change (edit mode) */}
      {mode === 'edit' && (
        <div className="bg-card rounded-2xl border border-border p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Update Status
          </p>
          <div className="flex gap-2">
            {STATUS_OPTIONS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => handleStatusChange(value)}
                disabled={updateJobStatus.isPending}
                className={`flex-1 flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl border text-xs font-semibold transition-all ${
                  form.status === value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-muted-foreground border-border hover:border-primary/50'
                }`}
              >
                {updateJobStatus.isPending && form.status === value ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Icon size={14} />
                )}
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-card rounded-2xl border border-border p-4 space-y-4">
          {/* Client Selector */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">
              Client <span className="text-destructive">*</span>
            </Label>
            <Select
              value={form.clientId}
              onValueChange={(val) => handleChange('clientId', val)}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Select a client..." />
              </SelectTrigger>
              <SelectContent>
                {clients?.length === 0 ? (
                  <SelectItem value="none" disabled>
                    No clients — add one first
                  </SelectItem>
                ) : (
                  clients?.map((client) => (
                    <SelectItem key={client.id.toString()} value={client.id.toString()}>
                      {client.name} — {client.phone}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Status (create mode) */}
          {mode === 'create' && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Initial Status</Label>
              <Select
                value={form.status}
                onValueChange={(val) => handleChange('status', val as JobStatus)}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Waiver Type */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Waiver Type</Label>
            <Select
              value={form.waiverType || 'none'}
              onValueChange={(val) => handleChange('waiverType', val === 'none' ? '' : val)}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Select waiver type..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value={WaiverType.preexisting}>Pre-existing Damage</SelectItem>
                <SelectItem value={WaiverType.potential}>Potential Damage</SelectItem>
                <SelectItem value={WaiverType.general}>General Waiver</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Maintenance Package */}
          <div className="space-y-1.5">
            <Label htmlFor="maintenancePackage" className="text-sm font-medium">
              Maintenance Package
            </Label>
            <Input
              id="maintenancePackage"
              value={form.maintenancePackage}
              onChange={(e) => handleChange('maintenancePackage', e.target.value)}
              placeholder="e.g. Quarterly Laundry Maintenance"
              className="rounded-xl"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-sm font-medium">Notes</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Describe the job, appliance, issue..."
              className="rounded-xl resize-none"
              rows={4}
            />
          </div>
        </div>

        {/* Tech Info (read-only) */}
        {mode === 'edit' && existingJob && (
          <div className="bg-muted rounded-xl px-4 py-3">
            <p className="text-xs text-muted-foreground font-medium">
              Technician: <span className="font-mono text-foreground text-xs">{existingJob.tech.toString().slice(0, 20)}...</span>
            </p>
          </div>
        )}

        {isError && (
          <p className="text-destructive text-sm text-center">
            Failed to save job. Please try again.
          </p>
        )}

        <Button
          type="submit"
          disabled={isPending || !form.clientId}
          className="w-full bg-primary text-primary-foreground rounded-xl font-semibold"
          size="lg"
        >
          {isPending ? (
            <>
              <Loader2 className="animate-spin mr-2" size={18} />
              Saving...
            </>
          ) : mode === 'create' ? (
            'Create Job'
          ) : (
            'Save Changes'
          )}
        </Button>
      </form>

      {/* Labor, Parts, Photos — only in edit mode once job exists */}
      {mode === 'edit' && existingJob && jobId !== null && (
        <div className="space-y-4 pb-6">
          <LaborSection
            jobId={jobId}
            laborLineItems={existingJob.laborLineItems}
          />
          <PartsSection jobId={jobId} />
          <PhotosSection
            jobId={jobId}
            photos={existingJob.photos}
          />
        </div>
      )}
    </div>
  );
}
