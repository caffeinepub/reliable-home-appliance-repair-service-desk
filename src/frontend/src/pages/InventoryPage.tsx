import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Loader2, Package, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import type { Part } from "../backend";
import {
  useCreatePart,
  useDeletePart,
  useListParts,
  useUpdatePart,
} from "../hooks/useQueries";
import { useIsOwner } from "../hooks/useQueries";

function formatDollars(cents: bigint | number): string {
  const val = typeof cents === "bigint" ? Number(cents) : cents;
  return `$${(val / 100).toFixed(2)}`;
}

interface PartFormData {
  name: string;
  partNumber: string;
  description: string;
  quantityOnHand: string;
  unitCostDollars: string; // user enters dollars, e.g. "12.99"
}

const emptyForm: PartFormData = {
  name: "",
  partNumber: "",
  description: "",
  quantityOnHand: "0",
  unitCostDollars: "0.00",
};

export default function InventoryPage() {
  const { data: parts = [], isLoading } = useListParts();
  const createPart = useCreatePart();
  const updatePart = useUpdatePart();
  const deletePart = useDeletePart();
  const isOwner = useIsOwner();

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<bigint | null>(null);
  const [formData, setFormData] = useState<PartFormData>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Part | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredParts = parts.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.partNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleAddNew = () => {
    setFormData(emptyForm);
    setShowAddForm(true);
    setEditingId(null);
  };

  const handleEdit = (part: Part) => {
    setFormData({
      name: part.name,
      partNumber: part.partNumber,
      description: part.description,
      quantityOnHand: part.quantityOnHand.toString(),
      unitCostDollars: (Number(part.unitCost) / 100).toFixed(2),
    });
    setEditingId(part.id);
    setShowAddForm(false);
  };

  const handleCancel = () => {
    setShowAddForm(false);
    setEditingId(null);
    setFormData(emptyForm);
  };

  const handleSaveNew = async () => {
    if (!formData.name.trim()) return;
    const newId = BigInt(Date.now());
    const unitCostCents = BigInt(
      Math.round(Number.parseFloat(formData.unitCostDollars || "0") * 100),
    );
    await createPart.mutateAsync({
      id: newId,
      name: formData.name.trim(),
      partNumber: formData.partNumber.trim(),
      description: formData.description.trim(),
      quantityOnHand: BigInt(Number.parseInt(formData.quantityOnHand) || 0),
      unitCost: unitCostCents,
      jobId: undefined,
    });
    setShowAddForm(false);
    setFormData(emptyForm);
  };

  const handleSaveEdit = async (part: Part) => {
    const unitCostCents = BigInt(
      Math.round(Number.parseFloat(formData.unitCostDollars || "0") * 100),
    );
    await updatePart.mutateAsync({
      ...part,
      name: formData.name.trim(),
      partNumber: formData.partNumber.trim(),
      description: formData.description.trim(),
      quantityOnHand: BigInt(Number.parseInt(formData.quantityOnHand) || 0),
      unitCost: unitCostCents,
    });
    setEditingId(null);
    setFormData(emptyForm);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deletePart.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  };

  const isSaving = createPart.isPending || updatePart.isPending;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 pb-24 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Package className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Inventory</h1>
          <Badge variant="secondary" className="ml-1">
            {parts.length}
          </Badge>
        </div>
        {isOwner && (
          <Button onClick={handleAddNew} size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Add Part
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="mb-4">
        <Input
          placeholder="Search parts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full"
        />
      </div>

      {/* Add Form */}
      {showAddForm && isOwner && (
        <Card className="mb-4 border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">New Part</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="Part name"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Part Number</Label>
                <Input
                  value={formData.partNumber}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, partNumber: e.target.value }))
                  }
                  placeholder="e.g. WR55X26671"
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Input
                value={formData.description}
                onChange={(e) =>
                  setFormData((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Brief description"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Qty on Hand</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.quantityOnHand}
                  onChange={(e) =>
                    setFormData((f) => ({
                      ...f,
                      quantityOnHand: e.target.value,
                    }))
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Unit Cost (USD)</Label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    $
                  </span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.unitCostDollars}
                    onChange={(e) =>
                      setFormData((f) => ({
                        ...f,
                        unitCostDollars: e.target.value,
                      }))
                    }
                    className="pl-7"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                onClick={handleSaveNew}
                disabled={isSaving || !formData.name.trim()}
                className="gap-2"
              >
                {isSaving ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={handleCancel}>
                <X className="h-3 w-3 mr-1" />
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Parts List */}
      {filteredParts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No parts found</p>
          {isOwner && (
            <p className="text-sm mt-1">Add your first part to get started</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredParts.map((part) => (
            <Card key={part.id.toString()} className="overflow-hidden">
              {editingId === part.id ? (
                <CardContent className="pt-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Name *</Label>
                      <Input
                        value={formData.name}
                        onChange={(e) =>
                          setFormData((f) => ({ ...f, name: e.target.value }))
                        }
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Part Number</Label>
                      <Input
                        value={formData.partNumber}
                        onChange={(e) =>
                          setFormData((f) => ({
                            ...f,
                            partNumber: e.target.value,
                          }))
                        }
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Description</Label>
                    <Input
                      value={formData.description}
                      onChange={(e) =>
                        setFormData((f) => ({
                          ...f,
                          description: e.target.value,
                        }))
                      }
                      className="mt-1"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Qty on Hand</Label>
                      <Input
                        type="number"
                        min="0"
                        value={formData.quantityOnHand}
                        onChange={(e) =>
                          setFormData((f) => ({
                            ...f,
                            quantityOnHand: e.target.value,
                          }))
                        }
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Unit Cost (USD)</Label>
                      <div className="relative mt-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                          $
                        </span>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.unitCostDollars}
                          onChange={(e) =>
                            setFormData((f) => ({
                              ...f,
                              unitCostDollars: e.target.value,
                            }))
                          }
                          className="pl-7"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={() => handleSaveEdit(part)}
                      disabled={isSaving || !formData.name.trim()}
                      className="gap-2"
                    >
                      {isSaving ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Check className="h-3 w-3" />
                      )}
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={handleCancel}>
                      <X className="h-3 w-3 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              ) : (
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-foreground truncate">
                          {part.name}
                        </h3>
                        {part.partNumber && (
                          <Badge variant="outline" className="text-xs shrink-0">
                            {part.partNumber}
                          </Badge>
                        )}
                      </div>
                      {part.description && (
                        <p className="text-sm text-muted-foreground mt-0.5 truncate">
                          {part.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        <span className="text-muted-foreground">
                          Qty:{" "}
                          <span className="font-medium text-foreground">
                            {part.quantityOnHand.toString()}
                          </span>
                        </span>
                        <span className="text-muted-foreground">
                          Unit Cost:{" "}
                          <span className="font-medium text-foreground">
                            {formatDollars(part.unitCost)}
                          </span>
                        </span>
                        {part.jobId !== undefined && (
                          <Badge variant="secondary" className="text-xs">
                            Job #{part.jobId.toString()}
                          </Badge>
                        )}
                      </div>
                    </div>
                    {isOwner && (
                      <div className="flex gap-1 shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => handleEdit(part)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(part)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Part</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.name}"? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletePart.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
