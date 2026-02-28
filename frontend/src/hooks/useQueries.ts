import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';
import { useInternetIdentity } from './useInternetIdentity';
import type { Client, Job, JobStatus, LaborRate, LaborLineItem, Part, UserProfile, StripeConfiguration, ShoppingItem } from '../backend';

// ── Owner Principal ───────────────────────────────────────────────────────────
// IMPORTANT: This is the stable owner principal. Do NOT change this value.
// Owner: q5rzs-s67ph-qtb5w-e66j5-2iqax-vlwa5-5pqxy-yosti-xhcis-ocfw6-yqe
const OWNER_PRINCIPAL = 'q5rzs-s67ph-qtb5w-e66j5-2iqax-vlwa5-5pqxy-yosti-xhcis-ocfw6-yqe';

export function useIsOwner(): boolean {
  const { identity } = useInternetIdentity();
  if (!identity) return false;
  return identity.getPrincipal().toString() === OWNER_PRINCIPAL;
}

// ── Clients ──────────────────────────────────────────────────────────────────

export function useListClients() {
  const { actor, isFetching } = useActor();
  return useQuery<Client[]>({
    queryKey: ['clients'],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listClients();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetClient(clientId: bigint | undefined) {
  const { actor, isFetching } = useActor();
  return useQuery<Client | null>({
    queryKey: ['client', clientId?.toString()],
    queryFn: async () => {
      if (!actor || clientId === undefined) return null;
      return actor.getClient(clientId);
    },
    enabled: !!actor && !isFetching && clientId !== undefined,
  });
}

export function useCreateClient() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (client: Client) => {
      if (!actor) throw new Error('Actor not available');
      return actor.createClient(client);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}

export function useUpdateClient() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (client: Client) => {
      if (!actor) throw new Error('Actor not available');
      return actor.updateClient(client);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['client', variables.id.toString()] });
    },
  });
}

export function useDeleteClient() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (clientId: bigint) => {
      if (!actor) throw new Error('Actor not available');
      return actor.deleteClient(clientId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}

// ── Jobs ─────────────────────────────────────────────────────────────────────

export function useListJobs() {
  const { actor, isFetching } = useActor();
  return useQuery<Job[]>({
    queryKey: ['jobs'],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listJobs();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetJob(jobId: bigint | undefined) {
  const { actor, isFetching } = useActor();
  return useQuery<Job | null>({
    queryKey: ['job', jobId?.toString()],
    queryFn: async () => {
      if (!actor || jobId === undefined) return null;
      return actor.getJob(jobId);
    },
    enabled: !!actor && !isFetching && jobId !== undefined,
  });
}

export function useCreateJob() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (job: Job) => {
      if (!actor) throw new Error('Actor not available');
      return actor.createJob(job);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

export function useUpdateJob() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (job: Job) => {
      if (!actor) throw new Error('Actor not available');
      return actor.updateJob(job);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job', variables.id.toString()] });
    },
  });
}

export function useUpdateJobStatus() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ jobId, status }: { jobId: bigint; status: JobStatus }) => {
      if (!actor) throw new Error('Actor not available');
      return actor.updateJobStatus(jobId, status);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

export function useDeleteJob() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: bigint) => {
      if (!actor) throw new Error('Actor not available');
      return actor.deleteJob(jobId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

// ── Labor Line Items ──────────────────────────────────────────────────────────

export function useAddLaborLineItem() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ jobId, item }: { jobId: bigint; item: LaborLineItem }) => {
      if (!actor) throw new Error('Actor not available');
      return actor.addLaborLineItem(jobId, item);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job', variables.jobId.toString()] });
    },
  });
}

export function useRemoveLaborLineItem() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ jobId, index }: { jobId: bigint; index: bigint }) => {
      if (!actor) throw new Error('Actor not available');
      return actor.removeLaborLineItem(jobId, index);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job', variables.jobId.toString()] });
    },
  });
}

// ── Job Photos ────────────────────────────────────────────────────────────────

export function useAddJobPhoto() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ jobId, photo }: { jobId: bigint; photo: any }) => {
      if (!actor) throw new Error('Actor not available');
      return actor.addJobPhoto(jobId, photo);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job', variables.jobId.toString()] });
    },
  });
}

export function useRemoveJobPhoto() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ jobId, photoIndex }: { jobId: bigint; photoIndex: bigint }) => {
      if (!actor) throw new Error('Actor not available');
      return actor.removeJobPhoto(jobId, photoIndex);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job', variables.jobId.toString()] });
    },
  });
}

// ── Labor Rates ───────────────────────────────────────────────────────────────

export function useListLaborRates() {
  const { actor, isFetching } = useActor();
  return useQuery<LaborRate[]>({
    queryKey: ['laborRates'],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listLaborRates();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useCreateLaborRate() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (laborRate: LaborRate) => {
      if (!actor) throw new Error('Actor not available');
      return actor.createLaborRate(laborRate);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['laborRates'] });
    },
  });
}

export function useUpdateLaborRate() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (laborRate: LaborRate) => {
      if (!actor) throw new Error('Actor not available');
      return actor.updateLaborRate(laborRate);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['laborRates'] });
    },
  });
}

