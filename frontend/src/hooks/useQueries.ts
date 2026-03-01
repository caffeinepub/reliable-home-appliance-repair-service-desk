import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';
import { useInternetIdentity } from './useInternetIdentity';
import type { Client, Job, Part, LaborRate, LaborLineItem, JobStatus, UserProfile, Estimate } from '../backend';
import { ExternalBlob } from '../backend';

// !! DO NOT CHANGE THIS PRINCIPAL !!
// This is the owner principal for the app. It must never be changed.
const OWNER_PRINCIPAL = 'q5rzs-s67ph-qtb5w-e66j5-2iqax-vlwa5-5pqxy-yosti-xhcis-ocfw6-yqe';

export function useIsOwner() {
  const { identity } = useInternetIdentity();
  if (!identity) return false;
  return identity.getPrincipal().toString() === OWNER_PRINCIPAL;
}

// ─── User Profile ────────────────────────────────────────────────────────────

export function useGetCallerUserProfile() {
  const { actor, isFetching: actorFetching } = useActor();

  const query = useQuery<UserProfile | null>({
    queryKey: ['currentUserProfile'],
    queryFn: async () => {
      if (!actor) throw new Error('Actor not available');
      return actor.getCallerUserProfile();
    },
    enabled: !!actor && !actorFetching,
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
      await actor.saveCallerUserProfile(profile);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] });
    },
  });
}

// ─── Signature ───────────────────────────────────────────────────────────────

export function useGetUserSignature() {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<Uint8Array | null>({
    queryKey: ['userSignature'],
    queryFn: async () => {
      if (!actor) throw new Error('Actor not available');
      return actor.getUserSignature();
    },
    enabled: !!actor && !actorFetching,
  });
}

export function useStoreUserSignature() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sig: Uint8Array) => {
      if (!actor) throw new Error('Actor not available');
      await actor.storeUserSignature(sig);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userSignature'] });
    },
  });
}

// ─── Clients ─────────────────────────────────────────────────────────────────

export function useListClients() {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<Client[]>({
    queryKey: ['clients'],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listClients();
    },
    enabled: !!actor && !actorFetching,
  });
}

export function useGetClient(clientId: bigint | null) {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<Client | null>({
    queryKey: ['client', clientId?.toString()],
    queryFn: async () => {
      if (!actor || clientId === null) return null;
      return actor.getClient(clientId);
    },
    enabled: !!actor && !actorFetching && clientId !== null,
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
      await actor.updateClient(client);
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
      await actor.deleteClient(clientId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}

// ─── Jobs ─────────────────────────────────────────────────────────────────────

export function useListJobs() {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<Job[]>({
    queryKey: ['jobs'],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listJobs();
    },
    enabled: !!actor && !actorFetching,
  });
}

export function useGetJob(jobId: bigint | null) {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<Job | null>({
    queryKey: ['job', jobId?.toString()],
    queryFn: async () => {
      if (!actor || jobId === null) return null;
      return actor.getJob(jobId);
    },
    enabled: !!actor && !actorFetching && jobId !== null,
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
      await actor.updateJob(job);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job', variables.id.toString()] });
    },
  });
}

export function useDeleteJob() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (jobId: bigint) => {
      if (!actor) throw new Error('Actor not available');
      await actor.deleteJob(jobId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

export function useUpdateJobStatus() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ jobId, status }: { jobId: bigint; status: JobStatus }) => {
      if (!actor) throw new Error('Actor not available');
      await actor.updateJobStatus(jobId, status);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

export function useAddJobPhoto() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ jobId, photo }: { jobId: bigint; photo: ExternalBlob }) => {
      if (!actor) throw new Error('Actor not available');
      await actor.addJobPhoto(jobId, photo);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['job', variables.jobId.toString()] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

export function useRemoveJobPhoto() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ jobId, photoIndex }: { jobId: bigint; photoIndex: bigint }) => {
      if (!actor) throw new Error('Actor not available');
      await actor.removeJobPhoto(jobId, photoIndex);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['job', variables.jobId.toString()] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

export function useUpdateEstimate() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ jobId, estimate }: { jobId: bigint; estimate: Estimate }) => {
      if (!actor) throw new Error('Actor not available');
      await actor.updateEstimate(jobId, estimate);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['job', variables.jobId.toString()] });
    },
  });
}

export function useAddLaborLineItem() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ jobId, item }: { jobId: bigint; item: LaborLineItem }) => {
      if (!actor) throw new Error('Actor not available');
      await actor.addLaborLineItem(jobId, item);
    },
    onSuccess: (_data, variables) => {
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
      await actor.removeLaborLineItem(jobId, index);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['job', variables.jobId.toString()] });
    },
  });
}

// ─── Parts ────────────────────────────────────────────────────────────────────

export function useListParts() {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<Part[]>({
    queryKey: ['parts'],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listParts();
    },
    enabled: !!actor && !actorFetching,
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
      await actor.updatePart(part);
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
      await actor.deletePart(partId);
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
      await actor.usePartOnJob(partId, jobId, quantityUsed);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

// ─── Labor Rates ──────────────────────────────────────────────────────────────

export function useListLaborRates() {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<LaborRate[]>({
    queryKey: ['laborRates'],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listLaborRates();
    },
    enabled: !!actor && !actorFetching,
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
      await actor.updateLaborRate(laborRate);
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
      await actor.deleteLaborRate(laborRateId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['laborRates'] });
    },
  });
}

// ─── Stripe ───────────────────────────────────────────────────────────────────

export function useIsStripeConfigured() {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<boolean>({
    queryKey: ['stripeConfigured'],
    queryFn: async () => {
      if (!actor) return false;
      return actor.isStripeConfigured();
    },
    enabled: !!actor && !actorFetching,
  });
}

export function useSetStripeConfiguration() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (config: { secretKey: string; allowedCountries: string[] }) => {
      if (!actor) throw new Error('Actor not available');
      await actor.setStripeConfiguration(config);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stripeConfigured'] });
    },
  });
}

export function useCreateCheckoutSession() {
  const { actor } = useActor();

  return useMutation({
    mutationFn: async (items: Array<{ productName: string; currency: string; quantity: bigint; priceInCents: bigint; productDescription: string }>) => {
      if (!actor) throw new Error('Actor not available');
      const baseUrl = `${window.location.protocol}//${window.location.host}`;
      const successUrl = `${baseUrl}/payment-success`;
      const cancelUrl = `${baseUrl}/payment-failure`;
      const result = await actor.createCheckoutSession(items, successUrl, cancelUrl);
      const session = JSON.parse(result) as { id: string; url: string };
      if (!session?.url) throw new Error('Stripe session missing url');
      return session;
    },
  });
}
