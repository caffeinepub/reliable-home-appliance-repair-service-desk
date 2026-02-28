import { useNavigate } from '@tanstack/react-router';
import {
  useListJobs,
  useListClients,
  useGetCallerUserProfile,
  useGetCallerUserRole,
  useListLaborRates,
} from '../hooks/useQueries';
import { Variant_open_complete_inProgress, UserRole, Variant_flat_hourly } from '../backend';
import type { Job, Client } from '../backend';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Briefcase,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronRight,
  DollarSign,
  Package,
  Lock,
  Settings,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

function MetricCard({
  label,
  value,
  icon: Icon,
  color,
  onClick,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="bg-card rounded-2xl shadow-card border border-border p-4 flex items-center gap-4 w-full text-left hover:shadow-card-hover transition-shadow active:scale-[0.98]"
    >
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon size={22} className="text-primary-foreground" />
      </div>
      <div>
        <p className="text-2xl font-display font-bold text-foreground leading-none">{value}</p>
        <p className="text-muted-foreground text-xs mt-1 font-medium">{label}</p>
      </div>
    </button>
  );
}

function statusLabel(status: Variant_open_complete_inProgress): string {
  switch (status) {
    case Variant_open_complete_inProgress.open:
      return 'Open';
    case Variant_open_complete_inProgress.inProgress:
      return 'In Progress';
    case Variant_open_complete_inProgress.complete:
      return 'Complete';
  }
}

function statusBadgeVariant(status: Variant_open_complete_inProgress) {
  switch (status) {
    case Variant_open_complete_inProgress.open:
      return 'destructive';
    case Variant_open_complete_inProgress.inProgress:
      return 'secondary';
    case Variant_open_complete_inProgress.complete:
      return 'default';
  }
}

function getClientName(clients: Client[], clientId: bigint): string {
  const client = clients.find((c) => c.id === clientId);
  return client?.name ?? `Client #${clientId}`;
}

function formatJobDate(timestamp: bigint): string {
  try {
    const ms = Number(timestamp / BigInt(1_000_000));
    return formatDistanceToNow(new Date(ms), { addSuffix: true });
  } catch {
    return 'Unknown date';
  }
}

