import React, { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Plus, Search, Phone, MapPin, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useListClients } from '../hooks/useQueries';

const DEFAULT_GOOGLE_REVIEW_URL =
  'https://www.google.com/search?client=safari&hs=bqlU&sca_esv=477fbb8c9f03b619&hl=en-us&biw=393&bih=695&sxsrf=ANbL-n4RtO1QhvuqwZK_dXDG4LEsJQO68g:1772317989694&q=www.appliancerepairwalden.com+reviews&uds=ALYpb_kZB5BOMUFlRqxCQelgPO46flvNFV4llOp9FXmtgN0bFd_59aFqnzrv2lL_22fdcKjO_3pVePgz54Y0AhVY-GXqXefnH1qx8tFczBBdwApAdYXTD4RJ2fBkcTn2WMvET_C7noP7FDKpQdsny6qiyHWQVVEzt_rbESpi998me2Rg_kwCVEN74ocI_4XPNR22msLdpmHbL8GYbInBlVUBwAcIKp_O7ifZcZcIuUQQZROm0YQtZPTCZ3SVevvuwibzruurIRfjpjjybvX9x_eguP-hCuWxArDZZrO09vSYhCpocS_cwWMGzY0Rwgw8zjgH5WGiY2fHfDs2UCkdDDuktP48v8L24SA8xc5Ab-2pYFO3nVVnJjMPVJpHFf0r559CWqf2c7qmL2DlIq9LVmUhwLfYHaubp-qPmWjWko6lXf2oCXBA71Y3Lp6zVnH89YUnvqoKlmf1B2-nVHIk0CujdXTh7wl4QKF-8kTjNbCWi5TusYLAhMY&si=AL3DRZEsmMGCryMMFSHJ3StBhOdZ2-6yYkXd_doETEE1OR-qOR1dDOzNahzjiSdI7VdJYDnJGXelcQqzXSy0Yqcso2TsW1Ly5cwaMJIgfN94_biTlzTkpCdTbGgRuaEYR62-qzW3A8vAeLXPm0nS58Y2B2F8ZX0rKA%3D%3D&sa=X&ved=2ahUKEwiYrtGBn_2SAxVXE1kFHQkkMeYQk8gLegQIIhAB&ictx=1&stq=1&cs=0&lei=YG2jaeaXGK6l5NoPp7HaiAw#ebo=1';

export default function ClientsPage() {
  const navigate = useNavigate();
  const { data: clients = [], isLoading } = useListClients();
  const [search, setSearch] = useState('');

  const filtered = clients.filter(c => {
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      c.address.toLowerCase().includes(q)
    );
  });

  const handleReviewClick = (e: React.MouseEvent, url: string | undefined) => {
    e.stopPropagation();
    window.open(url || DEFAULT_GOOGLE_REVIEW_URL, '_blank');
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <h1 className="font-semibold text-foreground">Clients</h1>
        <Button
          size="sm"
          onClick={() => navigate({ to: '/clients/$clientId', params: { clientId: 'new' } })}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Client
        </Button>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search clients..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Client List */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {search ? 'No clients match your search.' : 'No clients yet. Add your first client!'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(client => (
              <div
                key={client.id.toString()}
                className="bg-card rounded-xl border border-border p-4 cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() =>
                  navigate({ to: '/clients/$clientId', params: { clientId: client.id.toString() } })
                }
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">{client.name}</p>
                    {client.phone && (
                      <div className="flex items-center gap-1 mt-1">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">{client.phone}</p>
                      </div>
                    )}
                    {client.address && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground truncate">{client.address}</p>
                      </div>
                    )}
                  </div>
                  <button
                    className="p-1.5 rounded-lg hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-colors flex-shrink-0"
                    onClick={e => handleReviewClick(e, client.googleReviewUrl)}
                    title="Request Google Review"
                  >
                    <Star className="h-4 w-4 text-yellow-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
