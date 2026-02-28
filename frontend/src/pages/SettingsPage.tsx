import { useState } from 'react';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import {
  useIsCallerAdmin,
  useIsOwner,
  useAssignUserRole,
  useGetCallerUserProfile,
  useListLaborRates,
  useCreateLaborRate,
  useUpdateLaborRate,
  useDeleteLaborRate,
} from '../hooks/useQueries';
import { UserRole, RateType } from '../backend';
import type { LaborRate } from '../backend';
import { Principal } from '@dfinity/principal';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Shield,
  ShieldAlert,
  UserPlus,
  LogOut,
  Copy,
  Check,
  Loader2,
  Settings,
  DollarSign,
  Plus,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';

function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center animate-fade-in">
      <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
        <ShieldAlert size={28} className="text-destructive" />
      </div>
      <h3 className="font-display font-bold text-lg text-foreground">Access Restricted</h3>
      <p className="text-muted-foreground text-sm mt-2 max-w-xs">
        Settings are only accessible to administrators. Contact your system owner to request access.
      </p>
    </div>
  );
}

interface LaborRateFormState {
  name: string;
  rateType: RateType;
  amount: string;
}

const emptyRateForm: LaborRateFormState = {
  name: '',
  rateType: RateType.hourly,
  amount: '',
};

