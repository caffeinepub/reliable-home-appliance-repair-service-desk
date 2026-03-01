import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useActor } from '../hooks/useActor';
import { useListClients } from '../hooks/useQueries';
import { Client } from '../backend';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Loader2, Trash2 } from 'lucide-react';
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

function useGetClient(clientId: bigint | null) {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ['client', clientId?.toString()],
    queryFn: async () => {
      if (!actor || clientId === null) return null;
      return actor.getClient(clientId);
    },
    enabled: !!actor && !isFetching && clientId !== null,
  });
}

export default function ClientDetailPage() {
  const navigate = useNavigate();
  // Support both /clients/new (no param or param === 'new') and /clients/$clientId (numeric param)
  const params = useParams({ strict: false }) as { clientId?: string };

  // isNew when there's no clientId param, or when it's the literal string 'new'
  const isNew = !params.clientId || params.clientId === 'new';

  // Only parse as BigInt when we have a real numeric ID
  const clientId: bigint | null = (() => {
    if (isNew) return null;
    try {
      return BigInt(params.clientId!);
    } catch {
      return null;
    }
  })();

  const { actor } = useActor();
  const queryClient = useQueryClient();

  const { data: client, isLoading } = useGetClient(clientId);
  const { data: allClients = [] } = useListClients();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (client) {
      setName(client.name);
      setPhone(client.phone);
      setAddress(client.address);
      setEmail(client.email || '');
      setNotes(client.notes);
    }
  }, [client]);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!actor) return;
    if (!name.trim()) { setSaveError('Name is required'); return; }
    setSaving(true);
    setSaveError(null);
    try {
      // Use timestamp-based ID for new records to avoid Math.max(-Infinity) on empty arrays
      let newId: bigint;
      if (isNew) {
        if (allClients.length > 0) {
          const maxId = allClients.reduce((max, c) => (c.id > max ? c.id : max), allClients[0].id);
          newId = maxId + BigInt(1);
        } else {
          newId = BigInt(Date.now());
        }
      } else {
        newId = clientId!;
      }

      const clientData: Client = {
        id: newId,
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        email: email.trim() || undefined,
        notes: notes.trim(),
        googleReviewUrl: client?.googleReviewUrl,
      };

      if (isNew) {
        await actor.createClient(clientData);
      } else {
        await actor.updateClient(clientData);
      }
      await queryClient.invalidateQueries({ queryKey: ['clients'] });
      await queryClient.invalidateQueries({ queryKey: ['client', newId.toString()] });
      navigate({ to: '/clients' });
    } catch (e: any) {
      setSaveError(e?.message || 'Failed to save client');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!actor || !clientId) return;
    setDeleting(true);
    try {
      await actor.deleteClient(clientId);
      await queryClient.invalidateQueries({ queryKey: ['clients'] });
      navigate({ to: '/clients' });
    } catch (e: any) {
      setSaveError(e?.message || 'Failed to delete client');
    } finally {
      setDeleting(false);
    }
  };

  if (!isNew && isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: '/clients' })}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Clients
        </Button>
        <h1 className="font-semibold text-foreground">
          {isNew ? 'New Client' : 'Edit Client'}
        </h1>
        <Button size="sm" onClick={() => handleSave()} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
          {isNew ? 'Create' : 'Save'}
        </Button>
      </div>

      <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
        {saveError && (
          <div className="bg-destructive/10 text-destructive text-sm rounded-lg px-4 py-3">
            {saveError}
          </div>
        )}

        <form onSubmit={handleSave}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Client Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="client-name">Name *</Label>
                <Input
                  id="client-name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Full name"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="client-phone">Phone</Label>
                <Input
                  id="client-phone"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="(555) 000-0000"
                  type="tel"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="client-email">Email</Label>
                <Input
                  id="client-email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  type="email"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="client-address">Address</Label>
                <Input
                  id="client-address"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="123 Main St, City, State"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="client-notes">Notes</Label>
                <Textarea
                  id="client-notes"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Any additional notes about this client..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
          {/* Hidden submit button so Enter key works */}
          <button type="submit" className="sr-only" aria-hidden="true" />
        </form>

        {/* Delete */}
        {!isNew && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full" disabled={deleting}>
                {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                Delete Client
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Client?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete this client. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}
