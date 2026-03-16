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
  Package,
  Pencil,
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
  type JobPartLineItem,
  useAddJobPartLineItem,
  useAddJobPhoto,
  useAddLaborLineItem,
  useCreateJob,
  useDeleteJob,
  useGetJob,
  useGetJobPartLineItems,
  useListClients,
  useListLaborRates,
  useListParts,
  useRemoveJobPartLineItem,
  useRemoveJobPhoto,
  useRemoveLaborLineItem,
  useUpdateJob,
} from "../hooks/useQueries";

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
  const { data: inventoryParts = [] } = useListParts();
  const { data: laborRates = [] } = useListLaborRates();

  const createJob = useCreateJob();
  const updateJob = useUpdateJob();
  const deleteJob = useDeleteJob();
  const addPhoto = useAddJobPhoto();
  const removePhoto = useRemoveJobPhoto();
  const addLaborItem = useAddLaborLineItem();
  const removeLaborItem = useRemoveLaborLineItem();
  const addPartItem = useAddJobPartLineItem();
  const removePartItem = useRemoveJobPartLineItem();
  const { data: partLineItemsData = [] } = useGetJobPartLineItems(jobId);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [clientId, setClientId] = useState<string>("");
  const [status, setStatus] = useState<JobStatus>(JobStatus.open);
  const [notes, setNotes] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>(
    {},
  );
  const [taxRateStr, setTaxRateStr] = useState("8.875");

  // Labor line item form
  const [showLaborForm, setShowLaborForm] = useState(false);
  const [laborName, setLaborName] = useState("");
  const [laborDesc, setLaborDesc] = useState("");
  const [laborRateId, setLaborRateId] = useState<string>("");
  const [laborHours, setLaborHours] = useState("1");

  // Parts form
  const [showPartsForm, setShowPartsForm] = useState(false);
  const [partsMode, setPartsMode] = useState<"inventory" | "manual">(
    "inventory",
  );
  const [selectedInventoryPartId, setSelectedInventoryPartId] =
    useState<string>("");
  const [partNumber, setPartNumber] = useState("");
  const [partName, setPartName] = useState("");
  const [partDescription, setPartDescription] = useState("");
  const [partQty, setPartQty] = useState("1");
  const [partUnitPrice, setPartUnitPrice] = useState("");
  const [editingPartIndex, setEditingPartIndex] = useState<number | null>(null);

  // Initialize form from existing job
  if (!initialized && job && !isNew) {
    setClientId(job.clientId.toString());
    setStatus(job.status);
    setNotes(job.notes);
    setInitialized(true);
  }

  // Fetch part line items from backend (stored separately from job)
  const partLineItems: JobPartLineItem[] = partLineItemsData;

  const partCost = partLineItems.reduce(
    (s, i) => s + Number(i.unitPrice) * Number(i.quantity),
    0,
  );
  const laborCost = job
    ? job.laborLineItems.reduce(
        (sum, item) => sum + Number(item.totalAmount),
        0,
      )
    : 0;
  const taxRate =
    Math.max(0, Math.min(100, Number.parseFloat(taxRateStr) || 0)) / 100;
  const subtotal = partCost + laborCost;
  const tax = Math.round(subtotal * taxRate);
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
      const files = Array.from(e.target.files ?? []);
      if (!files.length || !jobId) return;
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
        } catch (err: unknown) {
          const msg =
            err instanceof Error ? err.message : "Failed to upload photo";
          toast.error(msg);
          setUploadProgress((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
        }
      }
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

  const resetPartsForm = () => {
    setSelectedInventoryPartId("");
    setPartNumber("");
    setPartName("");
    setPartDescription("");
    setPartQty("1");
    setPartUnitPrice("");
    setEditingPartIndex(null);
  };

  const handleEditPart = (idx: number) => {
    const item = partLineItems[idx];
    if (!item) return;
    setEditingPartIndex(idx);
    if (item.partId && item.partId.length > 0) {
      setPartsMode("inventory");
      setSelectedInventoryPartId((item.partId[0] as bigint).toString());
    } else {
      setPartsMode("manual");
      setSelectedInventoryPartId("");
    }
    setPartNumber(item.partNumber ?? "");
    setPartName(item.name);
    setPartDescription(item.description ?? "");
    setPartQty(Number(item.quantity).toString());
    setPartUnitPrice((Number(item.unitPrice) / 100).toFixed(2));
    setShowPartsForm(true);
  };

  const handleAddPart = async () => {
    if (!jobId) {
      toast.error("Save the job first");
      return;
    }

    let item: JobPartLineItem;

    if (partsMode === "inventory") {
      const inv = inventoryParts.find(
        (p) => p.id.toString() === selectedInventoryPartId,
      );
      if (!inv) {
        toast.error("Select a part from inventory");
        return;
      }
      const qty = Math.max(1, Number.parseInt(partQty) || 1);
      item = {
        id: BigInt(0),
        partId: [inv.id],
        partNumber: inv.partNumber,
        name: inv.name,
        description: inv.description,
        quantity: BigInt(qty),
        unitPrice: inv.unitCost,
      };
    } else {
      if (!partName) {
        toast.error("Enter a part name");
        return;
      }
      const qty = Math.max(1, Number.parseInt(partQty) || 1);
      const priceInCents = Math.round(
        (Number.parseFloat(partUnitPrice) || 0) * 100,
      );
      item = {
        id: BigInt(0),
        partId: [],
        partNumber: partNumber,
        name: partName,
        description: partDescription,
        quantity: BigInt(qty),
        unitPrice: BigInt(priceInCents),
      };
    }

    try {
      if (editingPartIndex !== null) {
        // Remove old, then add updated
        await removePartItem.mutateAsync({
          jobId,
          index: BigInt(editingPartIndex),
        });
        await addPartItem.mutateAsync({ jobId, item });
        toast.success("Part updated");
      } else {
        await addPartItem.mutateAsync({ jobId, item });
        toast.success("Part added");
      }
      setShowPartsForm(false);
      resetPartsForm();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save part";
      toast.error(msg);
    }
  };

  const handleRemovePart = async (index: number) => {
    if (!jobId) return;
    try {
      await removePartItem.mutateAsync({ jobId, index: BigInt(index) });
      toast.success("Part removed");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to remove part";
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
              <SelectTrigger data-ocid="jobs.client.select">
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
              <SelectTrigger data-ocid="jobs.status.select">
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
              data-ocid="jobs.notes.textarea"
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
                data-ocid="jobs.upload_button"
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
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />

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
              <div
                className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2"
                data-ocid="jobs.photos.empty_state"
              >
                <ImageIcon className="h-8 w-8 opacity-40" />
                <p className="text-sm">
                  No photos yet. Tap Add Photo to capture.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Parts */}
      {!isNew && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Package className="h-4 w-4" />
                Parts
              </span>
              {!showPartsForm && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      resetPartsForm();
                      setPartsMode("inventory");
                      setShowPartsForm(true);
                    }}
                    data-ocid="jobs.parts.open_modal_button"
                  >
                    <Package className="h-4 w-4 mr-1" />
                    From Inventory
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      resetPartsForm();
                      setPartsMode("manual");
                      setShowPartsForm(true);
                    }}
                    data-ocid="jobs.parts.secondary_button"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Manual
                  </Button>
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {showPartsForm && (
              <div
                className="border rounded-lg p-3 space-y-3 bg-muted/30"
                data-ocid="jobs.parts.panel"
              >
                {editingPartIndex !== null && (
                  <p className="text-xs font-medium text-primary">
                    Editing part {editingPartIndex + 1}
                  </p>
                )}
                <div className="flex gap-2 mb-1">
                  <button
                    type="button"
                    onClick={() => setPartsMode("inventory")}
                    className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                      partsMode === "inventory"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground"
                    }`}
                    data-ocid="jobs.parts.toggle"
                  >
                    From Inventory
                  </button>
                  <button
                    type="button"
                    onClick={() => setPartsMode("manual")}
                    className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                      partsMode === "manual"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    Manual Entry
                  </button>
                </div>

                {partsMode === "inventory" ? (
                  <>
                    <div className="space-y-1">
                      <Label className="text-xs">Select Part</Label>
                      <Select
                        value={selectedInventoryPartId}
                        onValueChange={setSelectedInventoryPartId}
                      >
                        <SelectTrigger data-ocid="jobs.parts.select">
                          <SelectValue placeholder="Choose from inventory…" />
                        </SelectTrigger>
                        <SelectContent>
                          {inventoryParts.map((p) => (
                            <SelectItem
                              key={p.id.toString()}
                              value={p.id.toString()}
                            >
                              {p.name}
                              {p.partNumber ? ` — #${p.partNumber}` : ""}
                              {" — "}
                              {formatCents(Number(p.unitCost))}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Quantity</Label>
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        value={partQty}
                        onChange={(e) => setPartQty(e.target.value)}
                        className="w-24"
                        data-ocid="jobs.parts.input"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Part Number</Label>
                        <Input
                          value={partNumber}
                          onChange={(e) => setPartNumber(e.target.value)}
                          placeholder="e.g. WPW10"
                          data-ocid="jobs.parts.input"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Unit Price ($)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={partUnitPrice}
                          onChange={(e) => setPartUnitPrice(e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Name *</Label>
                      <Input
                        value={partName}
                        onChange={(e) => setPartName(e.target.value)}
                        placeholder="e.g. Water inlet valve"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Description</Label>
                      <Input
                        value={partDescription}
                        onChange={(e) => setPartDescription(e.target.value)}
                        placeholder="Optional details"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Quantity</Label>
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        value={partQty}
                        onChange={(e) => setPartQty(e.target.value)}
                        className="w-24"
                      />
                    </div>
                  </>
                )}

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleAddPart}
                    disabled={addPartItem.isPending || removePartItem.isPending}
                    data-ocid="jobs.parts.submit_button"
                  >
                    {addPartItem.isPending || removePartItem.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : editingPartIndex !== null ? (
                      "Update Part"
                    ) : (
                      "Add Part"
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setShowPartsForm(false);
                      resetPartsForm();
                    }}
                    data-ocid="jobs.parts.cancel_button"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {partLineItems.length > 0
              ? partLineItems.map((item, idx) => (
                  <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: part items indexed by position
                    key={`part-${idx}`}
                    className="flex items-start justify-between gap-2"
                    data-ocid={`jobs.parts.item.${idx + 1}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {item.name}
                      </p>
                      {item.partNumber && (
                        <p className="text-xs text-muted-foreground">
                          #{item.partNumber}
                        </p>
                      )}
                      {item.description && (
                        <p className="text-xs text-muted-foreground truncate">
                          {item.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {Number(item.quantity)} ×{" "}
                        {formatCents(Number(item.unitPrice))} ={" "}
                        <span className="font-medium text-foreground">
                          {formatCents(
                            Number(item.quantity) * Number(item.unitPrice),
                          )}
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground shrink-0"
                        onClick={() => handleEditPart(idx)}
                        data-ocid={`jobs.parts.edit_button.${idx + 1}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive shrink-0"
                        onClick={() => handleRemovePart(idx)}
                        data-ocid={`jobs.parts.delete_button.${idx + 1}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
              : !showPartsForm && (
                  <p
                    className="text-sm text-muted-foreground py-2"
                    data-ocid="jobs.parts.empty_state"
                  >
                    No parts added. Use the buttons above to add parts.
                  </p>
                )}
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
                data-ocid="jobs.labor.open_modal_button"
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
                    data-ocid="jobs.labor.submit_button"
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
                    data-ocid="jobs.labor.cancel_button"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {job?.laborLineItems && job.laborLineItems.length > 0
              ? job.laborLineItems.map((item, idx) => (
                  <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: labor items indexed by position
                    key={`labor-${idx}`}
                    className="flex items-start justify-between gap-2"
                    data-ocid={`jobs.labor.item.${idx + 1}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {item.name}
                      </p>
                      {item.description && (
                        <p className="text-xs text-muted-foreground truncate">
                          {item.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {item.rateType === RateType.hourly
                          ? `${item.hours}hr @ ${formatCents(Number(item.rateAmount))}/hr`
                          : "Flat rate"}{" "}
                        —{" "}
                        <span className="font-medium text-foreground">
                          {formatCents(Number(item.totalAmount))}
                        </span>
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive shrink-0"
                      onClick={() => handleRemoveLabor(idx)}
                      data-ocid={`jobs.labor.delete_button.${idx + 1}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))
              : !showLaborForm && (
                  <p
                    className="text-sm text-muted-foreground py-2"
                    data-ocid="jobs.labor.empty_state"
                  >
                    No labor items yet.
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
          <CardContent className="space-y-3 text-sm">
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
            <div className="flex items-center justify-between gap-2">
              <Label className="text-muted-foreground text-sm">
                Tax Rate (%)
              </Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.001"
                value={taxRateStr}
                onChange={(e) => setTaxRateStr(e.target.value)}
                className="w-24 h-7 text-right text-sm"
                data-ocid="jobs.tax_rate_input"
              />
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax ({taxRateStr}%)</span>
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
            Estimate
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
