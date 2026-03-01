import { RouterProvider, createRouter, createRoute, createRootRoute } from '@tanstack/react-router';
import Layout from './components/Layout';
import DashboardPage from './pages/DashboardPage';
import ClientsPage from './pages/ClientsPage';
import ClientDetailPage from './pages/ClientDetailPage';
import JobsPage from './pages/JobsPage';
import JobDetailPage from './pages/JobDetailPage';
import SettingsPage from './pages/SettingsPage';
import LoginPage from './pages/LoginPage';
import ProfileSetupPage from './pages/ProfileSetupPage';
import InvoicePreviewPage from './pages/InvoicePreviewPage';
import CalendarPage from './pages/CalendarPage';
import InventoryPage from './pages/InventoryPage';

// Root route with Layout
const rootRoute = createRootRoute({
  component: () => <Layout />,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: DashboardPage,
});

const clientsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/clients',
  component: ClientsPage,
});

// Static /clients/new MUST be declared BEFORE the dynamic /clients/$clientId
const clientNewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/clients/new',
  component: ClientDetailPage,
});

const clientDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/clients/$clientId',
  component: ClientDetailPage,
});

const jobsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/jobs',
  component: JobsPage,
});

// Static /jobs/new MUST be declared BEFORE the dynamic /jobs/$jobId
const jobNewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/jobs/new',
  component: JobDetailPage,
});

const jobDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/jobs/$jobId',
  component: JobDetailPage,
});

const invoiceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/invoice/$jobId',
  component: InvoicePreviewPage,
});

const calendarRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/calendar',
  component: CalendarPage,
});

const inventoryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/inventory',
  component: InventoryPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsPage,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
});

const profileSetupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/profile-setup',
  component: ProfileSetupPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  clientsRoute,
  clientNewRoute,
  clientDetailRoute,
  jobsRoute,
  jobNewRoute,
  jobDetailRoute,
  invoiceRoute,
  calendarRoute,
  inventoryRoute,
  settingsRoute,
  loginRoute,
  profileSetupRoute,
]);

const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export default function App() {
  return <RouterProvider router={router} />;
}
