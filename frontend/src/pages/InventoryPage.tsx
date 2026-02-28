import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useGetCallerUserRole } from '../hooks/useQueries';
import { UserRole } from '../backend';
import { Package, Plus, Search, AlertTriangle, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

// Placeholder part type until backend supports inventory
interface Part {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  lowStockThreshold: number;
  category: string;
}

// Sample placeholder data — will be replaced once backend inventory endpoint is available
const PLACEHOLDER_PARTS: Part[] = [];

export default function InventoryPage() {
  const navigate = useNavigate();
  const { data: userRole, isLoading: roleLoading } = useGetCallerUserRole();
  const [search, setSearch] = useState('');

  const isOwner = userRole === UserRole.admin;

  const filtered = PLACEHOLDER_PARTS.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase())
  );

  const totalParts = PLACEHOLDER_PARTS.length;
  const lowStockCount = PLACEHOLDER_PARTS.filter(
    (p) => p.quantity <= p.lowStockThreshold
  ).length;

  return (
    <div className="px-4 py-5 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package size={20} className="text-primary" />
          <h2 className="font-display font-bold text-xl text-foreground">Inventory</h2>
        </div>
        {!roleLoading && isOwner && (
          <Button
            size="sm"
            className="rounded-xl bg-primary text-primary-foreground gap-1.5 text-xs h-8 px-3"
            onClick={() => {
              // Future: navigate to add part form
            }}
          >
            <Plus size={14} />
            Add Part
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      {roleLoading ? (
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card rounded-2xl border border-border p-4 text-center shadow-card">
            <p className="text-3xl font-display font-bold text-foreground">{totalParts}</p>
            <p className="text-xs text-muted-foreground mt-1 font-medium">Total Parts</p>
          </div>
          <div
            className={`rounded-2xl border p-4 text-center shadow-card ${
              lowStockCount > 0
                ? 'bg-destructive/10 border-destructive/30'
                : 'bg-card border-border'
            }`}
          >
            <p
              className={`text-3xl font-display font-bold ${
                lowStockCount > 0 ? 'text-destructive' : 'text-foreground'
              }`}
            >
              {lowStockCount}
            </p>
            <p className="text-xs text-muted-foreground mt-1 font-medium">Low Stock</p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search parts by name, SKU, or category…"
          className="pl-9 rounded-xl h-10 text-sm"
        />
      </div>

      {/* Coming Soon Notice */}
      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 flex gap-3">
        <Info size={18} className="text-primary shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-foreground">Inventory Management Coming Soon</p>
          <p className="text-xs text-muted-foreground mt-1">
            Full parts inventory with stock tracking, low-stock alerts, and part assignment to jobs
            is being set up. Check back soon!
          </p>
        </div>
      </div>

      {/* Parts List */}
      {filtered.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-8 text-center">
          <Package size={36} className="text-muted-foreground mx-auto mb-3" />
          <p className="font-semibold text-foreground text-sm">No parts found</p>
          <p className="text-muted-foreground text-xs mt-1">
            {search
              ? 'Try a different search term.'
              : 'Add your first part to get started.'}
          </p>
          {!roleLoading && isOwner && !search && (
            <Button
              size="sm"
              className="mt-4 rounded-xl bg-primary text-primary-foreground gap-1.5 text-xs"
              onClick={() => {
                // Future: navigate to add part form
              }}
            >
              <Plus size={14} />
              Add First Part
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((part) => {
            const isLowStock = part.quantity <= part.lowStockThreshold;
            return (
              <div
                key={part.id}
                className="bg-card rounded-xl border border-border p-3 flex items-center gap-3"
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    isLowStock ? 'bg-destructive/10' : 'bg-primary/10'
                  }`}
                >
                  {isLowStock ? (
                    <AlertTriangle size={16} className="text-destructive" />
                  ) : (
                    <Package size={16} className="text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground truncate">{part.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    SKU: {part.sku} · {part.category}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-sm font-bold text-foreground">{part.quantity}</span>
                  {isLowStock ? (
                    <Badge variant="destructive" className="text-xs px-1.5 py-0 h-4">
                      Low Stock
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4">
                      In Stock
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
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
          </a>{' '}
          · © {new Date().getFullYear()} Reliable Home Appliance Repair LLC
        </p>
      </footer>
    </div>
  );
}
