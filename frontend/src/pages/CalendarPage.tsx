import React, { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, MapPin, GripVertical, X, Navigation, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useListJobs, useListClients } from '../hooks/useQueries';
import { JobStatus } from '../backend';
import type { Job, Client } from '../backend';

// ── Configurable constants ────────────────────────────────────────────────────
const TAX_RATE = 0.08875; // 8.875%
const DEFAULT_DIAGNOSTIC_FEE_CENTS = 8500; // $85.00

// ── EST timezone helpers ──────────────────────────────────────────────────────
const EST_TZ = 'America/New_York';

function toESTDate(timestamp: bigint): Date {
  const ms = Number(timestamp) / 1_000_000;
  return new Date(ms);
}

function formatESTDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: EST_TZ,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function formatESTTime(date: Date): string {
  return (
    new Intl.DateTimeFormat('en-US', {
      timeZone: EST_TZ,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date) + ' EST'
  );
}

function getESTWeekStart(date: Date): Date {
  // Get the Sunday of the current week in EST
  const estStr = new Intl.DateTimeFormat('en-US', {
    timeZone: EST_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
  const [month, day, year] = estStr.split('/').map(Number);
  const estDate = new Date(year, month - 1, day);
  const dow = estDate.getDay();
  estDate.setDate(estDate.getDate() - dow);
  return estDate;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isSameESTDay(jobDate: Date, calDay: Date): boolean {
  const jobStr = new Intl.DateTimeFormat('en-US', {
    timeZone: EST_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(jobDate);
  const calStr = `${String(calDay.getMonth() + 1).padStart(2, '0')}/${String(calDay.getDate()).padStart(2, '0')}/${calDay.getFullYear()}`;
  return jobStr === calStr;
}

// ── Cost calculation ──────────────────────────────────────────────────────────
function calcJobCosts(job: Job) {
  const diagnosticFee = job.estimate ? Number(job.estimate.amount) : DEFAULT_DIAGNOSTIC_FEE_CENTS;
  const laborSubtotal = job.laborLineItems.reduce((sum, item) => sum + Number(item.totalAmount), 0);
  const preTax = diagnosticFee + laborSubtotal;
  const tax = Math.round(preTax * TAX_RATE);
  const postTax = preTax + tax;
  return { diagnosticFee, laborSubtotal, preTax, tax, postTax };
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

// ── Status helpers ────────────────────────────────────────────────────────────
function statusColor(status: JobStatus): string {
  switch (status) {
    case JobStatus.open: return 'bg-blue-100 text-blue-700 border-blue-200';
    case JobStatus.inProgress: return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    case JobStatus.complete: return 'bg-green-100 text-green-700 border-green-200';
    default: return 'bg-muted text-muted-foreground';
  }
}

function statusLabel(status: JobStatus): string {
  switch (status) {
    case JobStatus.open: return 'Open';
    case JobStatus.inProgress: return 'In Progress';
    case JobStatus.complete: return 'Complete';
    default: return status;
  }
}

// ── Job Cost Card ─────────────────────────────────────────────────────────────
function JobCostSummary({ job }: { job: Job }) {
  const [expanded, setExpanded] = useState(false);
  const costs = calcJobCosts(job);

  return (
    <div className="mt-2">
      <button
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        onClick={e => { e.stopPropagation(); setExpanded(!expanded); }}
      >
        <DollarSign className="h-3 w-3" />
        <span>{formatCents(costs.postTax)} (incl. tax)</span>
        <span className="ml-1">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div className="mt-1 p-2 bg-muted/40 rounded text-xs space-y-0.5">
          <div className="flex justify-between text-muted-foreground">
            <span>Diagnostic Fee</span>
            <span>{formatCents(costs.diagnosticFee)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Labor</span>
            <span>{formatCents(costs.laborSubtotal)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Pre-tax Total</span>
            <span>{formatCents(costs.preTax)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Tax ({(TAX_RATE * 100).toFixed(3)}%)</span>
            <span>{formatCents(costs.tax)}</span>
          </div>
          <div className="flex justify-between font-semibold text-foreground border-t border-border pt-1">
            <span>Total</span>
            <span>{formatCents(costs.postTax)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Routing Section ───────────────────────────────────────────────────────────
interface RouteJob {
  job: Job;
  client: Client | undefined;
}

function RoutingSection({ jobs, clients }: { jobs: Job[]; clients: Client[] }) {
  const routeableJobs = jobs.filter(
    j => j.status === JobStatus.open || j.status === JobStatus.inProgress
  );

  const [routeOrder, setRouteOrder] = useState<bigint[]>([]);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const routeJobs: RouteJob[] = routeOrder
    .map(id => {
      const job = routeableJobs.find(j => j.id === id);
      const client = job ? clients.find(c => c.id === job.clientId) : undefined;
      return job ? { job, client } : null;
    })
    .filter(Boolean) as RouteJob[];

  const unaddedJobs = routeableJobs.filter(j => !routeOrder.includes(j.id));

  const handleDragStart = (index: number) => {
    dragItem.current = index;
  };

  const handleDragEnter = (index: number) => {
    dragOverItem.current = index;
  };

  const handleDragEnd = () => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    if (dragItem.current === dragOverItem.current) return;
    const newOrder = [...routeOrder];
    const draggedId = newOrder.splice(dragItem.current, 1)[0];
    newOrder.splice(dragOverItem.current, 0, draggedId);
    setRouteOrder(newOrder);
    dragItem.current = null;
    dragOverItem.current = null;
  };

  const addToRoute = (jobId: bigint) => {
    setRouteOrder(prev => [...prev, jobId]);
  };

  const removeFromRoute = (jobId: bigint) => {
    setRouteOrder(prev => prev.filter(id => id !== jobId));
  };

  const clearRoute = () => setRouteOrder([]);

  const getMapsUrl = (address: string) =>
    `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;

  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Navigation className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-foreground">Routing</h2>
          <Badge variant="outline" className="text-xs">{routeJobs.length} stops</Badge>
        </div>
        {routeOrder.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearRoute} className="text-muted-foreground text-xs">
            Clear Route
          </Button>
        )}
      </div>

      {/* Route List (drag-and-drop) */}
      {routeJobs.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Route Order</p>
          {routeJobs.map((rj, index) => (
            <div
              key={rj.job.id.toString()}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragEnter={() => handleDragEnter(index)}
              onDragEnd={handleDragEnd}
              onDragOver={e => e.preventDefault()}
              className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border cursor-grab active:cursor-grabbing select-none"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex-shrink-0">
                {index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {rj.client?.name ?? `Job #${rj.job.id}`}
                </p>
                {rj.client?.address && (
                  <p className="text-xs text-muted-foreground truncate">{rj.client.address}</p>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {rj.client?.address && (
                  <a
                    href={getMapsUrl(rj.client.address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 rounded hover:bg-muted transition-colors"
                    onClick={e => e.stopPropagation()}
                    title="Open in Google Maps"
                  >
                    <MapPin className="h-4 w-4 text-primary" />
                  </a>
                )}
                <button
                  onClick={() => removeFromRoute(rj.job.id)}
                  className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Available Jobs to Add */}
      {unaddedJobs.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Available Jobs ({unaddedJobs.length})
          </p>
          {unaddedJobs.map(job => {
            const client = clients.find(c => c.id === job.clientId);
            return (
              <div
                key={job.id.toString()}
                className="flex items-center gap-3 p-3 bg-muted/10 rounded-lg border border-dashed border-border"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {client?.name ?? `Job #${job.id}`}
                  </p>
                  {client?.address && (
                    <p className="text-xs text-muted-foreground truncate">{client.address}</p>
                  )}
                  <Badge className={`text-xs mt-1 ${statusColor(job.status)}`}>
                    {statusLabel(job.status)}
                  </Badge>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-shrink-0 h-7 text-xs"
                  onClick={() => addToRoute(job.id)}
                >
                  + Add
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {routeableJobs.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No open or in-progress jobs to route.
        </p>
      )}

      {routeableJobs.length > 0 && routeJobs.length === 0 && unaddedJobs.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          Click "+ Add" to add jobs to your route, then drag to reorder.
        </p>
      )}
    </div>
  );
}

// ── Main Calendar Page ────────────────────────────────────────────────────────
export default function CalendarPage() {
  const { data: jobs = [], isLoading: jobsLoading } = useListJobs();
  const { data: clients = [], isLoading: clientsLoading } = useListClients();

  const [weekStart, setWeekStart] = useState(() => getESTWeekStart(new Date()));
  const [activeTab, setActiveTab] = useState<'calendar' | 'routing'>('calendar');

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const prevWeek = () => setWeekStart(d => addDays(d, -7));
  const nextWeek = () => setWeekStart(d => addDays(d, 7));
  const goToday = () => setWeekStart(getESTWeekStart(new Date()));

  const getJobsForDay = (day: Date): Job[] => {
    return jobs.filter(job => {
      const jobDate = toESTDate(job.date);
      return isSameESTDay(jobDate, day);
    });
  };

  const weekLabel = () => {
    const start = new Intl.DateTimeFormat('en-US', {
      timeZone: EST_TZ,
      month: 'short',
      day: 'numeric',
    }).format(weekStart);
    const end = new Intl.DateTimeFormat('en-US', {
      timeZone: EST_TZ,
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(addDays(weekStart, 6));
    return `${start} – ${end} EST`;
  };

  const isToday = (day: Date): boolean => {
    const todayStr = new Intl.DateTimeFormat('en-US', {
      timeZone: EST_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const dayStr = `${String(day.getMonth() + 1).padStart(2, '0')}/${String(day.getDate()).padStart(2, '0')}/${day.getFullYear()}`;
    return todayStr === dayStr;
  };

  if (jobsLoading || clientsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card border-b border-border px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="font-semibold text-foreground">Schedule</h1>
          <Button variant="outline" size="sm" onClick={goToday} className="text-xs">
            Today
          </Button>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 bg-muted/50 rounded-lg p-1">
          <button
            className={`flex-1 text-sm py-1.5 rounded-md font-medium transition-colors ${
              activeTab === 'calendar'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('calendar')}
          >
            Calendar
          </button>
          <button
            className={`flex-1 text-sm py-1.5 rounded-md font-medium transition-colors ${
              activeTab === 'routing'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('routing')}
          >
            Routing
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {activeTab === 'calendar' && (
          <>
            {/* Week Navigation */}
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={prevWeek}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <span className="text-sm font-medium text-foreground">{weekLabel()}</span>
              <Button variant="ghost" size="icon" onClick={nextWeek}>
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>

            {/* Days */}
            <div className="space-y-3">
              {weekDays.map((day, idx) => {
                const dayJobs = getJobsForDay(day);
                const today = isToday(day);
                return (
                  <div
                    key={idx}
                    className={`rounded-xl border ${today ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}
                  >
                    {/* Day Header */}
                    <div className={`px-4 py-2 border-b ${today ? 'border-primary/20' : 'border-border'} flex items-center justify-between`}>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-semibold ${today ? 'text-primary' : 'text-foreground'}`}>
                          {formatESTDate(day)}
                        </span>
                        {today && (
                          <Badge className="text-xs bg-primary text-primary-foreground">Today</Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {dayJobs.length} job{dayJobs.length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Jobs */}
                    <div className="p-3 space-y-2">
                      {dayJobs.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-2">No jobs scheduled</p>
                      ) : (
                        dayJobs.map(job => {
                          const client = clients.find(c => c.id === job.clientId);
                          const jobDate = toESTDate(job.date);
                          return (
                            <div
                              key={job.id.toString()}
                              className="p-3 bg-muted/30 rounded-lg border border-border/50"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-sm font-medium text-foreground truncate">
                                      {client?.name ?? `Job #${job.id}`}
                                    </p>
                                    <Badge className={`text-xs ${statusColor(job.status)}`}>
                                      {statusLabel(job.status)}
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {formatESTTime(jobDate)}
                                  </p>
                                  {client?.address && (
                                    <div className="flex items-center gap-1 mt-1">
                                      <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                      <a
                                        href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(client.address)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-primary hover:underline truncate"
                                      >
                                        {client.address}
                                      </a>
                                    </div>
                                  )}
                                  {job.notes && (
                                    <p className="text-xs text-muted-foreground mt-1 truncate">{job.notes}</p>
                                  )}
                                </div>
                              </div>
                              {/* Cost Summary */}
                              <JobCostSummary job={job} />
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {activeTab === 'routing' && (
          <RoutingSection jobs={jobs} clients={clients} />
        )}
      </div>
    </div>
  );
}
