import type { Principal } from "@dfinity/principal";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type Client,
  type DamageWaiver,
  type Estimate,
  ExternalBlob,
  type Job,
  type JobStatus,
  type LaborLineItem,
  type LaborRate,
  type Part,
  type UserProfile,
  type UserRole,
} from "../backend";
import { useActor } from "./useActor";
import { useInternetIdentity } from "./useInternetIdentity";

// ─── Clients ────────────────────────────────────────────────────────────────

export function useListClients() {
  const { actor, isFetching } = useActor();
  return useQuery<Client[]>({
    queryKey: ["clients"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listClients();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetClient(clientId: bigint | null) {
  const { actor, isFetching } = useActor();
  return useQuery<Client | null>({
    queryKey: ["client", clientId?.toString()],
    queryFn: async () => {
      if (!actor || clientId === null) return null;
      return actor.getClient(clientId);
    },
    enabled: !!actor && !isFetching && clientId !== null,
  });
}

export function useCreateClient() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (client: Client) => {
      if (!actor) throw new Error("Actor not available");
      return actor.createClient(client);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });
}

export function useUpdateClient() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (client: Client) => {
      if (!actor) throw new Error("Actor not available");
      return actor.updateClient(client);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({
        queryKey: ["client", variables.id.toString()],
      });
    },
  });
}

export function useDeleteClient() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (clientId: bigint) => {
      if (!actor) throw new Error("Actor not available");
      return actor.deleteClient(clientId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });
}

// ─── Jobs ────────────────────────────────────────────────────────────────────

export function useListJobs() {
  const { actor, isFetching } = useActor();
  return useQuery<Job[]>({
    queryKey: ["jobs"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listJobs();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetJob(jobId: bigint | null) {
  const { actor, isFetching } = useActor();
  return useQuery<Job | null>({
    queryKey: ["job", jobId?.toString()],
    queryFn: async () => {
      if (!actor || jobId === null) return null;
      return actor.getJob(jobId);
    },
    enabled: !!actor && !isFetching && jobId !== null,
  });
}

export function useCreateJob() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (job: Job) => {
      if (!actor) throw new Error("Actor not available");
      return actor.createJob(job);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}

export function useUpdateJob() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (job: Job) => {
      if (!actor) throw new Error("Actor not available");
      return actor.updateJob(job);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({
        queryKey: ["job", variables.id.toString()],
      });
    },
  });
}

export function useDeleteJob() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: bigint) => {
      if (!actor) throw new Error("Actor not available");
      return actor.deleteJob(jobId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}

export function useUpdateJobStatus() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      jobId,
      status,
    }: { jobId: bigint; status: JobStatus }) => {
      if (!actor) throw new Error("Actor not available");
      return actor.updateJobStatus(jobId, status);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}

// ─── Job Photos (Blob Storage) ───────────────────────────────────────────────

export function useAddJobPhoto() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      jobId,
      file,
      onProgress,
    }: {
      jobId: bigint;
      file: File;
      onProgress?: (pct: number) => void;
    }) => {
      if (!actor) throw new Error("Actor not available");
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let blob = ExternalBlob.fromBytes(bytes);
      if (onProgress) {
        blob = blob.withUploadProgress(onProgress);
      }
      return actor.addJobPhoto(jobId, blob);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["job", variables.jobId.toString()],
      });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}

export function useRemoveJobPhoto() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      jobId,
      photoIndex,
    }: { jobId: bigint; photoIndex: bigint }) => {
      if (!actor) throw new Error("Actor not available");
      return actor.removeJobPhoto(jobId, photoIndex);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["job", variables.jobId.toString()],
      });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}

// ─── Estimate ────────────────────────────────────────────────────────────────

export function useUpdateEstimate() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      jobId,
      estimate,
    }: { jobId: bigint; estimate: Estimate }) => {
      if (!actor) throw new Error("Actor not available");
      return actor.updateEstimate(jobId, estimate);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["job", variables.jobId.toString()],
      });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}

// ─── Labor Line Items ────────────────────────────────────────────────────────

export function useAddLaborLineItem() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      jobId,
      item,
    }: { jobId: bigint; item: LaborLineItem }) => {
      if (!actor) throw new Error("Actor not available");
      return actor.addLaborLineItem(jobId, item);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["job", variables.jobId.toString()],
      });
    },
  });
}

export function useRemoveLaborLineItem() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ jobId, index }: { jobId: bigint; index: bigint }) => {
      if (!actor) throw new Error("Actor not available");
      return actor.removeLaborLineItem(jobId, index);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["job", variables.jobId.toString()],
      });
    },
  });
}

// ─── Job Part Line Items ─────────────────────────────────────────────────────

export interface JobPartLineItem {
  id: bigint;
  partId: [] | [bigint];
  partNumber: string;
  name: string;
  description: string;
  quantity: bigint;
  unitPrice: bigint;
}