export function useDeleteLaborRate() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (laborRateId: bigint) => {
      if (!actor) throw new Error('Actor not available');
      return actor.deleteLaborRate(laborRateId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['laborRates'] });
    },
  });
}

// ── Parts / Inventory ─────────────────────────────────────────────────────────

export function useListParts() {
  const { actor, isFetching } = useActor();
  return useQuery<Part[]>({
    queryKey: ['parts'],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listParts();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useCreatePart() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (part: Part) => {
      if (!actor) throw new Error('Actor not available');
      return actor.createPart(part);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts'] });
    },
  });
}

export function useUpdatePart() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (part: Part) => {
      if (!actor) throw new Error('Actor not available');
      return actor.updatePart(part);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts'] });
    },
  });
}

export function useDeletePart() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (partId: bigint) => {
      if (!actor) throw new Error('Actor not available');
      return actor.deletePart(partId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts'] });
    },
  });
}

export function useUsePartOnJob() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ partId, jobId, quantityUsed }: { partId: bigint; jobId: bigint; quantityUsed: bigint }) => {
      if (!actor) throw new Error('Actor not available');
      return actor.usePartOnJob(partId, jobId, quantityUsed);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

// ── User Profile ──────────────────────────────────────────────────────────────

export function useGetCallerUserProfile() {
  const { actor, isFetching: actorFetching } = useActor();
  const { identity } = useInternetIdentity();
  const query = useQuery<UserProfile | null>({
    queryKey: ['currentUserProfile'],
    queryFn: async () => {
      if (!actor) throw new Error('Actor not available');
      return actor.getCallerUserProfile();
    },
    enabled: !!actor && !actorFetching && !!identity,
    retry: false,
  });
  return {
    ...query,
    isLoading: actorFetching || query.isLoading,
    isFetched: !!actor && query.isFetched,
  };
}

export function useSaveCallerUserProfile() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (profile: UserProfile) => {
      if (!actor) throw new Error('Actor not available');
      return actor.saveCallerUserProfile(profile);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] });
    },
  });
}

// ── Signature ─────────────────────────────────────────────────────────────────

export function useGetUserSignature() {
  const { actor, isFetching } = useActor();
  const { identity } = useInternetIdentity();
  return useQuery<Uint8Array | null>({
    queryKey: ['userSignature'],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getUserSignature();
    },
    enabled: !!actor && !isFetching && !!identity,
  });
}

export function useStoreUserSignature() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (sig: Uint8Array) => {
      if (!actor) throw new Error('Actor not available');
      return actor.storeUserSignature(sig);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userSignature'] });
    },
  });
}

// ── Stripe ────────────────────────────────────────────────────────────────────

export type CheckoutSession = {
  id: string;
  url: string;
};

export function useIsStripeConfigured() {
  const { actor, isFetching } = useActor();
  return useQuery<boolean>({
    queryKey: ['stripeConfigured'],
    queryFn: async () => {
      if (!actor) return false;
      return actor.isStripeConfigured();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useSetStripeConfiguration() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (config: StripeConfiguration) => {
      if (!actor) throw new Error('Actor not available');
      return actor.setStripeConfiguration(config);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stripeConfigured'] });
    },
  });
}

export function useCreateCheckoutSession() {
  const { actor } = useActor();
  return useMutation({
    mutationFn: async (items: ShoppingItem[]): Promise<CheckoutSession> => {
      if (!actor) throw new Error('Actor not available');
      const baseUrl = `${window.location.protocol}//${window.location.host}`;
      const successUrl = `${baseUrl}/payment-success`;
      const cancelUrl = `${baseUrl}/payment-failure`;
      const result = await actor.createCheckoutSession(items, successUrl, cancelUrl);
      const session = JSON.parse(result) as CheckoutSession;
      if (!session?.url) {
        throw new Error('Stripe session missing url');
      }
      return session;
    },
  });
}

// ── Role / Admin ──────────────────────────────────────────────────────────────

export function useGetCallerUserRole() {
  const { actor, isFetching } = useActor();
  const { identity } = useInternetIdentity();
  return useQuery({
    queryKey: ['callerUserRole'],
    queryFn: async () => {
      if (!actor) throw new Error('Actor not available');
      return actor.getCallerUserRole();
    },
    enabled: !!actor && !isFetching && !!identity,
    retry: false,
  });
}

export function useIsCallerAdmin() {
  const { actor, isFetching } = useActor();
  const { identity } = useInternetIdentity();
  return useQuery<boolean>({
    queryKey: ['isCallerAdmin'],
    queryFn: async () => {
      if (!actor) return false;
      return actor.isCallerAdmin();
    },
    enabled: !!actor && !isFetching && !!identity,
  });
}

export function useAssignUserRole() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ user, role }: { user: any; role: any }) => {
      if (!actor) throw new Error('Actor not available');
      return actor.assignCallerUserRole(user, role);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['callerUserRole'] });
      queryClient.invalidateQueries({ queryKey: ['isCallerAdmin'] });
    },
  });
}
