import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface Job {
    id: bigint;
    status: Variant_open_complete_inProgress;
    clientId: bigint;
    waiverType?: Variant_general_preexisting_potential;
    date: Time;
    tech: Principal;
    estimate?: {
        sigData: Uint8Array;
        sigTime: Time;
        amount: bigint;
    };
    notes: string;
    stripePaymentId?: string;
    maintenancePackage?: string;
    photos: Array<Uint8Array>;
}
export type Time = bigint;
export interface Client {
    id: bigint;
    googleReviewUrl?: string;
    name: string;
    email?: string;
    address: string;
    notes: string;
    phone: string;
}
export interface UserProfile {
    name: string;
}
export interface LaborRate {
    id: bigint;
    name: string;
    amount: bigint;
    rateType: Variant_flat_hourly;
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export enum Variant_flat_hourly {
    flat = "flat",
    hourly = "hourly"
}
export enum Variant_general_preexisting_potential {
    general = "general",
    preexisting = "preexisting",
    potential = "potential"
}
export enum Variant_open_complete_inProgress {
    open = "open",
    complete = "complete",
    inProgress = "inProgress"
}
export interface backendInterface {
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    createClient(client: Client): Promise<bigint>;
    createJob(job: Job): Promise<bigint>;
    createLaborRate(laborRate: LaborRate): Promise<bigint>;
    deleteClient(clientId: bigint): Promise<void>;
    deleteJob(jobId: bigint): Promise<void>;
    deleteLaborRate(laborRateId: bigint): Promise<void>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getClient(_clientId: bigint): Promise<Client>;
    getJob(_jobId: bigint): Promise<Job>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    isCallerAdmin(): Promise<boolean>;
    listClients(): Promise<Array<Client>>;
    listJobs(): Promise<Array<Job>>;
    listLaborRates(): Promise<Array<LaborRate>>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    updateClient(client: Client): Promise<void>;
    updateJob(job: Job): Promise<void>;
    updateJobStatus(jobId: bigint, newStatus: Variant_open_complete_inProgress): Promise<void>;
    updateLaborRate(laborRate: LaborRate): Promise<void>;
}
