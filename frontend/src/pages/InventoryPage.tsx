import React, { useState } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Package,
  Loader2,
  AlertCircle,
  Check,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import {
  useListParts,
  useCreatePart,
  useUpdatePart,
  useDeletePart,
  useIsOwner,
} from '../hooks/useQueries';
import type { Part } from '../backend';

interface PartFormState {
  name: string;
  partNumber: string;
  description: string;
  quantityOnHand: string;
  unitCost: string;
}

const emptyForm = (): PartFormState => ({
  name: '',
  partNumber: '',
  description: '',
  quantityOnHand: '0',
  unitCost: '0',
});

function partToForm(part: Part): PartFormState {
  return {
    name: part.name,
    partNumber: part.partNumber,
    description: part.description,
    quantityOnHand: part.quantityOnHand.toString(),
    unitCost: part.unitCost.toString(),
  };
}

export default function InventoryPage() {
  const isOwner = useIsOwner();
  const { data: parts = [], isLoading } = useListParts();
  const createPart = useCreatePart();
  const updatePart = useUpdatePart();
  const deletePart = useDeletePart();

  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<PartFormState>(emptyForm());
  const [addError, setAddError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<bigint | null>(null);
  const [editForm, setEditForm] = useState<PartFormState>(emptyForm());
  const [editError, setEditError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Part | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ── Add Part ──────────────────────────────────────────────────────────────

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);

    if (!addForm.name.trim()) {
      setAddError('Part name is required.');
      return;
    }

    try {
      const newId =
        parts.length === 0
          ? BigInt(Date.now())
          : parts.reduce((max, p) => (p.id > max ? p.id : max), parts[0].id) + 1n;

      const newPart: Part = {
        id: newId,
        name: addForm.name.trim(),
        partNumber: addForm.partNumber.trim(),
        description: addForm.description.trim(),
        quantityOnHand: BigInt(parseInt(addForm.quantityOnHand, 10) || 0),
        unitCost: BigInt(parseInt(addForm.unitCost, 10) || 0),
        jobId: undefined,
      };

      await createPart.mutateAsync(newPart);
      setAddForm(emptyForm());
      setShowAddForm(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create part.';
      setAddError(msg);
    }
  };

  // ── Edit Part ─────────────────────────────────────────────────────────────

  const startEdit = (part: Part) => {
    setEditingId(part.id);
    setEditForm(partToForm(part));
    setEditError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditError(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId === null) return;
    setEditError(null);

    if (!editForm.name.trim()) {
      setEditError('Part name is required.');
      return;
    }

    try {
      const original = parts.find((p) => p.id === editingId);
      const updatedPart: Part = {
        id: editingId,
        name: editForm.name.trim(),
        partNumber: editForm.partNumber.trim(),
        description: editForm.description.trim(),
        quantityOnHand: BigInt(parseInt(editForm.quantityOnHand, 10) || 0),
        unitCost: BigInt(parseInt(editForm.unitCost, 10) || 0),
        jobId: original?.jobId,
      };

      await updatePart.mutateAsync(updatedPart);
      setEditingId(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update part.';
      setEditError(msg);
    }
  };

  // ── Delete Part ───────────────────────────────────────────────────────────

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteError(null);
    try {
      await deletePart.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete part.';
      setDeleteError(msg);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const formatCurrency = (cents: bigint) =>
    `$${(Number(cents) / 100).toFixed(2)}`;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold font-display">Inventory</h1>
        </div>
        {isOwner && (
          <Button
            size="sm"
            onClick={() => {
              setShowAddForm(true);
              setAddForm(emptyForm());
              setAddError(null);
            }}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Part
          </Button>
        )}
      </header>

      <main className="max-w-4xl mx-auto p-4 pb-24 space-y-4">
        {/* Delete error */}
        {deleteError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{deleteError}</AlertDescription>
          </Alert>
        )}

        {/* Add Part Form */}
        {showAddForm && isOwner && (
          <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
            <h2 className="font-semibold mb-3 text-foreground">New Part</h2>
            {addError && (
              <Alert variant="destructive" className="mb-3">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{addError}</AlertDescription>
              </Alert>
            )}
            <form onSubmit={handleAddSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="add-name">
                    Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="add-name"
                    value={addForm.name}
                    onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                    placeholder="Part name"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="add-partNumber">Part Number</Label>
                  <Input
                    id="add-partNumber"
                    value={addForm.partNumber}
                    onChange={(e) => setAddForm({ ...addForm, partNumber: e.target.value })}
                    placeholder="SKU / Part #"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="add-qty">Quantity on Hand</Label>
                  <Input
                    id="add-qty"
                    type="number"
                    min="0"
                    value={addForm.quantityOnHand}
                    onChange={(e) => setAddForm({ ...addForm, quantityOnHand: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="add-cost">Unit Cost (cents)</Label>
                  <Input
                    id="add-cost"
                    type="number"
                    min="0"
                    value={addForm.unitCost}
                    onChange={(e) => setAddForm({ ...addForm, unitCost: e.target.value })}
                    placeholder="e.g. 1999 = $19.99"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="add-desc">Description</Label>
                <Input
                  id="add-desc"
                  value={addForm.description}
                  onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
                  placeholder="Optional description"
                />
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowAddForm(false);
                    setAddError(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={createPart.isPending}
                  className="gap-2"
                >
                  {createPart.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Save Part
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {/* Empty state */}
        {!isLoading && parts.length === 0 && !showAddForm && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
            <Package className="h-12 w-12 opacity-30" />
            <p className="text-sm">No parts in inventory yet.</p>
            {isOwner && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddForm(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add your first part
              </Button>
            )}
          </div>
        )}

        {/* Parts list */}
        {!isLoading && parts.length > 0 && (
          <div className="space-y-3">
            {parts.map((part) =>
              editingId === part.id ? (
                // ── Inline edit row ──────────────────────────────────────
                <div
                  key={part.id.toString()}
                  className="bg-card border border-primary/40 rounded-lg p-4 shadow-sm"
                >
                  <h3 className="font-medium mb-3 text-foreground">Edit Part</h3>
                  {editError && (
                    <Alert variant="destructive" className="mb-3">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{editError}</AlertDescription>
                    </Alert>
                  )}
                  <form onSubmit={handleEditSubmit} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor={`edit-name-${part.id}`}>
                          Name <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id={`edit-name-${part.id}`}
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`edit-pn-${part.id}`}>Part Number</Label>
                        <Input
                          id={`edit-pn-${part.id}`}
                          value={editForm.partNumber}
                          onChange={(e) => setEditForm({ ...editForm, partNumber: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`edit-qty-${part.id}`}>Quantity on Hand</Label>
                        <Input
                          id={`edit-qty-${part.id}`}
                          type="number"
                          min="0"
                          value={editForm.quantityOnHand}
                          onChange={(e) => setEditForm({ ...editForm, quantityOnHand: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`edit-cost-${part.id}`}>Unit Cost (cents)</Label>
                        <Input
                          id={`edit-cost-${part.id}`}
                          type="number"
                          min="0"
                          value={editForm.unitCost}
                          onChange={(e) => setEditForm({ ...editForm, unitCost: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`edit-desc-${part.id}`}>Description</Label>
                      <Input
                        id={`edit-desc-${part.id}`}
                        value={editForm.description}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      />
                    </div>
                    <div className="flex gap-2 justify-end pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={cancelEdit}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        size="sm"
                        disabled={updatePart.isPending}
                        className="gap-2"
                      >
                        {updatePart.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                        Save
                      </Button>
                    </div>
                  </form>
                </div>
              ) : (
                // ── Display row ──────────────────────────────────────────
                <div
                  key={part.id.toString()}
                  className="bg-card border border-border rounded-lg p-4 shadow-sm flex items-start justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground">{part.name}</span>
                      {part.partNumber && (
                        <Badge variant="outline" className="text-xs">
                          {part.partNumber}
                        </Badge>
                      )}
                      {Number(part.quantityOnHand) === 0 && (
                        <Badge variant="destructive" className="text-xs">
                          Out of Stock
                        </Badge>
                      )}
                      {Number(part.quantityOnHand) > 0 && Number(part.quantityOnHand) <= 3 && (
                        <Badge variant="secondary" className="text-xs">
                          Low Stock
                        </Badge>
                      )}
                    </div>
                    {part.description && (
                      <p className="text-sm text-muted-foreground mt-1 truncate">
                        {part.description}
                      </p>
                    )}
                    <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                      <span>Qty: <strong className="text-foreground">{part.quantityOnHand.toString()}</strong></span>
                      <span>Cost: <strong className="text-foreground">{formatCurrency(part.unitCost)}</strong></span>
                    </div>
                  </div>
                  {isOwner && (
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => startEdit(part)}
                        className="h-8 w-8"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setDeleteTarget(part);
                          setDeleteError(null);
                        }}
                        className="h-8 w-8 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        )}
      </main>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Part</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{' '}
              <strong>{deleteTarget?.name}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{deleteError}</AlertDescription>
            </Alert>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deletePart.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletePart.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
