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

  const handleEditSubmit = async (e: React.FormEvent, part: Part) => {
    e.preventDefault();
    setEditError(null);

    if (!editForm.name.trim()) {
      setEditError('Part name is required.');
      return;
    }

    try {
      const updated: Part = {
        ...part,
        name: editForm.name.trim(),
        partNumber: editForm.partNumber.trim(),
        description: editForm.description.trim(),
        quantityOnHand: BigInt(parseInt(editForm.quantityOnHand, 10) || 0),
        unitCost: BigInt(parseInt(editForm.unitCost, 10) || 0),
      };
      await updatePart.mutateAsync(updated);
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

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <Package className="h-5 w-5" />
          Inventory
        </h1>
        {isOwner && (
          <Button size="sm" onClick={() => { setShowAddForm(true); setAddError(null); setAddForm(emptyForm()); }}>
            <Plus className="h-4 w-4 mr-1" /> Add Part
          </Button>
        )}
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {deleteError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{deleteError}</AlertDescription>
          </Alert>
        )}

        {/* Add Form */}
        {showAddForm && isOwner && (
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <h2 className="font-semibold text-sm">New Part</h2>
            {addError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{addError}</AlertDescription>
              </Alert>
            )}
            <form onSubmit={handleAddSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Name *</Label>
                  <Input
                    className="mt-1"
                    value={addForm.name}
                    onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                    placeholder="Part name"
                  />
                </div>
                <div>
                  <Label>Part #</Label>
                  <Input
                    className="mt-1"
                    value={addForm.partNumber}
                    onChange={(e) => setAddForm({ ...addForm, partNumber: e.target.value })}
                    placeholder="SKU / Part number"
                  />
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <Input
                  className="mt-1"
                  value={addForm.description}
                  onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
                  placeholder="Optional description"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Qty on Hand</Label>
                  <Input
                    className="mt-1"
                    type="number"
                    min="0"
                    value={addForm.quantityOnHand}
                    onChange={(e) => setAddForm({ ...addForm, quantityOnHand: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Unit Cost (¢)</Label>
                  <Input
                    className="mt-1"
                    type="number"
                    min="0"
                    value={addForm.unitCost}
                    onChange={(e) => setAddForm({ ...addForm, unitCost: e.target.value })}
                    placeholder="In cents"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={createPart.isPending} className="flex-1">
                  {createPart.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                  Save
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setShowAddForm(false)} className="flex-1">
                  <X className="h-4 w-4 mr-1" /> Cancel
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Parts List */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : parts.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No parts in inventory</p>
            {isOwner && <p className="text-sm mt-1">Click "Add Part" to get started</p>}
          </div>
        ) : (
          <div className="space-y-3">
            {parts.map((part) =>
              editingId === part.id ? (
                <div key={part.id.toString()} className="bg-card border border-primary/40 rounded-xl p-4 space-y-3">
                  <h2 className="font-semibold text-sm">Edit Part</h2>
                  {editError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{editError}</AlertDescription>
                    </Alert>
                  )}
                  <form onSubmit={(e) => handleEditSubmit(e, part)} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Name *</Label>
                        <Input
                          className="mt-1"
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Part #</Label>
                        <Input
                          className="mt-1"
                          value={editForm.partNumber}
                          onChange={(e) => setEditForm({ ...editForm, partNumber: e.target.value })}
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Input
                        className="mt-1"
                        value={editForm.description}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Qty on Hand</Label>
                        <Input
                          className="mt-1"
                          type="number"
                          min="0"
                          value={editForm.quantityOnHand}
                          onChange={(e) => setEditForm({ ...editForm, quantityOnHand: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Unit Cost (¢)</Label>
                        <Input
                          className="mt-1"
                          type="number"
                          min="0"
                          value={editForm.unitCost}
                          onChange={(e) => setEditForm({ ...editForm, unitCost: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" size="sm" disabled={updatePart.isPending} className="flex-1">
                        {updatePart.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                        Save
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={cancelEdit} className="flex-1">
                        <X className="h-4 w-4 mr-1" /> Cancel
                      </Button>
                    </div>
                  </form>
                </div>
              ) : (
                <div key={part.id.toString()} className="bg-card border border-border rounded-xl px-4 py-3 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{part.name}</p>
                      {part.partNumber && (
                        <Badge variant="outline" className="text-xs font-mono">
                          {part.partNumber}
                        </Badge>
                      )}
                      {part.jobId !== undefined && (
                        <Badge variant="secondary" className="text-xs">
                          On Job #{part.jobId.toString()}
                        </Badge>
                      )}
                    </div>
                    {part.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{part.description}</p>
                    )}
                    <div className="flex gap-4 mt-1">
                      <span className="text-xs text-muted-foreground">
                        Qty: <span className="font-medium text-foreground">{part.quantityOnHand.toString()}</span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Cost: <span className="font-medium text-foreground">${(Number(part.unitCost) / 100).toFixed(2)}</span>
                      </span>
                    </div>
                  </div>
                  {isOwner && (
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(part)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => { setDeleteTarget(part); setDeleteError(null); }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Part</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletePart.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
