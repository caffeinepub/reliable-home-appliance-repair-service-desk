import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';
import { useInternetIdentity } from './useInternetIdentity';
import type { Client, Job, UserProfile, UserRole, LaborRate } from '../backend';
import { Variant_open_complete_inProgress } from '../backend';
import type { Principal } from '@icp-sdk/core/principal';

// ─── User Profile ────────────────────────────────────────────────────────────

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

// ─── Roles ───────────────────────────────────────────────────────────────────

export function useGetCallerUserRole() {
  const { actor, isFetching: actorFetching } = useActor();
  const { identity } = useInternetIdentity();

  return useQuery<UserRole>({
    queryKey: ['callerUserRole'],
    queryFn: async () => {
      if (!actor) throw new Error('Actor not available');
      return actor.getCallerUserRole();
    },
    enabled: !!actor && !actorFetching && !!identity,
    retry: false,
  });
}

export function useIsCallerAdmin() {
  const { actor, isFetching: actorFetching } = useActor();
  const { identity } = useInternetIdentity();

  return useQuery<boolean>({
    queryKey: ['isCallerAdmin'],
    queryFn: async () => {
      if (!actor) throw new Error('Actor not available');
      return actor.isCallerAdmin();
    },
    enabled: !!actor && !actorFetching && !!identity,
    retry: false,
  });
}

export function useAssignUserRole() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ user, role }: { user: Principal; role: UserRole }) => {
      if (!actor) throw new Error('Actor not available');
      return actor.assignCallerUserRole(user, role);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['callerUserRole'] });
      queryClient.invalidateQueries({ queryKey: ['isCallerAdmin'] });
    },
  });
}

// ─── Clients ─────────────────────────────────────────────────────────────────

export function useListClients() {
  const { actor, isFetching: actorFetching } = useActor();
  const { identity } = useInternetIdentity();

  return useQuery<Client[]>({
    queryKey: ['clients'],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listClients();
    },
    enabled: !!actor && !actorFetching && !!identity,
  });
}

export function useGetClient(clientId: bigint | null) {
  const { actor, isFetching: actorFetching } = useActor();
  const { identity } = useInternetIdentity();

  return useQuery<Client>({
    queryKey: ['client', clientId?.toString()],
    queryFn: async () => {
      if (!actor || clientId === null) throw new Error('Not available');
      return actor.getClient(clientId);
    },
    enabled: !!actor && !actorFetching && !!identity && clientId !== null,
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

// ─── Jobs ─────────────────────────────────────────────────────────────────────

export function useListJobs() {
  const { actor, isFetching: actorFetching } = useActor();
  const { identity } = useInternetIdentity();

  return useQuery<Job[]>({
    queryKey: ['jobs'],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listJobs();
    },
    enabled: !!actor && !actorFetching && !!identity,
  });
}

export function useGetJob(jobId: bigint | null) {
  const { actor, isFetching: actorFetching } = useActor();
  const { identity } = useInternetIdentity();

  return useQuery<Job>({
    queryKey: ['job', jobId?.toString()],
    queryFn: async () => {
      if (!actor || jobId === null) throw new Error('Not available');
      return actor.getJob(jobId);
    },
    enabled: !!actor && !actorFetching && !!identity && jobId !== null,
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
    mutationFn: async ({ jobId, newStatus }: { jobId: bigint; newStatus: Variant_open_complete_inProgress }) => {
      if (!actor) throw new Error('Actor not available');
      return actor.updateJobStatus(jobId, newStatus);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job', variables.jobId.toString()] });
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

// ─── Labor Rates ─────────────────────────────────────────────────────────────

export function useListLaborRates() {
  const { actor, isFetching: actorFetching } = useActor();
  const { identity } = useInternetIdentity();

  return useQuery<LaborRate[]>({
    queryKey: ['laborRates'],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listLaborRates();
    },
    enabled: !!actor && !actorFetching && !!identity,
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
