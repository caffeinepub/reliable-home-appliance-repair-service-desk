import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';
import { useInternetIdentity } from './useInternetIdentity';
import type { Client, Job, Part, LaborRate, LaborLineItem, Estimate, DamageWaiver, UserProfile, StripeConfiguration } from '@/backend';
import { JobStatus } from '@/backend';
import { Principal } from '@dfinity/principal';

const OWNER_PRINCIPAL = 'q5rzs-s67ph-qtb5w-e66j5-2iqax-vlwa5-5pqxy-yosti-xhcis-ocfw6-yqe';

// ─── Auth / Profile ───────────────────────────────────────────────────────────

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

export function useIsOwner() {
  const { identity } = useInternetIdentity();
  return identity?.getPrincipal().toString() === OWNER_PRINCIPAL;
}

// ─── Clients ─────────────────────────────────────────────────────────────────

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

export function useGetClient(clientId: number | null) {
  const { actor, isFetching } = useActor();
  return useQuery<Client>({
    queryKey: ['client', clientId],
    queryFn: async () => {
      if (!actor || clientId === null) throw new Error('Actor not available');
      return actor.getClient(BigInt(clientId));
    },
    enabled: !!actor && !isFetching && clientId !== null,
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
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

// ─── Jobs ─────────────────────────────────────────────────────────────────────

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

export function useGetJob(jobId: number | null) {
  const { actor, isFetching } = useActor();
  return useQuery<Job>({
    queryKey: ['job', jobId],
    queryFn: async () => {
      if (!actor || jobId === null) throw new Error('Actor not available');
      return actor.getJob(BigInt(jobId));
    },
    enabled: !!actor && !isFetching && jobId !== null,
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job'] });
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

export function useUpdateJobStatus() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ jobId, status }: { jobId: number; status: JobStatus }) => {
      if (!actor) throw new Error('Actor not available');
      return actor.updateJobStatus(BigInt(jobId), status);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job'] });
    },
  });
}

export function useUpdateJobPayment() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ jobId, paymentIntentId }: { jobId: number; paymentIntentId: string }) => {
      if (!actor) throw new Error('Actor not available');
      return actor.updateJobPayment(BigInt(jobId), paymentIntentId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job'] });
    },
  });
}

export function useUpdateJobSchedule() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      jobId,
      scheduledStart,
      scheduledEnd,
    }: {
      jobId: number;
      scheduledStart: bigint | null;
      scheduledEnd: bigint | null;
    }) => {
      if (!actor) throw new Error('Actor not available');
      return actor.updateJobSchedule(BigInt(jobId), scheduledStart, scheduledEnd);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job'] });
    },
  });
}

export function useUpdateEstimate() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ jobId, estimate }: { jobId: number; estimate: Estimate }) => {
      if (!actor) throw new Error('Actor not available');
      return actor.updateEstimate(BigInt(jobId), estimate);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['job', variables.jobId] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

export function useAddJobPhoto() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ jobId, photo }: { jobId: bigint; photo: import('@/backend').ExternalBlob }) => {
      if (!actor) throw new Error('Actor not available');
      return actor.addJobPhoto(jobId, photo);
    },
    onSuccess: () => {
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
      return actor.removeJobPhoto(jobId, photoIndex);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

export function useAddLaborLineItem() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ jobId, item }: { jobId: bigint; item: LaborLineItem }) => {
      if (!actor) throw new Error('Actor not available');
      return actor.addLaborLineItem(jobId, item);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

// ─── Damage Waiver ────────────────────────────────────────────────────────────

export function useGetDamageWaiver(jobId: number | null) {
  const { actor, isFetching } = useActor();
  return useQuery<DamageWaiver | null>({
    queryKey: ['damageWaiver', jobId],
    queryFn: async () => {
      if (!actor || jobId === null) return null;
      return actor.getDamageWaiver(BigInt(jobId));
    },
    enabled: !!actor && !isFetching && jobId !== null,
  });
}

export function useUpdateDamageWaiver() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ jobId, waiver }: { jobId: number; waiver: DamageWaiver }) => {
      if (!actor) throw new Error('Actor not available');
      return actor.updateDamageWaiver(BigInt(jobId), waiver);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['damageWaiver', variables.jobId] });
      queryClient.invalidateQueries({ queryKey: ['job', variables.jobId] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

// ─── Parts ────────────────────────────────────────────────────────────────────

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

export function useGetTotalPartCostByJob(jobId: bigint | null) {
  const { actor, isFetching } = useActor();
  return useQuery<bigint>({
    queryKey: ['partCost', jobId?.toString()],
    queryFn: async () => {
      if (!actor || jobId === null) return BigInt(0);
      return actor.getTotalPartCostByJob(jobId);
    },
    enabled: !!actor && !isFetching && jobId !== null,
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
    mutationFn: async ({
      partId,
      jobId,
      quantityUsed,
    }: {
      partId: bigint;
      jobId: bigint;
      quantityUsed: bigint;
    }) => {
      if (!actor) throw new Error('Actor not available');
      return actor.usePartOnJob(partId, jobId, quantityUsed);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts'] });
    },
  });
}

// ─── Labor Rates ──────────────────────────────────────────────────────────────

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

// ─── Signatures ───────────────────────────────────────────────────────────────

export function useGetUserSignature() {
  const { actor, isFetching } = useActor();
  return useQuery<Uint8Array | null>({
    queryKey: ['userSignature'],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getUserSignature();
    },
    enabled: !!actor && !isFetching,
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

// ─── Stripe ───────────────────────────────────────────────────────────────────

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

export function useCreatePaymentIntent() {
  const { actor } = useActor();
  return useMutation({
    mutationFn: async ({ jobId, amountInCents }: { jobId: bigint; amountInCents: bigint }) => {
      if (!actor) throw new Error('Actor not available');
      const result = await actor.createPaymentIntent(jobId, amountInCents);
      try {
        const parsed = JSON.parse(result);
        return {
          id: parsed.id as string,
          client_secret: parsed.client_secret as string,
          raw: result,
        };
      } catch {
        return { id: '', client_secret: '', raw: result };
      }
    },
  });
}

// ─── Authorization / User Management ─────────────────────────────────────────

export function useAssignUserRole() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ user, role }: { user: Principal; role: 'admin' | 'user' | 'guest' }) => {
      if (!actor) throw new Error('Actor not available');
      const roleVariant = role === 'admin' ? { admin: null } : role === 'user' ? { user: null } : { guest: null };
      return actor.assignCallerUserRole(user, roleVariant as never);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}