export function useAddJobPartLineItem() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      jobId,
      item,
    }: { jobId: bigint; item: JobPartLineItem }) => {
      if (!actor) throw new Error("Actor not available");
      return actor.addJobPartLineItem(jobId, item);
    },
    onSuccess: (
      _data: unknown,
      variables: { jobId: bigint; item: JobPartLineItem },
    ) => {
      queryClient.invalidateQueries({
        queryKey: ["job", variables.jobId.toString()],
      });
      queryClient.invalidateQueries({
        queryKey: ["jobPartLineItems", variables.jobId.toString()],
      });
    },
  });
}

export function useRemoveJobPartLineItem() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ jobId, index }: { jobId: bigint; index: bigint }) => {
      if (!actor) throw new Error("Actor not available");
      return actor.removeJobPartLineItem(jobId, index);
    },
    onSuccess: (
      _data: unknown,
      variables: { jobId: bigint; index: bigint },
    ) => {
      queryClient.invalidateQueries({
        queryKey: ["job", variables.jobId.toString()],
      });
      queryClient.invalidateQueries({
        queryKey: ["jobPartLineItems", variables.jobId.toString()],
      });
    },
  });
}

export function useGetJobPartLineItems(jobId: bigint | null) {
  const { actor, isFetching } = useActor();
  return useQuery<JobPartLineItem[]>({
    queryKey: ["jobPartLineItems", jobId?.toString()],
    queryFn: async () => {
      if (!actor || jobId === null) return [];
      return actor.getJobPartLineItems(jobId);
    },
    enabled: !!actor && !isFetching && jobId !== null,
  });
}

// ─── Parts / Inventory ───────────────────────────────────────────────────────

export function useListParts() {
  const { actor, isFetching } = useActor();
  return useQuery<Part[]>({
    queryKey: ["parts"],
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
    queryKey: ["partCost", jobId?.toString()],
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
      if (!actor) throw new Error("Actor not available");
      return actor.createPart(part);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parts"] });
    },
  });
}

export function useUpdatePart() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (part: Part) => {
      if (!actor) throw new Error("Actor not available");
      return actor.updatePart(part);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parts"] });
    },
  });
}

export function useDeletePart() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (partId: bigint) => {
      if (!actor) throw new Error("Actor not available");
      return actor.deletePart(partId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parts"] });
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
      if (!actor) throw new Error("Actor not available");
      // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook
      return actor.usePartOnJob(partId, jobId, quantityUsed);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parts"] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}

// ─── Invoices ─────────────────────────────────────────────────────────────────

export interface AppInvoice {
  id: bigint;
  jobId: bigint;
  invoiceNumber: bigint;
  issuedAt: bigint;
  notes: string;
  isPaid: boolean;
}

export function useListInvoices() {
  const { actor, isFetching } = useActor();
  return useQuery<AppInvoice[]>({
    queryKey: ["invoices"],
    queryFn: async () => {
      if (!actor) return [];
      try {
        return await actor.listInvoices();
      } catch {
        return [];
      }
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetInvoice(id: bigint | null) {
  const { actor, isFetching } = useActor();
  return useQuery<AppInvoice | null>({
    queryKey: ["invoice", id?.toString()],
    queryFn: async () => {
      if (!actor || id === null) return null;
      try {
        return await actor.getInvoice(id);
      } catch {
        return null;
      }
    },
    enabled: !!actor && !isFetching && id !== null,
  });
}

export function useCreateInvoice() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (invoice: AppInvoice) => {
      if (!actor) throw new Error("Actor not available");
      return actor.createInvoice(invoice);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}

export function useUpdateInvoice() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (invoice: AppInvoice) => {
      if (!actor) throw new Error("Actor not available");
      return actor.updateInvoice(invoice);
    },
    onSuccess: (_data: unknown, variables: AppInvoice) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({
        queryKey: ["invoice", variables.id.toString()],
      });
    },
  });
}

export function useDeleteInvoice() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (invoiceId: bigint) => {
      if (!actor) throw new Error("Actor not available");
      return actor.deleteInvoice(invoiceId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}

// ─── Labor Rates ─────────────────────────────────────────────────────────────

export function useListLaborRates() {
  const { actor, isFetching } = useActor();
  return useQuery<LaborRate[]>({
    queryKey: ["laborRates"],
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
    mutationFn: async (rate: LaborRate) => {
      if (!actor) throw new Error("Actor not available");
      return actor.createLaborRate(rate);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["laborRates"] });
    },
  });
}

export function useUpdateLaborRate() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (rate: LaborRate) => {
      if (!actor) throw new Error("Actor not available");
      return actor.updateLaborRate(rate);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["laborRates"] });
    },
  });
}

export function useDeleteLaborRate() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (rateId: bigint) => {
      if (!actor) throw new Error("Actor not available");
      return actor.deleteLaborRate(rateId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["laborRates"] });
    },
  });
}

// ─── User Profile ─────────────────────────────────────────────────────────────

