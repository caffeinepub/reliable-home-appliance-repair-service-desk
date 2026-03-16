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
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate, useParams } from "@tanstack/react-router";
import {
  ArrowLeft,
  FileText,
  Image as ImageIcon,
  Loader2,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { type Job, JobStatus, type LaborLineItem, RateType } from "../backend";
import { useActor } from "../hooks/useActor";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import {
  useAddJobPhoto,
  useAddLaborLineItem,
  useCreateJob,
  useDeleteJob,
  useGetJob,
  useGetTotalPartCostByJob,
  useListClients,
  useListLaborRates,
  useListParts,
  useRemoveJobPhoto,
  useRemoveLaborLineItem,
  useUpdateJob,
} from "../hooks/useQueries";

const TAX_RATE = 0.08875;
const DIAGNOSTIC_FEE = 8500; // cents

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function JobDetailPage() {
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { jobId?: string };
  const jobId =
    params.jobId && params.jobId !== "new" ? BigInt(params.jobId) : null;
  const isNew = !jobId;

  const { identity } = useInternetIdentity();
  const { actor, isFetching: actorFetching } = useActor();

  const { data: job, isLoading: jobLoading } = useGetJob(jobId);
  const { data: clients = [] } = useListClients();
  const { data: parts = [] } = useListParts();
  const { data: laborRates = [] } = useListLaborRates();
  const { data: partCostBigInt } = useGetTotalPartCostByJob(jobId);

  const createJob = useCreateJob();
  const updateJob = useUpdateJob();
  const deleteJob = useDeleteJob();
  const addPhoto = useAddJobPhoto();
  const removePhoto = useRemoveJobPhoto();
  const addLaborItem = useAddLaborLineItem();
  const removeLaborItem = useRemoveLaborLineItem();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [clientId, setClientId] = useState<string>("");
  const [status, setStatus] = useState<JobStatus>(JobStatus.open);
  const [notes, setNotes] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>(
    {},
  );

  // Labor line item form
  const [showLaborForm, setShowLaborForm] = useState(false);
  const [laborName, setLaborName] = useState("");
  const [laborDesc, setLaborDesc] = useState("");
  const [laborRateId, setLaborRateId] = useState<string>("");
  const [laborHours, setLaborHours] = useState("1");

  // Initialize form from existing job
  if (!initialized && job && !isNew) {
    setClientId(job.clientId.toString());
    setStatus(job.status);
    setNotes(job.notes);
    setInitialized(true);
  }

  const partCost = partCostBigInt ? Number(partCostBigInt) : 0;
  const laborCost = job
    ? job.laborLineItems.reduce(
        (sum, item) => sum + Number(item.totalAmount),
        0,
      )
    : 0;
  const subtotal = DIAGNOSTIC_FEE + partCost + laborCost;
  const tax = Math.round(subtotal * TAX_RATE);
  const total = subtotal + tax;

  const handleSave = async () => {
    if (!clientId) {
      toast.error("Please select a client");
      return;
    }
    if (!identity) {
      toast.error("Please log in first");
      return;
    }
    if (!actor) {
      toast.error("Connecting to backend…");
      return;
    }

    const jobData: Job = {
      id: jobId ?? BigInt(0),
      clientId: BigInt(clientId),
      tech: identity.getPrincipal(),
      date: BigInt(Date.now()) * BigInt(1_000_000),
      status,
      notes,
      photos: job?.photos ?? [],
      estimate: job?.estimate ?? undefined,
      waiverType: job?.waiverType ?? undefined,
      laborLineItems: job?.laborLineItems ?? [],
      stripePaymentId: job?.stripePaymentId ?? undefined,
      scheduledStart: job?.scheduledStart ?? undefined,
      scheduledEnd: job?.scheduledEnd ?? undefined,
      damageWaiver: job?.damageWaiver ?? undefined,
    };

    try {
      if (isNew) {
        const newId = await createJob.mutateAsync(jobData);
        toast.success("Job created!");
        navigate({ to: `/jobs/${newId}` });
      } else {
        await updateJob.mutateAsync(jobData);
        toast.success("Job saved!");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save job";
      toast.error(msg);
    }
  };

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!jobId) {
        toast.error("Please save the job first before adding photos");
        return;
      }
      const files = Array.from(e.target.files ?? []);
      if (files.length === 0) return;

      for (const file of files) {
        const key = `${file.name}-${Date.now()}`;
        setUploadProgress((prev) => ({ ...prev, [key]: 0 }));
        try {
          await addPhoto.mutateAsync({
            jobId,
            file,
            onProgress: (pct) =>
              setUploadProgress((prev) => ({ ...prev, [key]: pct })),
          });
          setUploadProgress((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
          toast.success("Photo uploaded");
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Upload failed";
          toast.error(msg);
          setUploadProgress((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
        }
      }
      // Reset input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [jobId, addPhoto],
  );

  const handleRemovePhoto = async (index: number) => {
    if (!jobId) return;
    try {
      await removePhoto.mutateAsync({ jobId, photoIndex: BigInt(index) });
      toast.success("Photo removed");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to remove photo";
      toast.error(msg);
    }
  };

  const handleAddLabor = async () => {
    if (!jobId) {
      toast.error("Save the job first");
      return;
    }
    const rate = laborRates.find((r) => r.id.toString() === laborRateId);
    if (!rate) {
      toast.error("Select a labor rate");
      return;
    }
    const hours = Number.parseFloat(laborHours) || 0;
    const totalAmount =
      rate.rateType === RateType.hourly
        ? BigInt(Math.round(Number(rate.amount) * hours))
        : rate.amount;

    const item: LaborLineItem = {
      name: laborName || rate.name,
      description: laborDesc,
      rateType: rate.rateType,
      rateAmount: rate.amount,
      hours,
      totalAmount,
    };

    try {
      await addLaborItem.mutateAsync({ jobId, item });
      toast.success("Labor item added");
      setLaborName("");
      setLaborDesc("");
      setLaborRateId("");
      setLaborHours("1");
      setShowLaborForm(false);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to add labor item";
      toast.error(msg);
    }
  };

  const handleRemoveLabor = async (index: number) => {
    if (!jobId) return;
    try {
      await removeLaborItem.mutateAsync({ jobId, index: BigInt(index) });
      toast.success("Labor item removed");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to remove labor item";
      toast.error(msg);
    }
  };

  const isSaving = createJob.isPending || updateJob.isPending;
  const isLoading = jobLoading && !isNew;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const uploadingCount = Object.keys(uploadProgress).length;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate({ to: "/jobs" })}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold font-display">
            {isNew ? "New Job" : `Job #${job?.id ?? ""}`}
          </h1>
          {!isNew && job && (
            <p className="text-sm text-muted-foreground">
              {new Date(Number(job.date) / 1_000_000).toLocaleDateString()}
            </p>
          )}
        </div>
        {!isNew && job && (
          <Badge
            variant={
              job.status === JobStatus.complete
                ? "default"
                : job.status === JobStatus.inProgress
                  ? "secondary"
                  : "outline"
            }
          >
            {job.status === JobStatus.open
              ? "Open"
              : job.status === JobStatus.inProgress
                ? "In Progress"
                : "Complete"}
          </Badge>
        )}
      </div>

      {/* Client & Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Job Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Client</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a client…" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id.toString()} value={c.id.toString()}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as JobStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={JobStatus.open}>Open</SelectItem>
                <SelectItem value={JobStatus.inProgress}>
                  In Progress
                </SelectItem>
                <SelectItem value={JobStatus.complete}>Complete</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Job notes, device description, issues…"
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      {/* Photos */}
      {!isNew && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>Photos</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingCount > 0}
              >
                {uploadingCount > 0 ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading…
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Add Photo
                  </>
                )}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Hidden file input — capture="environment" triggers camera on mobile */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />

            {/* Upload progress bars */}
            {Object.entries(uploadProgress).map(([key, pct]) => (
              <div key={key} className="mb-2">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Uploading…</span>
                  <span>{pct}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            ))}

            {/* Photo grid */}
            {job?.photos && job.photos.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {job.photos.map((photo, idx) => (
                  <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: photo order is stable
                    key={`photo-${idx}`}
                    className="relative group aspect-square rounded-lg overflow-hidden bg-muted"
                  >
                    <img
                      src={photo.getDirectURL()}
                      alt={`#${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(idx)}
                      className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Remove photo"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
                <ImageIcon className="h-8 w-8 opacity-40" />
                <p className="text-sm">
                  No photos yet. Tap "Add Photo" to upload.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Parts */}
      {!isNew && parts.filter((p) => p.jobId === jobId).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Parts Used</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {parts
              .filter((p) => p.jobId === jobId)
              .map((p) => (
                <div
                  key={p.id.toString()}
                  className="flex justify-between text-sm"
                >
                  <span>{p.name}</span>
                  <span className="text-muted-foreground">
                    {formatCents(Number(p.unitCost))}
                  </span>
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {/* Labor */}
      {!isNew && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>Labor</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowLaborForm(!showLaborForm)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Labor
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {showLaborForm && (
              <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
                <div className="space-y-1">
                  <Label className="text-xs">Description (optional)</Label>
                  <Input
                    value={laborName}
                    onChange={(e) => setLaborName(e.target.value)}
                    placeholder="e.g. Screen replacement"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Notes</Label>
                  <Input
                    value={laborDesc}
                    onChange={(e) => setLaborDesc(e.target.value)}
                    placeholder="Additional notes"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Rate</Label>
                  <Select value={laborRateId} onValueChange={setLaborRateId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select rate…" />
                    </SelectTrigger>
                    <SelectContent>
                      {laborRates.map((r) => (
                        <SelectItem
                          key={r.id.toString()}
                          value={r.id.toString()}
                        >
                          {r.name} — {formatCents(Number(r.amount))}
                          {r.rateType === RateType.hourly ? "/hr" : " flat"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {laborRates.find((r) => r.id.toString() === laborRateId)
                  ?.rateType === RateType.hourly && (
                  <div className="space-y-1">
                    <Label className="text-xs">Hours</Label>
                    <Input
                      type="number"
                      min="0.25"
                      step="0.25"
                      value={laborHours}
                      onChange={(e) => setLaborHours(e.target.value)}
                    />
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleAddLabor}
                    disabled={addLaborItem.isPending}
                  >
                    {addLaborItem.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Add"
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowLaborForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {job?.laborLineItems && job.laborLineItems.length > 0 ? (
              job.laborLineItems.map((item, idx) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: labor items indexed by position
                  key={`labor-${idx}`}
                  className="flex items-start justify-between gap-2"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    {item.description && (
                      <p className="text-xs text-muted-foreground truncate">
                        {item.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {item.rateType === RateType.hourly
                        ? `${item.hours}h × ${formatCents(Number(item.rateAmount))}/hr`
                        : "Flat rate"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-medium">
                      {formatCents(Number(item.totalAmount))}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => handleRemoveLabor(idx)}
                      disabled={removeLaborItem.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-2">
                No labor items yet
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Totals */}
      {!isNew && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Totals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Diagnostic Fee</span>
              <span>{formatCents(DIAGNOSTIC_FEE)}</span>
            </div>
            {partCost > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Parts</span>
                <span>{formatCents(partCost)}</span>
              </div>
            )}
            {laborCost > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Labor</span>
                <span>{formatCents(laborCost)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax (8.875%)</span>
              <span>{formatCents(tax)}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-bold text-base">
              <span>Total</span>
              <span>{formatCents(total)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          className="flex-1"
          onClick={handleSave}
          disabled={isSaving || actorFetching}
          data-ocid="jobs.save_button"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              {isNew ? "Create Job" : "Save Job"}
            </>
          )}
        </Button>

        {!isNew && jobId && (
          <Button
            variant="outline"
            onClick={() => navigate({ to: `/invoice/${jobId}` })}
            data-ocid="jobs.secondary_button"
          >
            <FileText className="h-4 w-4 mr-2" />
            View Estimate
          </Button>
        )}
      </div>

      {/* Delete Job */}
      {!isNew && jobId && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              className="w-full mt-2"
              data-ocid="jobs.delete_button"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Job
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent data-ocid="jobs.dialog">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Job</AlertDialogTitle>
              <AlertDialogDescription>
                Permanently delete this job? This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-ocid="jobs.cancel_button">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  try {
                    await deleteJob.mutateAsync(jobId);
                    toast.success("Job deleted");
                    navigate({ to: "/jobs" });
                  } catch (e: unknown) {
                    toast.error(
                      e instanceof Error ? e.message : "Failed to delete job",
                    );
                  }
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-ocid="jobs.confirm_button"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
