import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useListJobs, useListClients } from '../hooks/useQueries';
import type { Job } from '../backend';
import { JobStatus } from '../backend';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Briefcase, Plus, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

function getJobDate(timestamp: bigint): string {
  try {
    const ms = Number(timestamp / BigInt(1_000_000));
    return format(new Date(ms), 'MMM d, yyyy');
  } catch {
    return 'Unknown date';
  }
}

function statusBadgeVariant(status: JobStatus): 'destructive' | 'secondary' | 'default' {
  switch (status) {
    case JobStatus.open: return 'destructive';
    case JobStatus.inProgress: return 'secondary';
    case JobStatus.complete: return 'default';
    default: return 'default';
  }
}

function statusLabel(status: JobStatus): string {
  switch (status) {
    case JobStatus.open: return 'Open';
    case JobStatus.inProgress: return 'In Progress';
    case JobStatus.complete: return 'Complete';
    default: return 'Unknown';
  }
}

function statusIcon(status: JobStatus) {
  switch (status) {
    case JobStatus.open: return AlertCircle;
    case JobStatus.inProgress: return Clock;
    case JobStatus.complete: return CheckCircle2;
    default: return AlertCircle;
  }
}

interface JobCardProps {
  job: Job;
  clientName: string;
  onClick: () => void;
}

function JobCard({ job, clientName, onClick }: JobCardProps) {
  const Icon = statusIcon(job.status);
  return (
    <button
      onClick={onClick}
      className="w-full bg-card rounded-2xl border border-border p-4 text-left hover:shadow-card transition-shadow active:scale-[0.99] space-y-2"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground truncate">{clientName}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{getJobDate(job.date)}</p>
        </div>
        <Badge variant={statusBadgeVariant(job.status)} className="shrink-0 flex items-center gap-1 text-xs">
          <Icon size={11} />
          {statusLabel(job.status)}
        </Badge>
      </div>
      {job.notes && (
        <p className="text-sm text-muted-foreground truncate">{job.notes}</p>
      )}
    </button>
  );
}

const STATUS_GROUPS = [
  { status: JobStatus.open, label: 'Open', icon: AlertCircle },
  { status: JobStatus.inProgress, label: 'In Progress', icon: Clock },
  { status: JobStatus.complete, label: 'Complete', icon: CheckCircle2 },
];

export default function JobsPage() {
  const navigate = useNavigate();
  const { data: jobs, isLoading: jobsLoading } = useListJobs();
  const { data: clients } = useListClients();
  const [activeGroup, setActiveGroup] = useState<JobStatus | 'all'>('all');

  const getClientName = (clientId: bigint): string => {
    return clients?.find((c) => c.id === clientId)?.name ?? `Client #${clientId}`;
  };

  const filteredJobs = jobs
    ? activeGroup === 'all'
      ? jobs
      : jobs.filter((j) => j.status === activeGroup)
    : [];

  const groupedJobs = STATUS_GROUPS.map((g) => ({
    ...g,
    jobs: jobs?.filter((j) => j.status === g.status) ?? [],
  }));

  const isLoading = jobsLoading;

  return (
    <div className="px-4 py-5 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Briefcase size={20} className="text-primary" />
          <h2 className="font-display font-bold text-xl text-foreground">Jobs</h2>
        </div>
        <Button
          onClick={() => navigate({ to: '/jobs/new' })}
          size="sm"
          className="bg-primary text-primary-foreground rounded-xl h-8 px-3 text-xs font-semibold"
        >
          <Plus size={14} className="mr-1" />
          New Job
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        <button
          onClick={() => setActiveGroup('all')}
          className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
            activeGroup === 'all'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          All ({jobs?.length ?? 0})
        </button>
        {STATUS_GROUPS.map(({ status, label, icon: Icon }) => {
          const count = jobs?.filter((j) => j.status === status).length ?? 0;
          return (
            <button
              key={status}
              onClick={() => setActiveGroup(status)}
              className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                activeGroup === status
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              <Icon size={11} />
              {label} ({count})
            </button>
          );
        })}
      </div>

      {/* Jobs List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-8 text-center">
          <Briefcase size={32} className="text-muted-foreground mx-auto mb-3" />
          <p className="font-semibold text-foreground text-sm">
            {activeGroup === 'all' ? 'No jobs yet' : `No ${statusLabel(activeGroup as JobStatus)} jobs`}
          </p>
          <p className="text-muted-foreground text-xs mt-1">
            {activeGroup === 'all' ? 'Create your first job to get started.' : 'Try a different filter.'}
          </p>
          {activeGroup === 'all' && (
            <Button
              onClick={() => navigate({ to: '/jobs/new' })}
              size="sm"
              className="mt-4 rounded-xl bg-primary text-primary-foreground"
            >
              Create Job
            </Button>
          )}
        </div>
      ) : activeGroup !== 'all' ? (
        <div className="space-y-3">
          {filteredJobs.map((job) => (
            <JobCard
              key={job.id.toString()}
              job={job}
              clientName={getClientName(job.clientId)}
              onClick={() => navigate({ to: '/jobs/$jobId', params: { jobId: job.id.toString() } })}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          {groupedJobs.map(({ status, label, icon: Icon, jobs: groupJobs }) =>
            groupJobs.length > 0 ? (
              <div key={status}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon size={14} className="text-muted-foreground" />
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {label} ({groupJobs.length})
                  </h3>
                </div>
                <div className="space-y-2">
                  {groupJobs.map((job) => (
                    <JobCard
                      key={job.id.toString()}
                      job={job}
                      clientName={getClientName(job.clientId)}
                      onClick={() => navigate({ to: '/jobs/$jobId', params: { jobId: job.id.toString() } })}
                    />
                  ))}
                </div>
              </div>
            ) : null
          )}
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
          </a>
          {' '}· © {new Date().getFullYear()} Reliable Home Appliance Repair LLC
        </p>
      </footer>
    </div>
  );
}
