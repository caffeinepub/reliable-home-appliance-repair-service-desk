import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { ArrowLeft, Save, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  useListClients,
  useCreateClient,
  useUpdateClient,
} from '../hooks/useQueries';

export default function ClientDetailPage() {
  const { clientId } = useParams({ strict: false }) as { clientId?: string };
  const navigate = useNavigate();
  const isNew = !clientId || clientId === 'new';

  const { data: clients = [], isLoading: clientsLoading } = useListClients();
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [googleReviewUrl, setGoogleReviewUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Load existing client data
  useEffect(() => {
    if (!isNew && !clientsLoading && clients.length > 0 && !initialized) {
      const id = BigInt(clientId!);
      const existing = clients.find((c) => c.id === id);
      if (existing) {
        setName(existing.name);
        setEmail(existing.email ?? '');
        setPhone(existing.phone);
        setAddress(existing.address);
        setNotes(existing.notes);
        setGoogleReviewUrl(existing.googleReviewUrl ?? '');
        setInitialized(true);
      }
    }
    if (isNew && !initialized) {
      setInitialized(true);
    }
  }, [isNew, clientId, clients, clientsLoading, initialized]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Client name is required.');
      return;
    }

    try {
      if (isNew) {
        // Generate a new ID based on existing clients
        const newId =
          clients.length === 0
            ? BigInt(Date.now())
            : clients.reduce((max, c) => (c.id > max ? c.id : max), clients[0].id) + 1n;

        await createClient.mutateAsync({
          id: newId,
          name: name.trim(),
          email: email.trim() || undefined,
          phone: phone.trim(),
          address: address.trim(),
          notes: notes.trim(),
          googleReviewUrl: googleReviewUrl.trim() || undefined,
        });
        navigate({ to: '/clients' });
      } else {
        const id = BigInt(clientId!);
        await updateClient.mutateAsync({
          id,
          name: name.trim(),
          email: email.trim() || undefined,
          phone: phone.trim(),
          address: address.trim(),
          notes: notes.trim(),
          googleReviewUrl: googleReviewUrl.trim() || undefined,
        });
        navigate({ to: '/clients' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save client.';
      setError(msg);
    }
  };

  const isSaving = createClient.isPending || updateClient.isPending;

  if (!isNew && clientsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate({ to: '/clients' })}
          className="shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold font-display flex-1">
          {isNew ? 'New Client' : 'Edit Client'}
        </h1>
        <Button
          onClick={handleSave}
          disabled={isSaving}
          size="sm"
          className="gap-2"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {isNew ? 'Create' : 'Save'}
        </Button>
      </header>

      {/* Form */}
      <main className="max-w-2xl mx-auto p-4 pb-24">
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSave} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Client full name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 000-0000"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="client@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Main St, City, State"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="googleReviewUrl">Google Review URL</Label>
            <Input
              id="googleReviewUrl"
              type="url"
              value={googleReviewUrl}
              onChange={(e) => setGoogleReviewUrl(e.target.value)}
              placeholder="https://g.page/r/..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes about this client..."
              rows={4}
            />
          </div>

          {/* Hidden submit button to allow Enter key submission */}
          <button type="submit" className="hidden" aria-hidden="true" />
        </form>
      </main>
    </div>
  );
}
