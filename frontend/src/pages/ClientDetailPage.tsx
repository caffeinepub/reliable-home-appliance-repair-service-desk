import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Star, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { useGetClient, useCreateClient, useUpdateClient, useDeleteClient, useListClients } from '../hooks/useQueries';
import type { Client } from '../backend';

const DEFAULT_GOOGLE_REVIEW_URL =
  'https://www.google.com/search?client=safari&hs=bqlU&sca_esv=477fbb8c9f03b619&hl=en-us&biw=393&bih=695&sxsrf=ANbL-n4RtO1QhvuqwZK_dXDG4LEsJQO68g:1772317989694&q=www.appliancerepairwalden.com+reviews&uds=ALYpb_kZB5BOMUFlRqxCQelgPO46flvNFV4llOp9FXmtgN0bFd_59aFqnzrv2lL_22fdcKjO_3pVePgz54Y0AhVY-GXqXefnH1qx8tFczBBdwApAdYXTD4RJ2fBkcTn2WMvET_C7noP7FDKpQdsny6qiyHWQVVEzt_rbESpi998me2Rg_kwCVEN74ocI_4XPNR22msLdpmHbL8GYbInBlVUBwAcIKp_O7ifZcZcIuUQQZROm0YQtZPTCZ3SVevvuwibzruurIRfjpjjybvX9x_eguP-hCuWxArDZZrO09vSYhCpocS_cwWMGzY0Rwgw8zjgH5WGiY2fHfDs2UCkdDDuktP48v8L24SA8xc5Ab-2pYFO3nVVnJjMPVJpHFf0r559CWqf2c7qmL2DlIq9LVmUhwLfYHaubp-qPmWjWko6lXf2oCXBA71Y3Lp6zVnH89YUnvqoKlmf1B2-nVHIk0CujdXTh7wl4QKF-8kTjNbCWi5TusYLAhMY&si=AL3DRZEsmMGCryMMFSHJ3StBhOdZ2-6yYkXd_doETEE1OR-qOR1dDOzNahzjiSdI7VdJYDnJGXelcQqzXSy0Yqcso2TsW1Ly5cwaMJIgfN94_biTlzTkpCdTbGgRuaEYR62-qzW3A8vAeLXPm0nS58Y2B2F8ZX0rKA%3D%3D&sa=X&ved=2ahUKEwiYrtGBn_2SAxVXE1kFHQkkMeYQk8gLegQIIhAB&ictx=1&stq=1&cs=0&lei=YG2jaeaXGK6l5NoPp7HaiAw#ebo=1';

export default function ClientDetailPage() {
  // Try to get clientId from route params; if not present (e.g. /clients/new), treat as new
  const params = useParams({ strict: false }) as { clientId?: string };
  const clientId = params.clientId;
  const navigate = useNavigate();
  const isNew = !clientId || clientId === 'new';

  const { data: client, isLoading } = useGetClient(isNew ? undefined : BigInt(clientId!));
  const { data: allClients } = useListClients();
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const deleteClient = useDeleteClient();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [googleReviewUrl, setGoogleReviewUrl] = useState(DEFAULT_GOOGLE_REVIEW_URL);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (client) {
      setName(client.name);
      setPhone(client.phone);
      setAddress(client.address);
      setEmail(client.email ?? '');
      setNotes(client.notes);
      setGoogleReviewUrl(client.googleReviewUrl ?? DEFAULT_GOOGLE_REVIEW_URL);
    }
  }, [client]);

  const getNextId = (): bigint => {
    if (!allClients || allClients.length === 0) return BigInt(1);
    const maxId = allClients.reduce((max, c) => (c.id > max ? c.id : max), BigInt(0));
    return maxId + BigInt(1);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setIsSaving(true);
    try {
      const clientData: Client = {
        id: isNew ? getNextId() : BigInt(clientId!),
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        email: email.trim() || undefined,
        notes: notes.trim(),
        googleReviewUrl: googleReviewUrl.trim() || undefined,
      };
      if (isNew) {
        await createClient.mutateAsync(clientData);
      } else {
        await updateClient.mutateAsync(clientData);
      }
      navigate({ to: '/clients' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!client) return;
    await deleteClient.mutateAsync(client.id);
    navigate({ to: '/clients' });
  };

  const handleRequestReview = () => {
    const url = googleReviewUrl || DEFAULT_GOOGLE_REVIEW_URL;
    window.open(url, '_blank');
  };

  if (!isNew && isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: '/clients' })}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-semibold text-foreground">{isNew ? 'New Client' : 'Edit Client'}</h1>
        {!isNew ? (
          <Button variant="ghost" size="icon" onClick={handleRequestReview} title="Request Google Review">
            <Star className="h-5 w-5 text-yellow-500" />
          </Button>
        ) : (
          <div className="w-9" />
        )}
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Client Form */}
        <div className="bg-card rounded-xl border border-border p-4 space-y-4">
          <h2 className="font-semibold text-foreground">Client Information</h2>

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1 block">Name *</label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Full name"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1 block">Phone</label>
            <Input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="(555) 555-5555"
              type="tel"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1 block">Address</label>
            <Input
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="123 Main St, City, State"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1 block">Email</label>
            <Input
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="email@example.com"
              type="email"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1 block">Notes</label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Client notes..."
              rows={3}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1 block">
              Google Review URL
            </label>
            <Input
              value={googleReviewUrl}
              onChange={e => setGoogleReviewUrl(e.target.value)}
              placeholder="Google Review URL"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Leave as default or enter a custom review link for this client.
            </p>
          </div>
        </div>

        {/* Google Review Button */}
        {!isNew && (
          <Button
            variant="outline"
            className="w-full border-yellow-400/50 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20"
            onClick={handleRequestReview}
          >
            <Star className="h-4 w-4 mr-2" />
            Request Google Review
          </Button>
        )}

        {/* Save Button */}
        <Button
          className="w-full"
          onClick={handleSave}
          disabled={isSaving || !name.trim()}
        >
          {isSaving ? 'Saving...' : isNew ? 'Create Client' : 'Save Changes'}
        </Button>

        {/* Delete Button */}
        {!isNew && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="w-full text-destructive border-destructive/30 hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Client
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Client</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete {name}? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
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
