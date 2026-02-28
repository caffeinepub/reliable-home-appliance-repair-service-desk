import { useNavigate } from '@tanstack/react-router';
import { useListJobs, useListClients } from '../hooks/useQueries';
import type { Job, Client } from '../backend';
import { Variant_open_complete_inProgress } from '../backend';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Briefcase, ChevronRight, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

function getClientName(clients: Client[] | undefined, clientId: bigint): string {
  const client = clients?.find((c) => c.id === clientId);
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

const STATUS_CONFIG = {
  [Variant_open_complete_inProgress.open]: {
    label: 'Open',
    icon: AlertCircle,
    badgeVariant: 'destructive' as const,
    headerColor: 'text-destructive',
    bgColor: 'bg-destructive/10',
  },
  [Variant_open_complete_inProgress.inProgress]: {
    label: 'In Progress',
    icon: Clock,
    badgeVariant: 'secondary' as const,
    headerColor: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  [Variant_open_complete_inProgress.complete]: {
    label: 'Complete',
    icon: CheckCircle2,
    badgeVariant: 'default' as const,
    headerColor: 'text-foreground',
    bgColor: 'bg-muted',
  },
};

function JobCard({
  job,
  clients,
  onClick,
}: {
  job: Job;
  clients: Client[] | undefined;
  onClick: () => void;
}) {
  const config = STATUS_CONFIG[job.status];

  return (
    <button
      onClick={onClick}
      className="w-full bg-card rounded-xl border border-border p-3.5 text-left hover:shadow-card transition-all active:scale-[0.99]"
    >
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${config.bgColor}`}>
          <config.icon size={16} className={config.headerColor} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-sm text-foreground truncate">
              {getClientName(clients, job.clientId)}
            </p>
            <ChevronRight size={14} className="text-muted-foreground shrink-0" />
          </div>
          <p className="text-muted-foreground text-xs mt-0.5 truncate">
            {job.notes || 'No description'} · {formatJobDate(job.date)}
          </p>
          {job.maintenancePackage && (
            <p className="text-xs text-primary mt-1 font-medium truncate">
              📦 {job.maintenancePackage}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

function StatusSection({
  status,
  jobs,
  clients,
  onJobClick,
}: {
  status: Variant_open_complete_inProgress;
  jobs: Job[];
  clients: Client[] | undefined;
  onJobClick: (jobId: string) => void;
}) {
  const config = STATUS_CONFIG[status];
  if (jobs.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <config.icon size={14} className={config.headerColor} />
        <h3 className={`text-xs font-bold uppercase tracking-wider ${config.headerColor}`}>
          {config.label}
        </h3>
        <Badge variant={config.badgeVariant} className="text-xs px-1.5 py-0 h-4">
          {jobs.length}
        </Badge>
      </div>
      <div className="space-y-2">
        {jobs.map((job) => (
          <JobCard
            key={job.id.toString()}
            job={job}
            clients={clients}
            onClick={() => onJobClick(job.id.toString())}
          />
        ))}
      </div>
    </div>
  );
}

export default function JobsPage() {
  const navigate = useNavigate();
  const { data: jobs, isLoading: jobsLoading } = useListJobs();
  const { data: clients, isLoading: clientsLoading } = useListClients();

  const isLoading = jobsLoading || clientsLoading;

  const openJobs = jobs?.filter((j) => j.status === Variant_open_complete_inProgress.open) ?? [];
  const inProgressJobs = jobs?.filter((j) => j.status === Variant_open_complete_inProgress.inProgress) ?? [];
  const completeJobs = jobs?.filter((j) => j.status === Variant_open_complete_inProgress.complete) ?? [];

  const handleJobClick = (jobId: string) => {
    navigate({ to: '/jobs/$jobId', params: { jobId } });
  };

  return (
    <div className="px-4 py-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-xl text-foreground">Jobs</h2>
          <p className="text-muted-foreground text-xs">
            {jobs ? `${jobs.length} total` : 'Loading...'}
          </p>
        </div>
        <Button
          onClick={() => navigate({ to: '/jobs/new' })}
          size="sm"
          className="bg-primary text-primary-foreground rounded-xl gap-1.5 font-semibold"
        >
          <Plus size={16} />
          New Job
        </Button>
      </div>

      {/* Job List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : jobs?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Briefcase size={40} className="text-muted-foreground mb-3" />
          <p className="font-medium text-foreground">No jobs yet</p>
          <p className="text-muted-foreground text-sm mt-1">Create your first job to get started</p>
          <Button
            onClick={() => navigate({ to: '/jobs/new' })}
            className="mt-4 bg-primary text-primary-foreground rounded-xl"
            size="sm"
          >
            <Plus size={16} className="mr-1.5" />
            New Job
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          <StatusSection
            status={Variant_open_complete_inProgress.open}
            jobs={openJobs}
            clients={clients}
            onJobClick={handleJobClick}
          />
          <StatusSection
            status={Variant_open_complete_inProgress.inProgress}
            jobs={inProgressJobs}
            clients={clients}
            onJobClick={handleJobClick}
          />
          <StatusSection
            status={Variant_open_complete_inProgress.complete}
            jobs={completeJobs}
            clients={clients}
            onJobClick={handleJobClick}
          />
        </div>
      )}
    </div>
  );
}
