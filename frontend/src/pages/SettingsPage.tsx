import React, { useState } from 'react';
import { Settings, Plus, Trash2, Edit2, Check, X, Shield, CreditCard, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  useListLaborRates,
  useCreateLaborRate,
  useUpdateLaborRate,
  useDeleteLaborRate,
  useIsStripeConfigured,
  useSetStripeConfiguration,
} from '../hooks/useQueries';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { useQueryClient } from '@tanstack/react-query';
import { RateType } from '../backend';
import type { LaborRate } from '../backend';

// IMPORTANT: This is the stable owner principal. Do NOT change this value.
// Owner: q5rzs-s67ph-qtb5w-e66j5-2iqax-vlwa5-5pqxy-yosti-xhcis-ocfw6-yqe
const OWNER_PRINCIPAL = 'q5rzs-s67ph-qtb5w-e66j5-2iqax-vlwa5-5pqxy-yosti-xhcis-ocfw6-yqe';

export default function SettingsPage() {
  const { identity, clear } = useInternetIdentity();
  const queryClient = useQueryClient();
  const isOwner = identity?.getPrincipal().toString() === OWNER_PRINCIPAL;

  const { data: laborRates = [], isLoading: ratesLoading } = useListLaborRates();
  const { data: stripeConfigured } = useIsStripeConfigured();
  const createLaborRate = useCreateLaborRate();
  const updateLaborRate = useUpdateLaborRate();
  const deleteLaborRate = useDeleteLaborRate();
  const setStripeConfiguration = useSetStripeConfiguration();

  // Labor rate form
  const [showAddRate, setShowAddRate] = useState(false);
  const [newRateName, setNewRateName] = useState('');
  const [newRateType, setNewRateType] = useState<RateType>(RateType.hourly);
  const [newRateAmount, setNewRateAmount] = useState('');
  const [editingRateId, setEditingRateId] = useState<string | null>(null);
  const [editRateName, setEditRateName] = useState('');
  const [editRateType, setEditRateType] = useState<RateType>(RateType.hourly);
  const [editRateAmount, setEditRateAmount] = useState('');

  // Stripe form
  const [stripeKey, setStripeKey] = useState('');
  const [stripeCountries, setStripeCountries] = useState('US');
  const [showStripeKey, setShowStripeKey] = useState(false);
  const [stripeSaved, setStripeSaved] = useState(false);
  const [stripeError, setStripeError] = useState('');

  const handleLogout = async () => {
    await clear();
    queryClient.clear();
  };

  const handleAddRate = async () => {
    if (!newRateName || !newRateAmount) return;
    const amountCents = Math.round(parseFloat(newRateAmount) * 100);
    await createLaborRate.mutateAsync({
      id: BigInt(Date.now()),
      name: newRateName,
      rateType: newRateType,
      amount: BigInt(amountCents),
    });
    setNewRateName('');
    setNewRateAmount('');
    setShowAddRate(false);
  };

  const handleEditRate = (rate: LaborRate) => {
    setEditingRateId(rate.id.toString());
    setEditRateName(rate.name);
    setEditRateType(rate.rateType);
    setEditRateAmount((Number(rate.amount) / 100).toFixed(2));
  };

  const handleSaveEdit = async (rate: LaborRate) => {
    const amountCents = Math.round(parseFloat(editRateAmount) * 100);
    await updateLaborRate.mutateAsync({
      ...rate,
      name: editRateName,
      rateType: editRateType,
      amount: BigInt(amountCents),
    });
    setEditingRateId(null);
  };

  const handleDeleteRate = async (rateId: bigint) => {
    await deleteLaborRate.mutateAsync(rateId);
  };

  const handleSaveStripe = async () => {
    setStripeError('');
    if (!stripeKey.trim()) {
      setStripeError('Please enter a Stripe secret key.');
      return;
    }
    const countries = stripeCountries
      .split(',')
      .map(c => c.trim().toUpperCase())
      .filter(Boolean);
    if (countries.length === 0) {
      setStripeError('Please enter at least one allowed country code.');
      return;
    }
    try {
      await setStripeConfiguration.mutateAsync({
        secretKey: stripeKey,
        allowedCountries: countries,
      });
      setStripeSaved(true);
      setStripeKey('');
      setTimeout(() => setStripeSaved(false), 3000);
    } catch (err: any) {
      setStripeError(err.message || 'Failed to save Stripe configuration.');
    }
  };

  const principal = identity?.getPrincipal().toString() ?? '';
  const maskedPrincipal = principal.length > 12
    ? `${principal.slice(0, 6)}...${principal.slice(-6)}`
    : principal;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <Settings className="h-5 w-5 text-primary" />
        <h1 className="font-semibold text-foreground">Settings</h1>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Profile */}
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <h2 className="font-semibold text-foreground">Profile</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Principal ID</p>
              <p className="text-xs font-mono text-foreground">{maskedPrincipal}</p>
            </div>
            {isOwner && (
              <Badge className="bg-primary/10 text-primary border-primary/20">
                <Shield className="h-3 w-3 mr-1" />
                Owner
              </Badge>
            )}
          </div>
          <Button variant="outline" className="w-full" onClick={handleLogout}>
            Logout
          </Button>
        </div>

        {/* Labor Rates (Owner only) */}
        {isOwner && (
          <div className="bg-card rounded-xl border border-border p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-foreground">Labor Rates</h2>
              <Button size="sm" variant="outline" onClick={() => setShowAddRate(!showAddRate)}>
                <Plus className="h-4 w-4 mr-1" />
                Add Rate
              </Button>
            </div>

            {showAddRate && (
              <div className="space-y-2 p-3 bg-muted/30 rounded-lg border border-border">
                <Input
                  placeholder="Rate name"
                  value={newRateName}
                  onChange={e => setNewRateName(e.target.value)}
                  className="h-8 text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Select value={newRateType} onValueChange={(v) => setNewRateType(v as RateType)}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={RateType.hourly}>Hourly</SelectItem>
                      <SelectItem value={RateType.flat}>Flat</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Amount ($)"
                    value={newRateAmount}
                    onChange={e => setNewRateAmount(e.target.value)}
                    type="number"
                    min="0"
                    step="0.01"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAddRate} disabled={createLaborRate.isPending} className="flex-1">
                    {createLaborRate.isPending ? 'Saving...' : 'Save'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowAddRate(false)} className="flex-1">
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {ratesLoading ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
              </div>
            ) : laborRates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No labor rates configured.</p>
            ) : (
              <div className="space-y-2">
                {laborRates.map(rate => (
                  <div key={rate.id.toString()} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    {editingRateId === rate.id.toString() ? (
                      <div className="flex-1 space-y-2 mr-2">
                        <Input
                          value={editRateName}
                          onChange={e => setEditRateName(e.target.value)}
                          className="h-7 text-sm"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <Select value={editRateType} onValueChange={(v) => setEditRateType(v as RateType)}>
                            <SelectTrigger className="h-7 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={RateType.hourly}>Hourly</SelectItem>
                              <SelectItem value={RateType.flat}>Flat</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            value={editRateAmount}
                            onChange={e => setEditRateAmount(e.target.value)}
                            type="number"
                            min="0"
                            step="0.01"
                            className="h-7 text-sm"
                          />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm font-medium text-foreground">{rate.name}</p>
                        <p className="text-xs text-muted-foreground">
                          ${(Number(rate.amount) / 100).toFixed(2)} / {rate.rateType === RateType.hourly ? 'hr' : 'flat'}
                        </p>
                      </div>
                    )}
                    <div className="flex gap-1">
                      {editingRateId === rate.id.toString() ? (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-green-600"
                            onClick={() => handleSaveEdit(rate)}
                            disabled={updateLaborRate.isPending}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setEditingRateId(null)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleEditRate(rate)}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => handleDeleteRate(rate.id)}
                            disabled={deleteLaborRate.isPending}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Stripe Configuration (Owner only) */}
        {isOwner && (
          <div className="bg-card rounded-xl border border-border p-4 space-y-4">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-foreground">Stripe Configuration</h2>
              {stripeConfigured ? (
                <Badge className="bg-green-100 text-green-700 border-green-200 ml-auto">Configured</Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground ml-auto">Not Configured</Badge>
              )}
            </div>

            {stripeConfigured && (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <p className="text-sm text-green-700 dark:text-green-400">
                  ✓ Stripe is configured. You can update the configuration below.
                </p>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1 block">
                  Stripe Secret Key
                </label>
                <div className="relative">
                  <Input
                    type={showStripeKey ? 'text' : 'password'}
                    placeholder="sk_live_... or sk_test_..."
                    value={stripeKey}
                    onChange={e => setStripeKey(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowStripeKey(!showStripeKey)}
                  >
                    {showStripeKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1 block">
                  Allowed Countries (comma-separated)
                </label>
                <Input
                  placeholder="US, CA, GB"
                  value={stripeCountries}
                  onChange={e => setStripeCountries(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Enter ISO country codes separated by commas (e.g., US, CA, GB)
                </p>
              </div>

              {stripeError && (
                <p className="text-sm text-destructive">{stripeError}</p>
              )}

              {stripeSaved && (
                <p className="text-sm text-green-600">✓ Stripe configuration saved successfully!</p>
              )}

              <Button
                className="w-full"
                onClick={handleSaveStripe}
                disabled={setStripeConfiguration.isPending}
              >
                <CreditCard className="h-4 w-4 mr-2" />
                {setStripeConfiguration.isPending ? 'Saving...' : stripeConfigured ? 'Update Stripe Configuration' : 'Save Stripe Configuration'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
