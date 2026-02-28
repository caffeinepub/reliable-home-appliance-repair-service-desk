import { useState, useEffect } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import {
  useGetClient,
  useCreateClient,
  useUpdateClient,
  useDeleteClient,
  useListClients,
} from '../hooks/useQueries';
import type { Client } from '../backend';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Trash2, Loader2, Star, ExternalLink } from 'lucide-react';

interface ClientDetailPageProps {
  mode: 'create' | 'edit';
}

interface ClientFormData {
  name: string;
  phone: string;
  address: string;
  notes: string;
  email: string;
  googleReviewUrl: string;
}

const emptyForm: ClientFormData = {
  name: '',
  phone: '',
  address: '',
  notes: '',
  email: '',
  googleReviewUrl: '',
};

export default function ClientDetailPage({ mode }: ClientDetailPageProps) {
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { clientId?: string };
  const clientId = params.clientId ? BigInt(params.clientId) : null;

  const { data: existingClient, isLoading: clientLoading } = useGetClient(
    mode === 'edit' ? clientId : null
  );
  const { data: allClients } = useListClients();

  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const deleteClient = useDeleteClient();

  const [form, setForm] = useState<ClientFormData>(emptyForm);

  useEffect(() => {
    if (existingClient) {
      setForm({
        name: existingClient.name,
        phone: existingClient.phone,
        address: existingClient.address,
        notes: existingClient.notes,
        email: existingClient.email ?? '',
        googleReviewUrl: existingClient.googleReviewUrl ?? '',
      });
    }
  }, [existingClient]);

  const handleChange = (field: keyof ClientFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const getNextId = (): bigint => {
    if (!allClients || allClients.length === 0) return BigInt(1);
    const maxId = allClients.reduce((max, c) => (c.id > max ? c.id : max), BigInt(0));
    return maxId + BigInt(1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) return;

    const clientData: Client = {
      id: mode === 'edit' && clientId !== null ? clientId : getNextId(),
      name: form.name.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      notes: form.notes.trim(),
      email: form.email.trim() || undefined,
      googleReviewUrl: form.googleReviewUrl.trim() || undefined,
    };

    try {
      if (mode === 'create') {
        await createClient.mutateAsync(clientData);
      } else {
        await updateClient.mutateAsync(clientData);
      }
      navigate({ to: '/clients' });
    } catch (err) {
      console.error('Failed to save client:', err);
    }
  };

  const handleDelete = async () => {
    if (clientId === null) return;
    try {
      await deleteClient.mutateAsync(clientId);
      navigate({ to: '/clients' });
    } catch (err) {
      console.error('Failed to delete client:', err);
    }
  };

  const isPending = createClient.isPending || updateClient.isPending;
  const isError = createClient.isError || updateClient.isError;

  if (mode === 'edit' && clientLoading) {
    return (
      <div className="px-4 py-5 space-y-4">
        <Skeleton className="h-8 w-32 rounded-xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="px-4 py-5 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate({ to: '/clients' })}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={18} />
          <span className="text-sm font-medium">Clients</span>
        </button>
        {mode === 'edit' && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl">
                <Trash2 size={18} />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-2xl mx-4">
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Client</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete <strong>{existingClient?.name}</strong>? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground rounded-xl"
                >
                  {deleteClient.isPending ? <Loader2 className="animate-spin" size={16} /> : 'Delete'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <h2 className="font-display font-bold text-xl text-foreground">
        {mode === 'create' ? 'New Client' : 'Edit Client'}
      </h2>

      {/* Google Review Button (edit mode only) */}
      {mode === 'edit' && existingClient?.googleReviewUrl && (
        <a
          href={existingClient.googleReviewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-yellow-700 font-medium text-sm hover:bg-yellow-100 transition-colors"
        >
          <Star size={16} className="text-yellow-500" />
          Request Google Review
          <ExternalLink size={14} className="ml-auto" />
        </a>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-card rounded-2xl border border-border p-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-sm font-medium">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Client full name"
              className="rounded-xl"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone" className="text-sm font-medium">
              Phone <span className="text-destructive">*</span>
            </Label>
            <Input
              id="phone"
              type="tel"
              value={form.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              placeholder="(555) 000-0000"
              className="rounded-xl"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="address" className="text-sm font-medium">Address</Label>
            <Input
              id="address"
              value={form.address}
              onChange={(e) => handleChange('address', e.target.value)}
              placeholder="123 Main St, City, State"
              className="rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm font-medium">Email</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="client@example.com"
              className="rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="googleReviewUrl" className="text-sm font-medium">Google Review URL</Label>
            <Input
              id="googleReviewUrl"
              type="url"
              value={form.googleReviewUrl}
              onChange={(e) => handleChange('googleReviewUrl', e.target.value)}
              placeholder="https://g.page/r/..."
              className="rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-sm font-medium">Notes</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Any additional notes about this client..."
              className="rounded-xl resize-none"
              rows={3}
            />
          </div>
        </div>

        {isError && (
          <p className="text-destructive text-sm text-center">
            Failed to save client. Please try again.
          </p>
        )}

        <Button
          type="submit"
          disabled={isPending || !form.name.trim() || !form.phone.trim()}
          className="w-full bg-primary text-primary-foreground rounded-xl font-semibold"
          size="lg"
        >
          {isPending ? (
            <>
              <Loader2 className="animate-spin mr-2" size={18} />
              Saving...
            </>
          ) : mode === 'create' ? (
            'Add Client'
          ) : (
            'Save Changes'
          )}
        </Button>
      </form>
    </div>
  );
}
