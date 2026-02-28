import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  useIsOwner,
  useListParts,
  useCreatePart,
  useUpdatePart,
  useDeletePart,
} from '../hooks/useQueries';
import type { Part } from '../backend';
import {
  Package,
  Plus,
  Search,
  AlertTriangle,
  Pencil,
  Trash2,
  X,
  Loader2,
  Check,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
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

interface PartFormState {
  name: string;
  partNumber: string;
  description: string;
  quantityOnHand: string;
  unitCost: string;
}

const emptyPartForm: PartFormState = {
  name: '',
  partNumber: '',
  description: '',
  quantityOnHand: '0',
  unitCost: '0',
};

const LOW_STOCK_THRESHOLD = 3;

export default function InventoryPage() {
  const isOwner = useIsOwner();
  const { data: parts, isLoading: partsLoading } = useListParts();
  const createPart = useCreatePart();
  const updatePart = useUpdatePart();
  const deletePart = useDeletePart();

  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<PartFormState>(emptyPartForm);
  const [editingId, setEditingId] = useState<bigint | null>(null);
  const [editForm, setEditForm] = useState<PartFormState>(emptyPartForm);

  const getNextId = (): bigint => {
    if (!parts || parts.length === 0) return BigInt(1);
    const maxId = parts.reduce((max, p) => (p.id > max ? p.id : max), BigInt(0));
    return maxId + BigInt(1);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.name.trim()) return;
    const newPart: Part = {
      id: getNextId(),
      name: addForm.name.trim(),
      partNumber: addForm.partNumber.trim(),
      description: addForm.description.trim(),
      quantityOnHand: BigInt(Math.max(0, parseInt(addForm.quantityOnHand) || 0)),
      unitCost: BigInt(Math.round(parseFloat(addForm.unitCost || '0') * 100)),
      jobId: undefined,
    };
    try {
      await createPart.mutateAsync(newPart);
      setAddForm(emptyPartForm);
      setShowAddForm(false);
    } catch (err) {
      console.error('Failed to create part:', err);
    }
  };

  const handleEditStart = (part: Part) => {
    setEditingId(part.id);
    setEditForm({
      name: part.name,
      partNumber: part.partNumber,
      description: part.description,
      quantityOnHand: part.quantityOnHand.toString(),
      unitCost: (Number(part.unitCost) / 100).toFixed(2),
    });
  };

  const handleEditSave = async (part: Part) => {
    if (!editForm.name.trim()) return;
    const updated: Part = {
      id: part.id,
      name: editForm.name.trim(),
      partNumber: editForm.partNumber.trim(),
      description: editForm.description.trim(),
      quantityOnHand: BigInt(Math.max(0, parseInt(editForm.quantityOnHand) || 0)),
      unitCost: BigInt(Math.round(parseFloat(editForm.unitCost || '0') * 100)),
      jobId: part.jobId,
    };
    try {
      await updatePart.mutateAsync(updated);
      setEditingId(null);
    } catch (err) {
      console.error('Failed to update part:', err);
    }
  };

  const handleDelete = async (partId: bigint) => {
    try {
      await deletePart.mutateAsync(partId);
    } catch (err) {
      console.error('Failed to delete part:', err);
    }
  };

  const filtered = (parts ?? []).filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.partNumber.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase())
  );

  const totalParts = parts?.length ?? 0;
  const lowStockCount = (parts ?? []).filter(
    (p) => Number(p.quantityOnHand) <= LOW_STOCK_THRESHOLD
  ).length;

  return (
    <div className="px-4 py-5 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package size={20} className="text-primary" />
          <h2 className="font-display font-bold text-xl text-foreground">Inventory</h2>
        </div>
        {isOwner && (
          <Button
            size="sm"
            className="rounded-xl bg-primary text-primary-foreground gap-1.5 text-xs h-8 px-3"
            onClick={() => setShowAddForm(true)}
          >
            <Plus size={14} />
            Add Part
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      {partsLoading ? (
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card rounded-2xl border border-border p-4 text-center shadow-card">
            <p className="text-3xl font-display font-bold text-foreground">{totalParts}</p>
            <p className="text-xs text-muted-foreground mt-1 font-medium">Total Parts</p>
          </div>
          <div
            className={`rounded-2xl border p-4 text-center shadow-card ${
              lowStockCount > 0
                ? 'bg-destructive/10 border-destructive/30'
                : 'bg-card border-border'
            }`}
          >
            <p
              className={`text-3xl font-display font-bold ${
                lowStockCount > 0 ? 'text-destructive' : 'text-foreground'
              }`}
            >
              {lowStockCount}
            </p>
            <p className="text-xs text-muted-foreground mt-1 font-medium">Low Stock</p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search parts by name, part number…"
          className="pl-9 rounded-xl h-10 text-sm"
        />
      </div>

      {/* Add Part Form */}
      {isOwner && showAddForm && (
        <form
          onSubmit={handleAdd}
          className="bg-muted/50 rounded-2xl border border-border p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">New Part</p>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => { setShowAddForm(false); setAddForm(emptyPartForm); }}
              className="h-7 w-7 rounded-lg"
            >
              <X size={14} />
            </Button>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Name *</Label>
            <Input
              value={addForm.name}
              onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Water Inlet Valve"
              className="rounded-xl text-sm h-9"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Part Number</Label>
              <Input
                value={addForm.partNumber}
                onChange={(e) => setAddForm((p) => ({ ...p, partNumber: e.target.value }))}
                placeholder="e.g. WH13X10024"
                className="rounded-xl text-sm h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Qty on Hand</Label>
              <Input
                type="number"
                min="0"
                value={addForm.quantityOnHand}
                onChange={(e) => setAddForm((p) => ({ ...p, quantityOnHand: e.target.value }))}
                className="rounded-xl text-sm h-9"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Unit Cost ($)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={addForm.unitCost}
              onChange={(e) => setAddForm((p) => ({ ...p, unitCost: e.target.value }))}
              placeholder="0.00"
              className="rounded-xl text-sm h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Description</Label>
            <Input
              value={addForm.description}
              onChange={(e) => setAddForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Optional description"
              className="rounded-xl text-sm h-9"
            />
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={createPart.isPending || !addForm.name.trim()}
            className="w-full rounded-xl bg-primary text-primary-foreground text-xs h-9"
          >
            {createPart.isPending ? (
              <Loader2 size={13} className="animate-spin mr-1" />
            ) : (
              <Plus size={13} className="mr-1" />
            )}
            Add Part
          </Button>
        </form>
      )}

      {/* Parts List */}
      {partsLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-8 text-center">
          <Package size={36} className="text-muted-foreground mx-auto mb-3" />
          <p className="font-semibold text-foreground text-sm">No parts found</p>
          <p className="text-muted-foreground text-xs mt-1">
            {search
              ? 'Try a different search term.'
              : 'Add your first part to get started.'}
          </p>
          {isOwner && !search && (
            <Button
              size="sm"
              className="mt-4 rounded-xl bg-primary text-primary-foreground gap-1.5 text-xs"
              onClick={() => setShowAddForm(true)}
            >
              <Plus size={14} />
              Add First Part
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((part) => {
            const isLowStock = Number(part.quantityOnHand) <= LOW_STOCK_THRESHOLD;
            const unitCostDollars = (Number(part.unitCost) / 100).toFixed(2);
            return (
              <div
                key={part.id.toString()}
                className="bg-card rounded-xl border border-border p-3"
              >
                {editingId === part.id ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        value={editForm.name}
                        onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                        className="rounded-lg text-sm h-8"
                        placeholder="Part name"
                      />
                      <Input
                        value={editForm.partNumber}
                        onChange={(e) => setEditForm((p) => ({ ...p, partNumber: e.target.value }))}
                        className="rounded-lg text-sm h-8"
                        placeholder="Part number"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="number"
                        min="0"
                        value={editForm.quantityOnHand}
                        onChange={(e) => setEditForm((p) => ({ ...p, quantityOnHand: e.target.value }))}
                        className="rounded-lg text-sm h-8"
                        placeholder="Qty"
                      />
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editForm.unitCost}
                        onChange={(e) => setEditForm((p) => ({ ...p, unitCost: e.target.value }))}
                        className="rounded-lg text-sm h-8"
                        placeholder="Cost $"
                      />
                    </div>
                    <Input
                      value={editForm.description}
                      onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                      className="rounded-lg text-sm h-8"
                      placeholder="Description"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleEditSave(part)}
                        disabled={updatePart.isPending}
                        className="flex-1 rounded-lg h-7 text-xs bg-primary text-primary-foreground"
                      >
                        {updatePart.isPending ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Check size={12} className="mr-1" />
                        )}
                        Save
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingId(null)}
                        className="rounded-lg h-7 text-xs px-2"
                      >
                        <X size={12} />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        isLowStock ? 'bg-destructive/10' : 'bg-primary/10'
                      }`}
                    >
                      {isLowStock ? (
                        <AlertTriangle size={16} className="text-destructive" />
                      ) : (
                        <Package size={16} className="text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">{part.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {part.partNumber ? `#${part.partNumber}` : 'No part number'}
                        {part.description ? ` · ${part.description}` : ''}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Cost: ${unitCostDollars}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-sm font-bold text-foreground">
                        {part.quantityOnHand.toString()}
                      </span>
                      {isLowStock ? (
                        <Badge variant="destructive" className="text-xs px-1.5 py-0 h-4">
                          Low Stock
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4">
                          In Stock
                        </Badge>
                      )}
                      {isOwner && (
                        <div className="flex items-center gap-1 mt-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditStart(part)}
                            className="h-6 w-6 rounded-md text-muted-foreground hover:text-foreground"
                          >
                            <Pencil size={11} />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 rounded-md text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 size={11} />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="rounded-2xl mx-4">
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Part</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete <strong>{part.name}</strong>? This cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(part.id)}
                                  className="bg-destructive text-destructive-foreground rounded-xl"
                                >
                                  {deletePart.isPending ? (
                                    <Loader2 className="animate-spin" size={14} />
                                  ) : (
                                    'Delete'
                                  )}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <footer className="pt-2 pb-4 text-center">
        <p className="text-muted-foreground text-xs">
          Built with ❤️ using{' '}
          <a
            href={`https://caffeine.ai/?utm_source=Caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary font-medium"
          >
            caffeine.ai
          </a>{' '}
          · © {new Date().getFullYear()} Reliable Home Appliance Repair LLC
        </p>
      </footer>
    </div>
  );
}
