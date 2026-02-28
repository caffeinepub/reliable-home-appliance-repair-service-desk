import { useState, useEffect } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import {
  useGetJob,
  useCreateJob,
  useUpdateJob,
  useUpdateJobStatus,
  useDeleteJob,
  useListClients,
  useListJobs,
} from '../hooks/useQueries';
import type { Job } from '../backend';
import { Variant_open_complete_inProgress, Variant_general_preexisting_potential } from '../backend';
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
import { ArrowLeft, Trash2, Loader2, Clock, AlertCircle, CheckCircle2, FileText } from 'lucide-react';

interface JobDetailPageProps {
  mode: 'create' | 'edit';
}

interface JobFormData {
  clientId: string;
  notes: string;
  waiverType: string;
  maintenancePackage: string;
  status: Variant_open_complete_inProgress;
}

const emptyForm: JobFormData = {
  clientId: '',
  notes: '',
  waiverType: '',
  maintenancePackage: '',
  status: Variant_open_complete_inProgress.open,
};

const STATUS_OPTIONS = [
  { value: Variant_open_complete_inProgress.open, label: 'Open', icon: AlertCircle },
  { value: Variant_open_complete_inProgress.inProgress, label: 'In Progress', icon: Clock },
  { value: Variant_open_complete_inProgress.complete, label: 'Complete', icon: CheckCircle2 },
];

const WAIVER_OPTIONS = [
  { value: '', label: 'None' },
  { value: Variant_general_preexisting_potential.preexisting, label: 'Pre-existing Damage' },
  { value: Variant_general_preexisting_potential.potential, label: 'Potential Damage' },
  { value: Variant_general_preexisting_potential.general, label: 'General Waiver' },
];

function statusBadgeVariant(status: Variant_open_complete_inProgress) {
  switch (status) {
    case Variant_open_complete_inProgress.open: return 'destructive';
    case Variant_open_complete_inProgress.inProgress: return 'secondary';
    case Variant_open_complete_inProgress.complete: return 'default';
  }
}

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

  const handleChange = (field: keyof JobFormData, value: string | Variant_open_complete_inProgress) => {
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

    const waiverType = form.waiverType
      ? (form.waiverType as Variant_general_preexisting_potential)
      : undefined;

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

  const handleStatusChange = async (newStatus: Variant_open_complete_inProgress) => {
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
                onValueChange={(val) => handleChange('status', val as Variant_open_complete_inProgress)}
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
                {WAIVER_OPTIONS.filter((o) => o.value !== '').map(({ value, label }) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
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
    </div>
  );
}
