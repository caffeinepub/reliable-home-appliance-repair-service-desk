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
import {
  Calculator,
  DollarSign,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import type React from "react";
import { useState } from "react";
import { toast } from "sonner";
import { RateType } from "../backend";
import {
  useCreateLaborRate,
  useDeleteLaborRate,
  useListLaborRates,
  useUpdateLaborRate,
} from "../hooks/useQueries";

export default function LaborRatesPage() {
  const { data: laborRates = [], isLoading } = useListLaborRates();
  const createRate = useCreateLaborRate();
  const updateRate = useUpdateLaborRate();
  const deleteRate = useDeleteLaborRate();

  // Add form
  const [name, setName] = useState("");
  const [rateType, setRateType] = useState<RateType>(RateType.hourly);
  const [amount, setAmount] = useState("");

  // Edit state
  const [editingId, setEditingId] = useState<bigint | null>(null);
  const [editName, setEditName] = useState("");
  const [editRateType, setEditRateType] = useState<RateType>(RateType.hourly);
  const [editAmount, setEditAmount] = useState("");

  // Calculator
  const [calcHours, setCalcHours] = useState("");
  const [calcRateId, setCalcRateId] = useState("");

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !amount) {
      toast.error("Name and amount are required");
      return;
    }
    try {
      const maxId = laborRates.reduce(
        (max, r) => (r.id > max ? r.id : max),
        BigInt(0),
      );
      await createRate.mutateAsync({
        id: maxId + BigInt(1),
        name: name.trim(),
        rateType,
        amount: BigInt(Math.round(Number.parseFloat(amount) * 100)),
      });
      setName("");
      setAmount("");
      toast.success("Labor rate added");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to add rate");
    }
  };

  const startEdit = (rate: {
    id: bigint;
    name: string;
    rateType: RateType;
    amount: bigint;
  }) => {
    setEditingId(rate.id);
    setEditName(rate.name);
    setEditRateType(rate.rateType);
    setEditAmount((Number(rate.amount) / 100).toFixed(2));
  };

  const handleUpdate = async (id: bigint) => {
    if (!editName.trim() || !editAmount) {
      toast.error("Name and amount are required");
      return;
    }
    try {
      await updateRate.mutateAsync({
        id,
        name: editName.trim(),
        rateType: editRateType,
        amount: BigInt(Math.round(Number.parseFloat(editAmount) * 100)),
      });
      setEditingId(null);
      toast.success("Rate updated");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to update rate");
    }
  };

  const handleDelete = async (id: bigint) => {
    try {
      await deleteRate.mutateAsync(id);
      toast.success("Rate deleted");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to delete rate");
    }
  };

  const calcRate = laborRates.find((r) => r.id.toString() === calcRateId);
  const calcTotal =
    calcRate && calcHours
      ? calcRate.rateType === RateType.hourly
        ? (Number(calcRate.amount) / 100) * Number.parseFloat(calcHours)
        : Number(calcRate.amount) / 100
      : null;

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 bg-card border-b border-border px-4 py-3">
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-primary" />
          Labor Rates
        </h1>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Rates List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configured Rates</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : laborRates.length === 0 ? (
              <p
                data-ocid="laborrates.empty_state"
                className="text-sm text-muted-foreground text-center py-4"
              >
                No labor rates configured yet.
              </p>
            ) : (
              <div className="space-y-2">
                {laborRates.map((rate, idx) =>
                  editingId === rate.id ? (
                    <div
                      key={rate.id.toString()}
                      data-ocid={`laborrates.item.${idx + 1}`}
                      className="border border-primary/40 rounded-lg p-3 space-y-3 bg-muted/20"
                    >
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Rate name"
                        data-ocid="laborrates.input"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Select
                          value={editRateType}
                          onValueChange={(v) => setEditRateType(v as RateType)}
                        >
                          <SelectTrigger data-ocid="laborrates.select">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={RateType.hourly}>
                              Hourly
                            </SelectItem>
                            <SelectItem value={RateType.flat}>
                              Flat Rate
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          step="0.01"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          placeholder="Amount ($)"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleUpdate(rate.id)}
                          disabled={updateRate.isPending}
                          data-ocid="laborrates.save_button"
                        >
                          {updateRate.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4 mr-1" />
                          )}
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingId(null)}
                          data-ocid="laborrates.cancel_button"
                        >
                          <X className="h-4 w-4 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={rate.id.toString()}
                      data-ocid={`laborrates.item.${idx + 1}`}
                      className="flex items-center justify-between bg-muted/40 rounded-lg px-3 py-2.5"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{rate.name}</p>
                        <p className="text-xs text-muted-foreground">
                          ${(Number(rate.amount) / 100).toFixed(2)} /{" "}
                          {rate.rateType === RateType.hourly ? "hr" : "flat"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="text-xs mr-1">
                          {rate.rateType === RateType.hourly
                            ? "Hourly"
                            : "Flat"}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => startEdit(rate)}
                          data-ocid={`laborrates.edit_button.${idx + 1}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              data-ocid={`laborrates.delete_button.${idx + 1}`}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent data-ocid="laborrates.dialog">
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Delete Labor Rate
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Delete "{rate.name}"? This cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel data-ocid="laborrates.cancel_button">
                                Cancel
                              </AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(rate.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                data-ocid="laborrates.confirm_button"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ),
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add New Rate */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Labor Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="rate-name">Rate Name</Label>
                <Input
                  id="rate-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Standard Hourly, Trip Charge"
                  data-ocid="laborrates.input"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>Type</Label>
                  <Select
                    value={rateType}
                    onValueChange={(v) => setRateType(v as RateType)}
                  >
                    <SelectTrigger data-ocid="laborrates.select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={RateType.hourly}>Hourly</SelectItem>
                      <SelectItem value={RateType.flat}>Flat Rate</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="rate-amount">Amount ($)</Label>
                  <Input
                    id="rate-amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={createRate.isPending}
                data-ocid="laborrates.primary_button"
              >
                {createRate.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Plus className="h-4 w-4 mr-1" />
                )}
                Add Rate
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Calculator */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Estimate Calculator
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Quick reference — select a rate and enter hours to calculate an
              estimate.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Rate</Label>
                <Select value={calcRateId} onValueChange={setCalcRateId}>
                  <SelectTrigger data-ocid="laborrates.select">
                    <SelectValue placeholder="Select rate…" />
                  </SelectTrigger>
                  <SelectContent>
                    {laborRates.map((r) => (
                      <SelectItem key={r.id.toString()} value={r.id.toString()}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {calcRate?.rateType === RateType.hourly && (
                <div className="space-y-1">
                  <Label htmlFor="calc-hours">Hours</Label>
                  <Input
                    id="calc-hours"
                    type="number"
                    step="0.25"
                    min="0"
                    value={calcHours}
                    onChange={(e) => setCalcHours(e.target.value)}
                    placeholder="0.0"
                    data-ocid="laborrates.input"
                  />
                </div>
              )}
            </div>
            {calcTotal !== null && (
              <div className="bg-primary/10 rounded-lg px-4 py-3 flex items-center justify-between">
                <span className="text-sm font-medium">Estimated Total</span>
                <span className="text-lg font-bold text-primary">
                  ${calcTotal.toFixed(2)}
                </span>
              </div>
            )}
            {calcRate?.rateType === RateType.flat && (
              <div className="bg-primary/10 rounded-lg px-4 py-3 flex items-center justify-between">
                <span className="text-sm font-medium">Flat Rate</span>
                <span className="text-lg font-bold text-primary">
                  ${(Number(calcRate.amount) / 100).toFixed(2)}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Separator />
        <div className="text-center text-xs text-muted-foreground pb-4">
          © {new Date().getFullYear()} Reliable Home Appliance Repair LLC
        </div>
      </div>
    </div>
  );
}
