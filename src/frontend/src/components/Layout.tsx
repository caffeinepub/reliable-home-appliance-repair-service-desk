import { Outlet, useNavigate } from "@tanstack/react-router";
import {
  BarChart2,
  CalendarDays,
  ClipboardList,
  Home,
  Package,
  Settings,
  Users,
  Wrench,
} from "lucide-react";
import { useEffect } from "react";
import { useActor } from "../hooks/useActor";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import { useGetCallerUserProfile } from "../hooks/useQueries";

const NAV_ITEMS = [
  { path: "/", label: "Dashboard", icon: Home },
  { path: "/clients", label: "Clients", icon: Users },
  { path: "/jobs", label: "Jobs", icon: ClipboardList },
  { path: "/inventory", label: "Inventory", icon: Package },
  { path: "/invoices", label: "Invoices", icon: BarChart2 },
  { path: "/labor-rates", label: "Labor Rates", icon: Wrench },
  { path: "/settings", label: "Settings", icon: Settings },
];

export default function Layout() {
  const navigate = useNavigate();
  const { identity, isInitializing } = useInternetIdentity();
  const { actor } = useActor();
  const {
    data: userProfile,
    isLoading: profileLoading,
    isFetched,
  } = useGetCallerUserProfile();

  const currentPath =
    typeof window !== "undefined" ? window.location.pathname : "/";
  const isAuthPage =
    currentPath === "/login" || currentPath === "/profile-setup";

  const principalStr = identity?.getPrincipal().toString() ?? "";
  const localStorageKey = principalStr ? `rhar_profile_${principalStr}` : null;

  // Cache profile in localStorage when successfully fetched
  useEffect(() => {
    if (userProfile && localStorageKey) {
      localStorage.setItem(localStorageKey, JSON.stringify(userProfile));
    }
  }, [userProfile, localStorageKey]);

  // Navigation / auth guard
  useEffect(() => {
    if (isInitializing) return;
    if (!identity) {
      navigate({ to: "/login" });
      return;
    }
    if (!actor) return;
    if (profileLoading || !isFetched) return;

    // Check localStorage cache before redirecting to profile-setup
    const cachedProfile = localStorageKey
      ? localStorage.getItem(localStorageKey)
      : null;
    if (!userProfile && !cachedProfile) {
      navigate({ to: "/profile-setup" });
    }
  }, [
    identity,
    isInitializing,
    actor,
    profileLoading,
    isFetched,
    userProfile,
    navigate,
    localStorageKey,
  ]);

  const cachedProfileStr = localStorageKey
    ? localStorage.getItem(localStorageKey)
    : null;
  const showNav =
    !!identity && !isAuthPage && (!!userProfile || !!cachedProfileStr);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-primary text-primary-foreground shadow-md safe-top">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary-foreground/15 shrink-0">
            <img
              src="/assets/generated/logo-wrench-gear-house-transparent.dim_200x200.png"
              alt="Reliable Home Appliance Repair LLC"
              className="w-8 h-8 object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
                (e.target as HTMLImageElement).parentElement!.innerHTML =
                  '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>';
              }}
            />
          </div>
          <div className="min-w-0">
            <h1 className="font-display font-700 text-base leading-tight tracking-wide truncate">
              Reliable Home Appliance Repair LLC
            </h1>
            <p className="text-primary-foreground/70 text-xs font-medium tracking-wider uppercase">
              Service Desk
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto pb-20">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      {showNav && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border shadow-lg safe-bottom">
          <div className="flex items-stretch">
            {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
              const isActive =
                path === "/"
                  ? currentPath === "/"
                  : currentPath.startsWith(path);
              return (
                <button
                  key={path}
                  type="button"
                  onClick={() => navigate({ to: path })}
                  className={`flex-1 flex flex-col items-center justify-center py-2 px-1 gap-0.5 text-[10px] font-medium transition-colors min-w-0 ${
                    isActive
                      ? "text-primary bg-primary/5"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  data-ocid={`nav.${label.toLowerCase().replace(/ /g, "_")}.link`}
                >
                  <Icon className="h-4.5 w-4.5 shrink-0" />
                  <span className="truncate w-full text-center">{label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