export function useGetCallerUserProfile() {
  const { actor, isFetching: actorFetching } = useActor();
  const query = useQuery<UserProfile | null>({
    queryKey: ["currentUserProfile"],
    queryFn: async () => {
      if (!actor) return null; // don't throw — treat as no profile yet
      try {
        return await actor.getCallerUserProfile();
      } catch {
        return null; // treat any auth/canister error as "no profile yet"
      }
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
      if (!actor) throw new Error("Actor not available");
      return actor.saveCallerUserProfile(profile);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currentUserProfile"] });
    },
  });
}

// ─── Signature ───────────────────────────────────────────────────────────────

export function useGetUserSignature() {
  const { actor, isFetching } = useActor();
  return useQuery<Uint8Array | null>({
    queryKey: ["userSignature"],
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
      if (!actor) throw new Error("Actor not available");
      return actor.storeUserSignature(sig);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userSignature"] });
    },
  });
}

// ─── Damage Waiver ───────────────────────────────────────────────────────────

export function useGetDamageWaiver(jobId: bigint | null) {
  const { actor, isFetching } = useActor();
  return useQuery<DamageWaiver | null>({
    queryKey: ["damageWaiver", jobId?.toString()],
    queryFn: async () => {
      if (!actor || jobId === null) return null;
      return actor.getDamageWaiver(jobId);
    },
    enabled: !!actor && !isFetching && jobId !== null,
  });
}

export function useUpdateDamageWaiver() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      jobId,
      waiver,
    }: { jobId: bigint; waiver: DamageWaiver }) => {
      if (!actor) throw new Error("Actor not available");
      return actor.updateDamageWaiver(jobId, waiver);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["damageWaiver", variables.jobId.toString()],
      });
      queryClient.invalidateQueries({
        queryKey: ["job", variables.jobId.toString()],
      });
    },
  });
}

// ─── Job Schedule ─────────────────────────────────────────────────────────────

export function useUpdateJobSchedule() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      jobId,
      scheduledStart,
      scheduledEnd,
    }: {
      jobId: bigint;
      scheduledStart: bigint | null;
      scheduledEnd: bigint | null;
    }) => {
      if (!actor) throw new Error("Actor not available");
      return actor.updateJobSchedule(jobId, scheduledStart, scheduledEnd);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}

// ─── Roles ───────────────────────────────────────────────────────────────────

export function useGetCallerUserRole() {
  const { actor, isFetching } = useActor();
  return useQuery<string>({
    queryKey: ["callerUserRole"],
    queryFn: async () => {
      if (!actor) return "guest";
      return actor.getCallerUserRole();
    },
    enabled: !!actor && !isFetching,
  });
}

const OWNER_PRINCIPAL =
  "asn62-s2yb6-ezdxu-wy6eu-ml2sx-yaqyb-tvmkf-bgefi-2iqtw-a7b53-yqe";

export function useIsOwner() {
  const { actor, isFetching } = useActor();
  const { identity } = useInternetIdentity();
  const principalStr = identity?.getPrincipal().toString() ?? "anonymous";
  return useQuery<boolean>({
    queryKey: ["isOwner", principalStr],
    queryFn: async () => {
      if (principalStr === OWNER_PRINCIPAL) return true;
      if (!actor) return false;
      return actor.isCallerAdmin();
    },
    enabled: !!actor && !isFetching,
    staleTime: 0,
    refetchOnMount: true,
  });
}

export function useAssignCallerUserRole() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ user, role }: { user: Principal; role: UserRole }) => {
      if (!actor) throw new Error("Actor not available");
      return actor.assignCallerUserRole(user, role);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["callerUserRole"] });
    },
  });
}

// Alias used by SettingsPage
export const useAssignUserRole = useAssignCallerUserRole;

// ─── Stripe ───────────────────────────────────────────────────────────────────

export function useIsStripeConfigured() {
  const { actor, isFetching } = useActor();
  return useQuery<boolean>({
    queryKey: ["stripeConfigured"],
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
    mutationFn: async (config: {
      secretKey: string;
      allowedCountries: string[];
    }) => {
      if (!actor) throw new Error("Actor not available");
      return actor.setStripeConfiguration(config);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stripeConfigured"] });
    },
  });
}

export function useForceGrantAdminByToken() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (token: string) => {
      if (!actor) throw new Error("Actor not available");
      return actor.forceGrantAdminByToken(token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["isOwner"] });
    },
  });
}

export function useCreateCheckoutSession() {
  const { actor } = useActor();
  return useMutation({
    mutationFn: async ({
      items,
      successUrl,
      cancelUrl,
    }: {
      items: Array<{
        productName: string;
        currency: string;
        quantity: bigint;
        priceInCents: bigint;
        productDescription: string;
      }>;
      successUrl: string;
      cancelUrl: string;
    }) => {
      if (!actor) throw new Error("Actor not available");
      return actor.createCheckoutSession(items, successUrl, cancelUrl);
    },
  });
}
