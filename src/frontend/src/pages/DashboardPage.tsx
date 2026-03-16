import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  Clock,
  DollarSign,
  Lock,
  Package,
  Users,
} from "lucide-react";
import { JobStatus, RateType } from "../backend";
import type { Client, Job } from "../backend";
import {
  useGetCallerUserProfile,
  useIsOwner,
  useListClients,
  useListJobs,
  useListLaborRates,
} from "../hooks/useQueries";

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
      type="button"
      onClick={onClick}
      className="bg-card rounded-2xl shadow-card border border-border p-4 flex items-center gap-4 w-full text-left hover:shadow-card-hover transition-shadow active:scale-[0.98]"
    >
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${color}`}
      >
        <Icon size={22} className="text-primary-foreground" />
      </div>
      <div>
        <p className="text-2xl font-display font-bold text-foreground leading-none">
          {value}
        </p>
        <p className="text-muted-foreground text-xs mt-1 font-medium">
          {label}
        </p>
      </div>
    </button>
  );
}

function statusLabel(status: JobStatus): string {
  switch (status) {
    case JobStatus.open:
      return "Open";
    case JobStatus.inProgress:
      return "In Progress";
    case JobStatus.complete:
      return "Complete";
    default:
      return "Unknown";
  }
}

function statusBadgeVariant(
  status: JobStatus,
): "destructive" | "secondary" | "default" {
  switch (status) {
    case JobStatus.open:
      return "destructive";
    case JobStatus.inProgress:
      return "secondary";
    case JobStatus.complete:
      return "default";
    default:
      return "default";
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
    return "Unknown date";
  }
}

function formatAmount(amount: bigint, rateType: RateType): string {
  const dollars = (Number(amount) / 100).toFixed(2);
  return rateType === RateType.hourly ? `$${dollars}/hr` : `$${dollars} flat`;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data: jobs, isLoading: jobsLoading } = useListJobs();
  const { data: clients, isLoading: clientsLoading } = useListClients();
  const { data: profile } = useGetCallerUserProfile();
  const isOwner = useIsOwner();
  const { data: laborRates, isLoading: laborRatesLoading } =
    useListLaborRates();

  const totalJobs = jobs?.length ?? 0;
  const openJobs = jobs?.filter((j) => j.status === JobStatus.open).length ?? 0;
  const inProgressJobs =
    jobs?.filter((j) => j.status === JobStatus.inProgress).length ?? 0;
  const completeJobs =
    jobs?.filter((j) => j.status === JobStatus.complete).length ?? 0;
  const totalClients = clients?.length ?? 0;

  const recentJobs = jobs
    ? [...jobs].sort((a, b) => Number(b.date - a.date)).slice(0, 5)
    : [];

  const isLoading = jobsLoading || clientsLoading;

  return (
    <div className="px-4 py-5 space-y-6 animate-fade-in">
      {/* Greeting */}
      <div>
        <h2 className="font-display font-bold text-xl text-foreground">
          {profile ? `Hello, ${profile.name}` : "Dashboard"}
        </h2>
        <p className="text-muted-foreground text-sm">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Metric Cards — Owner Only */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
            <Skeleton key={`sk-${i}`} className="h-20 rounded-2xl" />
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
              onClick={() => navigate({ to: "/jobs" })}
            />
            <MetricCard
              label="In Progress"
              value={inProgressJobs}
              icon={Clock}
              color="bg-primary"
              onClick={() => navigate({ to: "/jobs" })}
            />
            <MetricCard
              label="Completed"
              value={completeJobs}
              icon={CheckCircle2}
              color="bg-primary"
              onClick={() => navigate({ to: "/jobs" })}
            />
            <MetricCard
              label="Total Clients"
              value={totalClients}
              icon={Users}
              color="bg-secondary"
              onClick={() => navigate({ to: "/clients" })}
            />
          </div>

          {/* Status Breakdown — Owner Only */}
          {totalJobs > 0 && (
            <div className="bg-card rounded-2xl shadow-card border border-border p-4">
              <h3 className="font-semibold text-sm text-foreground mb-3">
                Jobs Overview
              </h3>
              <div className="space-y-2">
                {[
                  { label: "Open", count: openJobs, color: "bg-destructive" },
                  {
                    label: "In Progress",
                    count: inProgressJobs,
                    color: "bg-primary",
                  },
                  {
                    label: "Complete",
                    count: completeJobs,
                    color: "bg-accent-foreground",
                  },
                ].map(({ label, count, color }) => (
                  <div key={label} className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${color}`} />
                    <span className="text-sm text-muted-foreground flex-1">
                      {label}
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      {count}
                    </span>
                    <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${color}`}
                        style={{
                          width:
                            totalJobs > 0
                              ? `${(count / totalJobs) * 100}%`
                              : "0%",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Labor Rates Summary — Owner Only */}
          {!laborRatesLoading && laborRates && laborRates.length > 0 && (
            <div className="bg-card rounded-2xl shadow-card border border-border p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <DollarSign size={16} className="text-primary" />
                  <h3 className="font-semibold text-sm text-foreground">
                    Labor Rates
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => navigate({ to: "/settings" })}
                  className="text-xs text-primary flex items-center gap-0.5"
                >
                  Manage <ChevronRight size={12} />
                </button>
              </div>
              <div className="space-y-1.5">
                {laborRates.slice(0, 3).map((rate) => (
                  <div
                    key={rate.id.toString()}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm text-foreground">{rate.name}</span>
                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant="secondary"
                        className="text-xs px-1.5 py-0 h-4"
                      >
                        {rate.rateType === RateType.hourly ? "Hourly" : "Flat"}
                      </Badge>
                      <span className="text-xs font-semibold text-primary">
                        {formatAmount(rate.amount, rate.rateType)}
                      </span>
                    </div>
                  </div>
                ))}
                {laborRates.length > 3 && (
                  <p className="text-xs text-muted-foreground text-center pt-1">
                    +{laborRates.length - 3} more rates
                  </p>
                )}
              </div>
            </div>
          )}
        </>
      ) : (
        /* Non-owner: show subtle notice */
        <div className="bg-card rounded-2xl border border-border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
            <Lock size={18} className="text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              Metrics restricted
            </p>
            <p className="text-xs text-muted-foreground">
              Detailed metrics are visible to the owner only.
            </p>
          </div>
        </div>
      )}

      {/* Inventory Quick-Access — All Users */}
      <button
        type="button"
        className="w-full bg-card rounded-2xl shadow-card border border-border p-4 flex items-center gap-4 cursor-pointer hover:shadow-card-hover transition-shadow active:scale-[0.98] text-left"
        onClick={() => navigate({ to: "/inventory" })}
      >
        <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center shrink-0">
          <Package size={22} className="text-primary-foreground" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-foreground text-sm">Inventory</p>
          <p className="text-xs text-muted-foreground">View and manage parts</p>
        </div>
        <ChevronRight size={16} className="text-muted-foreground" />
      </button>

      {/* Recent Jobs */}
      {recentJobs.length > 0 && (
        <div className="bg-card rounded-2xl shadow-card border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Briefcase size={16} className="text-primary" />
              <h3 className="font-semibold text-sm text-foreground">
                Recent Jobs
              </h3>
            </div>
            <button
              type="button"
              onClick={() => navigate({ to: "/jobs" })}
              className="text-xs text-primary flex items-center gap-0.5"
            >
              View all <ChevronRight size={12} />
            </button>
          </div>
          <div className="space-y-2">
            {recentJobs.map((job: Job) => (
              <button
                type="button"
                key={job.id.toString()}
                onClick={() =>
                  navigate({
                    to: "/jobs/$jobId",
                    params: { jobId: job.id.toString() },
                  })
                }
                className="w-full flex items-center gap-3 py-2 border-b border-border last:border-0 text-left"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {clients
                      ? getClientName(clients, job.clientId)
                      : `Client #${job.clientId}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatJobDate(job.date)}
                  </p>
                </div>
                <Badge
                  variant={statusBadgeVariant(job.status)}
                  className="text-xs shrink-0"
                >
                  {statusLabel(job.status)}
                </Badge>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="pt-2 pb-4 text-center">
        <p className="text-muted-foreground text-xs">
          Built with ❤️ using{" "}
          <a
            href={`https://caffeine.ai/?utm_source=Caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary font-medium"
          >
            caffeine.ai
          </a>{" "}
          · © {new Date().getFullYear()} Reliable Home Appliance Repair LLC
        </p>
      </footer>
    </div>
  );
}