function LaborRatesSection() {
  const { data: laborRates, isLoading } = useListLaborRates();
  const createLaborRate = useCreateLaborRate();
  const updateLaborRate = useUpdateLaborRate();
  const deleteLaborRate = useDeleteLaborRate();

  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<LaborRateFormState>(emptyRateForm);
  const [editingId, setEditingId] = useState<bigint | null>(null);
  const [editForm, setEditForm] = useState<LaborRateFormState>(emptyRateForm);

  const getNextId = (): bigint => {
    if (!laborRates || laborRates.length === 0) return BigInt(1);
    const maxId = laborRates.reduce((max, r) => (r.id > max ? r.id : max), BigInt(0));
    return maxId + BigInt(1);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.name.trim() || !addForm.amount) return;
    const amountCents = Math.round(parseFloat(addForm.amount) * 100);
    const newRate: LaborRate = {
      id: getNextId(),
      name: addForm.name.trim(),
      rateType: addForm.rateType,
      amount: BigInt(amountCents),
    };
    try {
      await createLaborRate.mutateAsync(newRate);
      setAddForm(emptyRateForm);
      setShowAddForm(false);
    } catch (err) {
      console.error('Failed to create labor rate:', err);
    }
  };

  const handleEditStart = (rate: LaborRate) => {
    setEditingId(rate.id);
    setEditForm({
      name: rate.name,
      rateType: rate.rateType,
      amount: (Number(rate.amount) / 100).toFixed(2),
    });
  };

  const handleEditSave = async (rate: LaborRate) => {
    if (!editForm.name.trim() || !editForm.amount) return;
    const amountCents = Math.round(parseFloat(editForm.amount) * 100);
    const updated: LaborRate = {
      id: rate.id,
      name: editForm.name.trim(),
      rateType: editForm.rateType,
      amount: BigInt(amountCents),
    };
    try {
      await updateLaborRate.mutateAsync(updated);
      setEditingId(null);
    } catch (err) {
      console.error('Failed to update labor rate:', err);
    }
  };

  const handleDelete = async (rateId: bigint) => {
    try {
      await deleteLaborRate.mutateAsync(rateId);
    } catch (err) {
      console.error('Failed to delete labor rate:', err);
    }
  };

  const formatAmount = (amount: bigint, rateType: RateType) => {
    const dollars = (Number(amount) / 100).toFixed(2);
    return rateType === RateType.hourly ? `$${dollars}/hr` : `$${dollars} flat`;
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign size={16} className="text-primary" />
          <h3 className="font-semibold text-sm text-foreground">Labor Rates</h3>
        </div>
        {!showAddForm && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAddForm(true)}
            className="h-7 px-2 text-xs text-primary hover:text-primary rounded-lg"
          >
            <Plus size={13} className="mr-1" />
            Add Rate
          </Button>
        )}
      </div>

      <p className="text-muted-foreground text-xs">
        Define labor rates for estimates and invoices. Amounts are in US dollars.
      </p>

      {/* Add Form */}
      {showAddForm && (
        <form onSubmit={handleAdd} className="bg-muted/50 rounded-xl p-3 space-y-3 border border-border">
          <p className="text-xs font-semibold text-foreground">New Labor Rate</p>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Name</Label>
            <Input
              value={addForm.name}
              onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Standard Repair, Diagnostic Fee"
              className="rounded-xl text-sm h-9"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Type</Label>
              <Select
                value={addForm.rateType}
                onValueChange={(val) => setAddForm((p) => ({ ...p, rateType: val as RateType }))}
              >
                <SelectTrigger className="rounded-xl h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={RateType.hourly}>Hourly</SelectItem>
                  <SelectItem value={RateType.flat}>Flat</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Amount ($)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={addForm.amount}
                onChange={(e) => setAddForm((p) => ({ ...p, amount: e.target.value }))}
                placeholder="0.00"
                className="rounded-xl text-sm h-9"
                required
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              type="submit"
              size="sm"
              disabled={createLaborRate.isPending || !addForm.name.trim() || !addForm.amount}
              className="flex-1 rounded-xl bg-primary text-primary-foreground text-xs h-8"
            >
              {createLaborRate.isPending ? (
                <Loader2 size={13} className="animate-spin mr-1" />
              ) : (
                <Plus size={13} className="mr-1" />
              )}
              Add Rate
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => { setShowAddForm(false); setAddForm(emptyRateForm); }}
              className="rounded-xl text-xs h-8 px-3"
            >
              <X size={13} />
            </Button>
          </div>
        </form>
      )}

      {/* Rates List */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(2)].map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-xl" />
          ))}
        </div>
      ) : !laborRates || laborRates.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-muted-foreground text-xs">No labor rates defined yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {laborRates.map((rate) => (
            <div key={rate.id.toString()} className="rounded-xl border border-border bg-background p-3">
              {editingId === rate.id ? (
                <div className="space-y-2">
                  <div className="space-y-1">
                    <Input
                      value={editForm.name}
                      onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                      className="rounded-lg text-sm h-8"
                      placeholder="Rate name"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      value={editForm.rateType}
                      onValueChange={(val) => setEditForm((p) => ({ ...p, rateType: val as RateType }))}
                    >
                      <SelectTrigger className="rounded-lg h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={RateType.hourly}>Hourly</SelectItem>
                        <SelectItem value={RateType.flat}>Flat</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editForm.amount}
                      onChange={(e) => setEditForm((p) => ({ ...p, amount: e.target.value }))}
                      className="rounded-lg text-sm h-8"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleEditSave(rate)}
                      disabled={updateLaborRate.isPending}
                      className="flex-1 rounded-lg h-7 text-xs bg-primary text-primary-foreground"
                    >
                      {updateLaborRate.isPending ? <Loader2 size={12} className="animate-spin" /> : 'Save'}
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
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{rate.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4">
                        {rate.rateType === RateType.hourly ? 'Hourly' : 'Flat'}
                      </Badge>
                      <span className="text-xs text-primary font-semibold">
                        {formatAmount(rate.amount, rate.rateType)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditStart(rate)}
                      className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                    >
                      <Pencil size={13} />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 size={13} />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-2xl mx-4">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Labor Rate</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete <strong>{rate.name}</strong>? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(rate.id)}
                            className="bg-destructive text-destructive-foreground rounded-xl"
                          >
                            {deleteLaborRate.isPending ? <Loader2 className="animate-spin" size={14} /> : 'Delete'}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { identity, clear } = useInternetIdentity();
  const queryClient = useQueryClient();
  const { data: isAdmin, isLoading: adminLoading } = useIsCallerAdmin();
  const { data: profile } = useGetCallerUserProfile();
  const isOwner = useIsOwner();
  const assignRole = useAssignUserRole();

  const [newPrincipal, setNewPrincipal] = useState('');
  const [newRole, setNewRole] = useState<UserRole>(UserRole.user);
  const [copied, setCopied] = useState(false);
  const [assignError, setAssignError] = useState('');

  const principalStr = identity?.getPrincipal().toString() ?? '';

  // Owner always has access; admins also have access
  const hasAccess = isOwner || isAdmin;

  const handleCopyPrincipal = () => {
    navigator.clipboard.writeText(principalStr).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleLogout = async () => {
    await clear();
    queryClient.clear();
  };

  const handleAssignRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setAssignError('');
    if (!newPrincipal.trim()) return;

    try {
      const principal = Principal.fromText(newPrincipal.trim());
      await assignRole.mutateAsync({ user: principal, role: newRole });
      setNewPrincipal('');
    } catch (err: unknown) {
      const error = err as Error;
      if (error?.message?.includes('Invalid principal')) {
        setAssignError('Invalid principal ID format.');
      } else {
        setAssignError('Failed to assign role. Make sure you have admin permissions.');
      }
    }
  };

  if (adminLoading && !isOwner) {
    return (
      <div className="px-4 py-5 space-y-4">
        <Skeleton className="h-8 w-32 rounded-xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="px-4 py-5 animate-fade-in">
        <div className="flex items-center gap-2 mb-5">
          <Settings size={20} className="text-primary" />
          <h2 className="font-display font-bold text-xl text-foreground">Settings</h2>
        </div>
        <AccessDenied />
      </div>
    );
  }

  return (
    <div className="px-4 py-5 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Settings size={20} className="text-primary" />
        <h2 className="font-display font-bold text-xl text-foreground">Settings</h2>
      </div>

      {/* Profile Card */}
      <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shrink-0">
            <span className="text-primary-foreground font-bold text-sm">
              {profile?.name?.charAt(0)?.toUpperCase() ?? '?'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground">{profile?.name ?? 'Unknown'}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              {isOwner ? (
                <Badge className="text-xs bg-primary text-primary-foreground gap-1">
                  <Shield size={10} />
                  Owner
                </Badge>
              ) : isAdmin ? (
                <Badge className="text-xs bg-primary text-primary-foreground gap-1">
                  <Shield size={10} />
                  Admin
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs gap-1">
                  <Shield size={10} />
                  Authorized
                </Badge>
              )}
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium">Your Principal ID</p>
          <div className="flex items-center gap-2">
            <p className="text-xs font-mono text-foreground bg-muted rounded-lg px-2 py-1.5 flex-1 truncate">
              {principalStr || '—'}
            </p>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCopyPrincipal}
              className="h-8 w-8 rounded-lg shrink-0"
              disabled={!principalStr}
            >
              {copied ? <Check size={14} className="text-primary" /> : <Copy size={14} />}
            </Button>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleLogout}
          className="w-full rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive text-xs h-8"
        >
          <LogOut size={13} className="mr-1.5" />
          Log Out
        </Button>
      </div>

      {/* Labor Rates — Owner Only */}
      {isOwner && <LaborRatesSection />}

      {/* Role Assignment — Owner & Admin */}
      {(isOwner || isAdmin) && (
        <div className="bg-card rounded-2xl border border-border p-4 space-y-4">
          <div className="flex items-center gap-2">
            <UserPlus size={16} className="text-primary" />
            <h3 className="font-semibold text-sm text-foreground">Assign User Role</h3>
          </div>
          <p className="text-muted-foreground text-xs">
            Grant access to team members by assigning them a role using their principal ID.
          </p>
          <form onSubmit={handleAssignRole} className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Principal ID</Label>
              <Input
                value={newPrincipal}
                onChange={(e) => setNewPrincipal(e.target.value)}
                placeholder="e.g. aaaaa-aa..."
                className="rounded-xl text-sm h-9 font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Role</Label>
              <Select
                value={newRole}
                onValueChange={(val) => setNewRole(val as UserRole)}
              >
                <SelectTrigger className="rounded-xl h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UserRole.user}>User</SelectItem>
                  <SelectItem value={UserRole.admin}>Admin</SelectItem>
                  <SelectItem value={UserRole.guest}>Guest</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {assignError && (
              <p className="text-destructive text-xs">{assignError}</p>
            )}
            <Button
              type="submit"
              size="sm"
              disabled={assignRole.isPending || !newPrincipal.trim()}
              className="w-full rounded-xl bg-primary text-primary-foreground text-xs h-9"
            >
              {assignRole.isPending ? (
                <Loader2 size={13} className="animate-spin mr-1.5" />
              ) : (
                <UserPlus size={13} className="mr-1.5" />
              )}
              Assign Role
            </Button>
            {assignRole.isSuccess && (
              <p className="text-primary text-xs text-center flex items-center justify-center gap-1">
                <Check size={12} /> Role assigned successfully.
              </p>
            )}
          </form>
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
          </a>
          {' '}· © {new Date().getFullYear()} Reliable Home Appliance Repair LLC
        </p>
      </footer>
    </div>
  );
}