function formatAmount(amount: bigint, rateType: Variant_flat_hourly): string {
  const dollars = (Number(amount) / 100).toFixed(2);
  return rateType === Variant_flat_hourly.hourly ? `$${dollars}/hr` : `$${dollars} flat`;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data: jobs, isLoading: jobsLoading } = useListJobs();
  const { data: clients, isLoading: clientsLoading } = useListClients();
  const { data: profile } = useGetCallerUserProfile();
  const { data: userRole, isLoading: roleLoading } = useGetCallerUserRole();
  const { data: laborRates, isLoading: laborRatesLoading } = useListLaborRates();

  const isOwner = userRole === UserRole.admin;

  const totalJobs = jobs?.length ?? 0;
  const openJobs =
    jobs?.filter((j) => j.status === Variant_open_complete_inProgress.open).length ?? 0;
  const inProgressJobs =
    jobs?.filter((j) => j.status === Variant_open_complete_inProgress.inProgress).length ?? 0;
  const completeJobs =
    jobs?.filter((j) => j.status === Variant_open_complete_inProgress.complete).length ?? 0;
  const totalClients = clients?.length ?? 0;

  const recentJobs = jobs ? [...jobs].sort((a, b) => Number(b.date - a.date)).slice(0, 5) : [];

  const isLoading = jobsLoading || clientsLoading;

  return (
    <div className="px-4 py-5 space-y-6 animate-fade-in">
      {/* Greeting */}
      <div>
        <h2 className="font-display font-bold text-xl text-foreground">
          {profile ? `Hello, ${profile.name}` : 'Dashboard'}
        </h2>
        <p className="text-muted-foreground text-sm">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      {/* Metric Cards — Owner Only */}
      {roleLoading || isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : isOwner ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              label="Open Jobs"
              value={openJobs}
              icon={AlertCircle}
              color="bg-destructive"
              onClick={() => navigate({ to: '/jobs' })}
            />
            <MetricCard
              label="In Progress"
              value={inProgressJobs}
              icon={Clock}
              color="bg-primary"
              onClick={() => navigate({ to: '/jobs' })}
            />
            <MetricCard
              label="Completed"
              value={completeJobs}
              icon={CheckCircle2}
              color="bg-primary"
              onClick={() => navigate({ to: '/jobs' })}
            />
            <MetricCard
              label="Total Clients"
              value={totalClients}
              icon={Users}
              color="bg-secondary"
              onClick={() => navigate({ to: '/clients' })}
            />
          </div>

          {/* Status Breakdown — Owner Only */}
          {totalJobs > 0 && (
            <div className="bg-card rounded-2xl shadow-card border border-border p-4">
              <h3 className="font-semibold text-sm text-foreground mb-3">Jobs Overview</h3>
              <div className="space-y-2">
                {[
                  { label: 'Open', count: openJobs, color: 'bg-destructive' },
                  { label: 'In Progress', count: inProgressJobs, color: 'bg-primary' },
                  { label: 'Complete', count: completeJobs, color: 'bg-accent-foreground' },
                ].map(({ label, count, color }) => (
                  <div key={label} className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${color}`} />
                    <span className="text-sm text-muted-foreground flex-1">{label}</span>
                    <span className="text-sm font-semibold text-foreground">{count}</span>
                    <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${color}`}
                        style={{
                          width: totalJobs > 0 ? `${(count / totalJobs) * 100}%` : '0%',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        /* Non-owner: show subtle notice */
        <div className="bg-muted/40 rounded-2xl border border-border p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
            <Lock size={16} className="text-muted-foreground" />
          </div>
          <p className="text-muted-foreground text-sm">
            Metrics are available to the owner only.
          </p>
        </div>
      )}

      {/* Labor Rates Card — Owner Only */}
      {!roleLoading && isOwner && (
        <div className="bg-card rounded-2xl shadow-card border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign size={16} className="text-primary" />
              <h3 className="font-semibold text-sm text-foreground">Labor Rates</h3>
            </div>
            <button
              onClick={() => navigate({ to: '/settings' })}
              className="text-primary text-xs font-medium flex items-center gap-0.5"
            >
              Manage <ChevronRight size={14} />
            </button>
          </div>

          {laborRatesLoading ? (
            <div className="space-y-2">
              {[...Array(2)].map((_, i) => (
                <Skeleton key={i} className="h-10 rounded-xl" />
              ))}
            </div>
          ) : !laborRates || laborRates.length === 0 ? (
            <div className="text-center py-3">
              <p className="text-muted-foreground text-xs">No labor rates defined yet.</p>
              <button
                onClick={() => navigate({ to: '/settings' })}
                className="text-primary text-xs font-medium mt-1 flex items-center gap-1 mx-auto"
              >
                <Settings size={12} />
                Add rates in Settings
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {laborRates.slice(0, 4).map((rate) => (
                <div
                  key={rate.id.toString()}
                  className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2"
                >
                  <span className="text-sm font-medium text-foreground truncate flex-1">
                    {rate.name}
                  </span>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4">
                      {rate.rateType === Variant_flat_hourly.hourly ? 'Hourly' : 'Flat'}
                    </Badge>
                    <span className="text-xs text-primary font-semibold">
                      {formatAmount(rate.amount, rate.rateType)}
                    </span>
                  </div>
                </div>
              ))}
              {laborRates.length > 4 && (
                <p className="text-xs text-muted-foreground text-center pt-1">
                  +{laborRates.length - 4} more rates in Settings
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Inventory Card — All authenticated users */}
      <div className="bg-card rounded-2xl shadow-card border border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package size={16} className="text-primary" />
            <h3 className="font-semibold text-sm text-foreground">Inventory</h3>
          </div>
          <button
            onClick={() => navigate({ to: '/inventory' })}
            className="text-primary text-xs font-medium flex items-center gap-0.5"
          >
            View All <ChevronRight size={14} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-muted/40 p-3 text-center">
            <p className="text-2xl font-display font-bold text-foreground">—</p>
            <p className="text-xs text-muted-foreground mt-0.5">Total Parts</p>
          </div>
          <div className="rounded-xl bg-destructive/10 p-3 text-center">
            <p className="text-2xl font-display font-bold text-destructive">—</p>
            <p className="text-xs text-muted-foreground mt-0.5">Low Stock</p>
          </div>
        </div>
        <button
          onClick={() => navigate({ to: '/inventory' })}
          className="w-full rounded-xl border border-primary/30 bg-primary/5 text-primary text-sm font-medium py-2 hover:bg-primary/10 transition-colors"
        >
          View Inventory
        </button>
      </div>

      {/* Recent Jobs */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm text-foreground">Recent Jobs</h3>
          <button
            onClick={() => navigate({ to: '/jobs' })}
            className="text-primary text-xs font-medium flex items-center gap-0.5"
          >
            View all <ChevronRight size={14} />
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : recentJobs.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border p-6 text-center">
            <Briefcase size={32} className="text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground text-sm">No jobs yet</p>
            <button
              onClick={() => navigate({ to: '/jobs/new' })}
              className="text-primary text-sm font-medium mt-1"
            >
              Create your first job →
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {recentJobs.map((job) => (
              <button
                key={job.id.toString()}
                onClick={() =>
                  navigate({ to: '/jobs/$jobId', params: { jobId: job.id.toString() } })
                }
                className="w-full bg-card rounded-xl border border-border p-3 flex items-center gap-3 text-left hover:shadow-card transition-shadow active:scale-[0.99]"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-foreground truncate">
                    {clients ? getClientName(clients, job.clientId) : `Client #${job.clientId}`}
                  </p>
                  <p className="text-muted-foreground text-xs mt-0.5 truncate">
                    {job.notes || 'No notes'} · {formatJobDate(job.date)}
                  </p>
                </div>
                <Badge variant={statusBadgeVariant(job.status)} className="shrink-0 text-xs">
                  {statusLabel(job.status)}
                </Badge>
              </button>
            ))}
          </div>
        )}
      </div>

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
