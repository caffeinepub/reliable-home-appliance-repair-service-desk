import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useListClients } from '../hooks/useQueries';
import type { Client } from '../backend';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Plus, User, Phone, MapPin, Star, ChevronRight } from 'lucide-react';

function ClientCard({ client, onClick }: { client: Client; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full bg-card rounded-2xl shadow-card border border-border p-4 text-left hover:shadow-card-hover transition-all active:scale-[0.99] animate-fade-in"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center shrink-0">
          <User size={18} className="text-accent-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-foreground truncate">{client.name}</p>
            <ChevronRight size={16} className="text-muted-foreground shrink-0" />
          </div>
          <div className="flex items-center gap-1 mt-1">
            <Phone size={12} className="text-muted-foreground shrink-0" />
            <p className="text-muted-foreground text-xs truncate">{client.phone}</p>
          </div>
          {client.address && (
            <div className="flex items-center gap-1 mt-0.5">
              <MapPin size={12} className="text-muted-foreground shrink-0" />
              <p className="text-muted-foreground text-xs truncate">{client.address}</p>
            </div>
          )}
          {client.googleReviewUrl && (
            <div className="flex items-center gap-1 mt-2">
              <Star size={12} className="text-yellow-500 shrink-0" />
              <span className="text-xs text-primary font-medium">Request Google Review</span>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

export default function ClientsPage() {
  const navigate = useNavigate();
  const { data: clients, isLoading } = useListClients();
  const [search, setSearch] = useState('');

  const filtered = clients?.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      c.address.toLowerCase().includes(q)
    );
  }) ?? [];

  return (
    <div className="px-4 py-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-xl text-foreground">Clients</h2>
          <p className="text-muted-foreground text-xs">
            {clients ? `${clients.length} total` : 'Loading...'}
          </p>
        </div>
        <Button
          onClick={() => navigate({ to: '/clients/new' })}
          size="sm"
          className="bg-primary text-primary-foreground rounded-xl gap-1.5 font-semibold"
        >
          <Plus size={16} />
          Add Client
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, phone, or address..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 rounded-xl bg-card"
        />
      </div>

      {/* Client List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <User size={40} className="text-muted-foreground mb-3" />
          <p className="font-medium text-foreground">
            {search ? 'No clients found' : 'No clients yet'}
          </p>
          <p className="text-muted-foreground text-sm mt-1">
            {search ? 'Try a different search term' : 'Add your first client to get started'}
          </p>
          {!search && (
            <Button
              onClick={() => navigate({ to: '/clients/new' })}
              className="mt-4 bg-primary text-primary-foreground rounded-xl"
              size="sm"
            >
              <Plus size={16} className="mr-1.5" />
              Add Client
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((client) => (
            <ClientCard
              key={client.id.toString()}
              client={client}
              onClick={() =>
                navigate({ to: '/clients/$clientId', params: { clientId: client.id.toString() } })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
