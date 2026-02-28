import { useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useListJobs, useListClients } from '../hooks/useQueries';
import type { Job, Client } from '../backend';
import { Variant_open_complete_inProgress } from '../backend';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  MapPin,
  Briefcase,
  Clock,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay } from 'date-fns';

function getJobDate(timestamp: bigint): Date {
  const ms = Number(timestamp / BigInt(1_000_000));
  return new Date(ms);
}

function getClientForJob(clients: Client[] | undefined, clientId: bigint): Client | undefined {
  return clients?.find((c) => c.id === clientId);
}

const STATUS_CONFIG = {
  [Variant_open_complete_inProgress.open]: {
    label: 'Open',
    icon: AlertCircle,
    badgeVariant: 'destructive' as const,
    dotColor: 'bg-destructive',
  },
  [Variant_open_complete_inProgress.inProgress]: {
    label: 'In Progress',
    icon: Clock,
    badgeVariant: 'secondary' as const,
    dotColor: 'bg-primary',
  },
  [Variant_open_complete_inProgress.complete]: {
    label: 'Complete',
    icon: CheckCircle2,
    badgeVariant: 'default' as const,
    dotColor: 'bg-accent-foreground',
  },
};

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface JobCardProps {
  job: Job;
  client: Client | undefined;
  onClick: () => void;
}

function JobCard({ job, client, onClick }: JobCardProps) {
  const config = STATUS_CONFIG[job.status];
  const StatusIcon = config.icon;
  const hasAddress = !!(client?.address?.trim());
  const mapsUrl = hasAddress
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(client!.address)}`
    : null;

  return (
    <div className="bg-card rounded-xl border border-border p-2.5 space-y-1.5 hover:shadow-card transition-shadow">
      <button
        onClick={onClick}
        className="w-full text-left"
      >
        <div className="flex items-start gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${config.dotColor}`} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground truncate leading-tight">
              {client?.name ?? `Client #${job.clientId}`}
            </p>
            {job.notes && (
              <p className="text-[10px] text-muted-foreground truncate mt-0.5 leading-tight">
                {job.notes}
              </p>
            )}
          </div>
        </div>
      </button>

      <div className="flex items-center justify-between gap-1">
        <Badge variant={config.badgeVariant} className="text-[9px] px-1 py-0 h-3.5 leading-none">
          {config.label}
        </Badge>
        {mapsUrl && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-primary transition-colors"
                  aria-label={`View ${client?.name ?? 'client'} on Google Maps`}
                >
                  <MapPin size={10} className="shrink-0" />
                  <span className="hidden sm:inline text-[9px]">Map</span>
                </a>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                <p>View on Google Maps</p>
                <p className="text-muted-foreground text-[10px] max-w-[180px] truncate">{client?.address}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const navigate = useNavigate();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));

  const { data: jobs, isLoading: jobsLoading } = useListJobs();
  const { data: clients, isLoading: clientsLoading } = useListClients();

  const isLoading = jobsLoading || clientsLoading;

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  const jobsByDay = useMemo(() => {
    if (!jobs) return {};
    const map: Record<string, Job[]> = {};
    weekDays.forEach((day) => {
      const key = format(day, 'yyyy-MM-dd');
      map[key] = jobs.filter((job) => {
        const jobDate = getJobDate(job.date);
        return isSameDay(jobDate, day);
      });
    });
    return map;
  }, [jobs, weekDays]);

  const totalThisWeek = useMemo(() => {
    return Object.values(jobsByDay).reduce((sum, arr) => sum + arr.length, 0);
  }, [jobsByDay]);

  const today = new Date();
  const isCurrentWeek = isSameDay(weekStart, startOfWeek(today, { weekStartsOn: 0 }));

  return (
    <div className="px-4 py-5 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar size={20} className="text-primary" />
          <h2 className="font-display font-bold text-xl text-foreground">Calendar</h2>
        </div>
        {!isCurrentWeek && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setWeekStart(startOfWeek(today, { weekStartsOn: 0 }))}
            className="text-xs text-primary h-7 px-2 rounded-lg"
          >
            Today
          </Button>
        )}
      </div>

      {/* Week Navigation */}
      <div className="bg-card rounded-2xl border border-border p-3">
        <div className="flex items-center justify-between mb-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setWeekStart((w) => subWeeks(w, 1))}
            className="h-8 w-8 rounded-xl"
          >
            <ChevronLeft size={16} />
          </Button>
          <div className="text-center">
            <p className="font-semibold text-sm text-foreground">
              {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {totalThisWeek} job{totalThisWeek !== 1 ? 's' : ''} this week
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setWeekStart((w) => addWeeks(w, 1))}
            className="h-8 w-8 rounded-xl"
          >
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>

      {/* Weekly Grid */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {weekDays.map((day) => {
            const key = format(day, 'yyyy-MM-dd');
            const dayJobs = jobsByDay[key] ?? [];
            const isToday = isSameDay(day, today);

            return (
              <div
                key={key}
                className={`rounded-2xl border transition-colors ${
                  isToday
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-card'
                }`}
              >
                {/* Day Header */}
                <div className={`flex items-center justify-between px-3 py-2 border-b ${isToday ? 'border-primary/20' : 'border-border'}`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                      isToday
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {format(day, 'd')}
                    </div>
                    <div>
                      <p className={`text-xs font-semibold ${isToday ? 'text-primary' : 'text-foreground'}`}>
                        {DAY_LABELS[day.getDay()]}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{format(day, 'MMM d')}</p>
                    </div>
                  </div>
                  {dayJobs.length > 0 && (
                    <Badge variant="secondary" className="text-xs h-5 px-1.5">
                      {dayJobs.length}
                    </Badge>
                  )}
                </div>

                {/* Jobs for this day */}
                <div className="p-2">
                  {dayJobs.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground text-center py-2">No jobs scheduled</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      {dayJobs.map((job) => (
                        <JobCard
                          key={job.id.toString()}
                          job={job}
                          client={getClientForJob(clients, job.clientId)}
                          onClick={() => navigate({ to: '/jobs/$jobId', params: { jobId: job.id.toString() } })}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && totalThisWeek === 0 && (
        <div className="bg-card rounded-2xl border border-border p-8 text-center">
          <Briefcase size={32} className="text-muted-foreground mx-auto mb-3" />
          <p className="font-semibold text-foreground text-sm">No jobs this week</p>
          <p className="text-muted-foreground text-xs mt-1">Jobs will appear here based on their scheduled date.</p>
          <Button
            onClick={() => navigate({ to: '/jobs/new' })}
            size="sm"
            className="mt-4 rounded-xl bg-primary text-primary-foreground"
          >
            Schedule a Job
          </Button>
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
