import React, { useState } from 'react';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import {
  useListLaborRates,
  useCreateLaborRate,
  useUpdateLaborRate,
  useDeleteLaborRate,
  useIsStripeConfigured,
  useSetStripeConfiguration,
  useGetCallerUserProfile,
  useAssignUserRole,
} from '../hooks/useQueries';
import { RateType, UserRole } from '../backend';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Trash2, Settings, CreditCard, DollarSign, Users, UserPlus, X } from 'lucide-react';
import { Principal } from '@dfinity/principal';

const OWNER_PRINCIPAL = 'q5rzs-s67ph-qtb5w-e66j5-2iqax-vlwa5-5pqxy-yosti-xhcis-ocfw6-yqe';

export default function SettingsPage() {
  const { identity } = useInternetIdentity();
  const isOwner = identity?.getPrincipal().toString() === OWNER_PRINCIPAL;

  const { data: userProfile } = useGetCallerUserProfile();
  const { data: laborRates = [], isLoading: ratesLoading } = useListLaborRates();
  const { data: stripeConfigured } = useIsStripeConfigured();

  const createRate = useCreateLaborRate();
  const updateRate = useUpdateLaborRate();
  const deleteRate = useDeleteLaborRate();
  const setStripeConfig = useSetStripeConfiguration();
  const assignRole = useAssignUserRole();

  // Labor rate form
  const [newRateName, setNewRateName] = useState('');
  const [newRateType, setNewRateType] = useState<RateType>(RateType.hourly);
  const [newRateAmount, setNewRateAmount] = useState('');
  const [rateError, setRateError] = useState('');

  // Stripe form
  const [stripeKey, setStripeKey] = useState('');
  const [stripeError, setStripeError] = useState('');
  const [stripeSaved, setStripeSaved] = useState(false);

  // Authorized users
  const [newPrincipal, setNewPrincipal] = useState('');
  const [authorizedUsers, setAuthorizedUsers] = useState<string[]>([]);
  const [userError, setUserError] = useState('');
  const [addingUser, setAddingUser] = useState(false);

  const handleAddRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRateName || !newRateAmount) { setRateError('Name and amount are required'); return; }
    setRateError('');
    try {
      const maxId = laborRates.reduce((max, r) => (r.id > max ? r.id : max), BigInt(0));
      const newId = maxId + BigInt(1);
      await createRate.mutateAsync({
        id: newId,
        name: newRateName,
        rateType: newRateType,
        amount: BigInt(Math.round(parseFloat(newRateAmount) * 100)),
      });
      setNewRateName('');
      setNewRateAmount('');
    } catch (e: unknown) {
      setRateError(e instanceof Error ? e.message : 'Failed to add rate');
    }
  };

  const handleDeleteRate = async (id: bigint) => {
    try {
      await deleteRate.mutateAsync(id);
    } catch (e: unknown) {
      setRateError(e instanceof Error ? e.message : 'Failed to delete rate');
    }
  };

  const handleSaveStripe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripeKey) { setStripeError('Stripe secret key is required'); return; }
    setStripeError('');
    try {
      await setStripeConfig.mutateAsync({ secretKey: stripeKey, allowedCountries: ['US'] });
      setStripeSaved(true);
      setStripeKey('');
      setTimeout(() => setStripeSaved(false), 3000);
    } catch (e: unknown) {
      setStripeError(e instanceof Error ? e.message : 'Failed to save Stripe configuration');
    }
  };

  const handleAddUser = async () => {
    if (!newPrincipal.trim()) { setUserError('Please enter a principal ID'); return; }
    setUserError('');
    setAddingUser(true);
    try {
      const user = Principal.fromText(newPrincipal.trim());
      await assignRole.mutateAsync({ user, role: UserRole.user });
      setAuthorizedUsers((prev) => [...prev, newPrincipal.trim()]);
      setNewPrincipal('');
    } catch (e: unknown) {
      setUserError(e instanceof Error ? e.message : 'Failed to add user. Make sure the principal ID is valid.');
    } finally {
      setAddingUser(false);
    }
  };

  const handleRemoveUser = async (principalStr: string) => {
    try {
      const user = Principal.fromText(principalStr);
      await assignRole.mutateAsync({ user, role: UserRole.guest });
      setAuthorizedUsers((prev) => prev.filter((p) => p !== principalStr));
    } catch (e: unknown) {
      setUserError(e instanceof Error ? e.message : 'Failed to remove user');
    }
  };

  // suppress unused warning for updateRate
  void updateRate;

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 bg-card border-b border-border px-4 py-3">
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Settings
        </h1>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Profile */}
        <Card>
          <CardHeader><CardTitle className="text-base">Profile</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-primary font-bold text-sm">
                  {userProfile?.name?.charAt(0)?.toUpperCase() ?? '?'}
                </span>
              </div>
              <div>
                <p className="font-medium">{userProfile?.name ?? 'Unknown'}</p>
                <p className="text-xs text-muted-foreground font-mono">
                  {identity?.getPrincipal().toString().slice(0, 20)}…
                </p>
              </div>
              {isOwner && <Badge variant="default" className="ml-auto bg-primary">Owner</Badge>}
            </div>
          </CardContent>
        </Card>

        {/* Labor Rates — owner only */}
        {isOwner && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Labor Rates
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {ratesLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : laborRates.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2">No labor rates configured</p>
              ) : (
                <div className="space-y-2">
                  {laborRates.map((rate) => (
                    <div key={rate.id.toString()} className="flex items-center justify-between bg-muted/40 rounded-lg px-3 py-2">
                      <div>
                        <p className="font-medium text-sm">{rate.name}</p>
                        <p className="text-xs text-muted-foreground">
                          ${(Number(rate.amount) / 100).toFixed(2)} / {rate.rateType === RateType.hourly ? 'hr' : 'flat'}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteRate(rate.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <Separator />
              <form onSubmit={handleAddRate} className="space-y-3">
                <p className="text-sm font-medium">Add Labor Rate</p>
                {rateError && <p className="text-xs text-destructive">{rateError}</p>}
                <Input placeholder="Rate name (e.g. Standard Hourly)" value={newRateName} onChange={(e) => setNewRateName(e.target.value)} />
                <div className="grid grid-cols-2 gap-2">
                  <Select value={newRateType} onValueChange={(v) => setNewRateType(v as RateType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={RateType.hourly}>Hourly</SelectItem>
                      <SelectItem value={RateType.flat}>Flat Rate</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input placeholder="Amount ($)" type="number" step="0.01" value={newRateAmount} onChange={(e) => setNewRateAmount(e.target.value)} />
                </div>
                <Button type="submit" size="sm" className="w-full" disabled={createRate.isPending}>
                  {createRate.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                  Add Rate
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Stripe Configuration — owner only */}
        {isOwner && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Stripe Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-sm">Status:</span>
                <Badge variant={stripeConfigured ? 'default' : 'outline'} className={stripeConfigured ? 'bg-green-600 text-white' : ''}>
                  {stripeConfigured ? 'Configured' : 'Not Configured'}
                </Badge>
              </div>
              <form onSubmit={handleSaveStripe} className="space-y-3">
                {stripeError && <p className="text-xs text-destructive">{stripeError}</p>}
                <div>
                  <Label>Stripe Secret Key</Label>
                  <Input
                    className="mt-1"
                    type="password"
                    placeholder="sk_live_... or sk_test_..."
                    value={stripeKey}
                    onChange={(e) => setStripeKey(e.target.value)}
                  />
                </div>
                <Button type="submit" size="sm" className="w-full" disabled={setStripeConfig.isPending}>
                  {setStripeConfig.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  {stripeSaved ? '✓ Saved!' : stripeConfigured ? 'Update Stripe Key' : 'Save Stripe Key'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Authorized Users — owner only */}
        {isOwner && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Authorized Users
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/50 rounded-lg px-3 py-2">
                <p className="text-xs text-muted-foreground">
                  Add a user's Internet Identity principal here to grant them full access to the app (create/edit/view clients, jobs, and inventory). To find Ryan's principal, have him log in and share his principal ID from the profile section.
                </p>
              </div>

              {userError && <p className="text-xs text-destructive">{userError}</p>}

              {authorizedUsers.length > 0 && (
                <div className="space-y-2">
                  {authorizedUsers.map((p) => (
                    <div key={p} className="flex items-center justify-between bg-muted/40 rounded-lg px-3 py-2">
                      <p className="text-xs font-mono truncate flex-1 mr-2">{p}</p>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveUser(p)}
                        className="shrink-0"
                      >
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                <Label>Principal ID</Label>
                <Input
                  placeholder="Paste Internet Identity principal (e.g. xxxxx-xxxxx-...)"
                  value={newPrincipal}
                  onChange={(e) => setNewPrincipal(e.target.value)}
                  className="font-mono text-xs"
                />
                <Button
                  onClick={handleAddUser}
                  disabled={addingUser || !newPrincipal.trim()}
                  className="w-full"
                  size="sm"
                >
                  {addingUser ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <UserPlus className="h-4 w-4 mr-1" />}
                  Add Authorized User
                </Button>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  <strong>For Ryan:</strong> Have Ryan log in with his Internet Identity, then go to Settings and copy his principal ID. Paste it above to grant him full CRUD access to clients, jobs, and inventory.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground py-4">
          <p>© {new Date().getFullYear()} Reliable Home Appliance Repair LLC</p>
          <p className="mt-1">
            Built with ❤️ using{' '}
            <a
              href={`https://caffeine.ai/?utm_source=Caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              caffeine.ai
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
