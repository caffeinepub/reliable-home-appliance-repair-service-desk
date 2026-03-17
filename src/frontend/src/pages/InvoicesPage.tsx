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
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate } from "@tanstack/react-router";
import { Eye, FileText, Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { JobStatus } from "../backend";
import {
  type AppInvoice,
  useCreateInvoice,
  useDeleteInvoice,
  useListClients,
  useListInvoices,
  useListJobs,
  useUpdateInvoice,
} from "../hooks/useQueries";
import type { JobPartLineItem } from "../hooks/useQueries";

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(nanos: bigint): string {
  return new Date(Number(nanos) / 1_000_000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function InvoicesPage() {
  const navigate = useNavigate();
  const { data: invoices = [], isLoading: invoicesLoading } = useListInvoices();
  const { data: jobs = [] } = useListJobs();
  const { data: clients = [] } = useListClients();
  const createInvoice = useCreateInvoice();
  const updateInvoice = useUpdateInvoice();
  const deleteInvoice = useDeleteInvoice();

  const [createOpen, setCreateOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [invoiceNotes, setInvoiceNotes] = useState("");

  const completedJobs = jobs.filter((j) => j.status === JobStatus.complete);

  const getClient = (clientId: bigint) =>
    clients.find((c) => c.id === clientId);

  const getJob = (jobId: bigint) => jobs.find((j) => j.id === jobId);

  const computeJobTotal = (jobId: bigint): number => {
    const job = getJob(jobId);
    if (!job) return 0;
    const partItems: JobPartLineItem[] =
      ((job as unknown as Record<string, unknown>)?.partLineItems as
        | JobPartLineItem[]
        | undefined) ?? [];
    const partCost = partItems.reduce(
      (s, i) => s + Number(i.unitPrice) * Number(i.quantity),
      0,
    );
    const laborCost = job.laborLineItems.reduce(
      (s, i) => s + Number(i.totalAmount),
      0,
    );
    return partCost + laborCost;
  };

  const handleCreate = async () => {
    if (!selectedJobId) {
      toast.error("Select a completed job");
      return;
    }
    const invoice: AppInvoice = {
      id: BigInt(0),
      jobId: BigInt(selectedJobId),
      invoiceNumber: BigInt(0),
      issuedAt: BigInt(Date.now()) * BigInt(1_000_000),
      notes: invoiceNotes,
      isPaid: false,
    };
    try {
      await createInvoice.mutateAsync(invoice);
      toast.success("Invoice created");
      setCreateOpen(false);
      setSelectedJobId("");
      setInvoiceNotes("");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to create invoice";
      toast.error(msg);
    }
  };

  const handleTogglePaid = async (inv: AppInvoice) => {
    try {
      await updateInvoice.mutateAsync({ ...inv, isPaid: !inv.isPaid });
      toast.success(inv.isPaid ? "Marked unpaid" : "Marked paid");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to update invoice";
      toast.error(msg);
    }
  };

  const handleDelete = async (invoiceId: bigint) => {
    try {
      await deleteInvoice.mutateAsync(invoiceId);
      toast.success("Invoice deleted");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to delete invoice";
      toast.error(msg);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold font-display">Invoices</h1>
          {invoices.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {invoices.length}
            </Badge>
          )}
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-ocid="invoices.open_modal_button">
              <Plus className="h-4 w-4 mr-1" />
              New Invoice
            </Button>
          </DialogTrigger>
          <DialogContent data-ocid="invoices.dialog">
            <DialogHeader>
              <DialogTitle>Create Invoice</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Completed Job</Label>
                <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                  <SelectTrigger data-ocid="invoices.job.select">
                    <SelectValue placeholder="Select a completed job…" />
                  </SelectTrigger>
                  <SelectContent>
                    {completedJobs.length === 0 ? (
                      <SelectItem value="__none" disabled>
                        No completed jobs
                      </SelectItem>
                    ) : (
                      completedJobs.map((j) => {
                        const c = getClient(j.clientId);
                        return (
                          <SelectItem
                            key={j.id.toString()}
                            value={j.id.toString()}
                          >
                            Job #{j.id.toString()}
                            {c ? ` — ${c.name}` : ""}
                          </SelectItem>
                        );
                      })
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Textarea
                  value={invoiceNotes}
                  onChange={(e) => setInvoiceNotes(e.target.value)}
                  placeholder="Payment terms, additional notes…"
                  rows={3}
                  data-ocid="invoices.notes.textarea"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setCreateOpen(false)}
                data-ocid="invoices.cancel_button"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={createInvoice.isPending}
                data-ocid="invoices.submit_button"
              >
                {createInvoice.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Create Invoice
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* List */}
      {invoicesLoading ? (
        <div
          className="flex items-center justify-center py-16"
          data-ocid="invoices.loading_state"
        >
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : invoices.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-16 gap-3 text-center"
          data-ocid="invoices.empty_state"
        >
          <FileText className="h-12 w-12 text-muted-foreground/40" />
          <p className="text-muted-foreground font-medium">No invoices yet</p>
          <p className="text-sm text-muted-foreground">
            Create an invoice after completing a job.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {invoices.map((inv, idx) => {
            const job = getJob(inv.jobId);
            const client = job ? getClient(job.clientId) : undefined;
            const total = computeJobTotal(inv.jobId);
            return (
              <Card
                key={inv.id.toString()}
                className="overflow-hidden"
                data-ocid={`invoices.item.${idx + 1}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">
                          Invoice #
                          {inv.invoiceNumber > 0
                            ? inv.invoiceNumber.toString()
                            : inv.id.toString()}
                        </p>
                        <Badge
                          variant={inv.isPaid ? "default" : "outline"}
                          className={
                            inv.isPaid
                              ? "bg-green-600 text-white"
                              : "text-amber-600 border-amber-400"
                          }
                        >
                          {inv.isPaid ? "Paid" : "Pending"}
                        </Badge>
                      </div>
                      {client && (
                        <p className="text-sm text-muted-foreground truncate">
                          {client.name}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Job #{inv.jobId.toString()} · {formatDate(inv.issuedAt)}
                      </p>
                      {total > 0 && (
                        <p className="text-sm font-semibold text-foreground mt-1">
                          {formatCents(total)}
                        </p>
                      )}
                      {inv.notes && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {inv.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() =>
                          navigate({ to: `/invoice/${inv.jobId}` })
                        }
                        data-ocid={`invoices.view.button.${idx + 1}`}
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        View
                      </Button>
                      <Button
                        variant={inv.isPaid ? "outline" : "default"}
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleTogglePaid(inv)}
                        disabled={updateInvoice.isPending}
                        data-ocid={`invoices.toggle.${idx + 1}`}
                      >
                        {inv.isPaid ? "Unpaid" : "Mark Paid"}
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-destructive hover:text-destructive"
                            data-ocid={`invoices.delete_button.${idx + 1}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent data-ocid="invoices.dialog">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
                            <AlertDialogDescription>
                              Permanently delete this invoice? This cannot be
                              undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel data-ocid="invoices.cancel_button">
                              Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(inv.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              data-ocid="invoices.confirm_button"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
