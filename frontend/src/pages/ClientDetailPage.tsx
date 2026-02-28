import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from '../hooks/useActor';
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

function useListClients() {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listClients();
    },
    enabled: !!actor && !isFetching,
  });
}

export default function ClientDetailPage() {
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { clientId?: string };
  const clientId = params.clientId && params.clientId !== 'new' ? BigInt(params.clientId) : null;
  const isNew = !clientId;

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

  const handleSave = async () => {
    if (!actor) return;
    if (!name.trim()) { setSaveError('Name is required'); return; }
    setSaving(true);
    setSaveError(null);
    try {
      const newId = isNew
        ? BigInt(allClients.length > 0 ? Math.max(...allClients.map(c => Number(c.id))) + 1 : 1)
        : clientId!;

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

  if (isLoading) {
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
        <Button size="sm" onClick={handleSave} disabled={saving}>
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Client Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>Name *</Label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Full name"
              />
            </div>

            <div className="space-y-1">
              <Label>Phone</Label>
              <Input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="(555) 000-0000"
                type="tel"
              />
            </div>

            <div className="space-y-1">
              <Label>Email</Label>
              <Input
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="email@example.com"
                type="email"
              />
            </div>

            <div className="space-y-1">
              <Label>Address</Label>
              <Input
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="123 Main St, City, State"
              />
            </div>

            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any additional notes about this client..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

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
