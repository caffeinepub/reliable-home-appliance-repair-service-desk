import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { useGetCallerUserProfile } from '../hooks/useQueries';
import { useEffect } from 'react';
import { LayoutDashboard, Users, Briefcase, Settings, Package } from 'lucide-react';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/clients', label: 'Clients', icon: Users },
  { path: '/jobs', label: 'Jobs', icon: Briefcase },
  { path: '/inventory', label: 'Inventory', icon: Package },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export default function Layout() {
  const navigate = useNavigate();
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const { identity, isInitializing } = useInternetIdentity();
  const { data: userProfile, isLoading: profileLoading, isFetched } = useGetCallerUserProfile();

  const isAuthenticated = !!identity;
  const isAuthPage = currentPath === '/login' || currentPath === '/profile-setup';

  useEffect(() => {
    if (isInitializing) return;
    if (!isAuthenticated && !isAuthPage) {
      navigate({ to: '/login' });
      return;
    }
    if (
      isAuthenticated &&
      !profileLoading &&
      isFetched &&
      userProfile === null &&
      currentPath !== '/profile-setup'
    ) {
      navigate({ to: '/profile-setup' });
      return;
    }
    if (isAuthenticated && userProfile && currentPath === '/login') {
      navigate({ to: '/' });
    }
  }, [
    isAuthenticated,
    isInitializing,
    profileLoading,
    isFetched,
    userProfile,
    currentPath,
    isAuthPage,
    navigate,
  ]);

  const showNav = isAuthenticated && !isAuthPage && userProfile !== null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-primary text-primary-foreground shadow-md safe-top">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary-foreground/15 shrink-0">
            <img
              src="/assets/generated/reliable-logo.dim_256x256.png"
              alt="Logo"
              className="w-7 h-7 object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                (e.target as HTMLImageElement).parentElement!.innerHTML =
                  '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>';
              }}
            />
          </div>
          <div className="min-w-0">
            <h1 className="font-display font-700 text-base leading-tight tracking-wide truncate">
              Reliable Home Appliance Repair
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
                path === '/' ? currentPath === '/' : currentPath.startsWith(path);
              return (
                <button
                  key={path}
                  onClick={() => navigate({ to: path })}
                  className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 px-1 transition-colors min-h-[56px] ${
                    isActive
                      ? 'text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon
                    size={20}
                    strokeWidth={isActive ? 2.5 : 1.8}
                    className={isActive ? 'text-primary' : ''}
                  />
                  <span
                    className={`text-[9px] font-semibold tracking-wide ${
                      isActive ? 'text-primary' : ''
                    }`}
                  >
                    {label}
                  </span>
                  {isActive && (
                    <span className="absolute bottom-0 w-8 h-0.5 bg-primary rounded-t-full" />
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
