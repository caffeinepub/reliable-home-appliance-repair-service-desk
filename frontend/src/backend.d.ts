import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export class ExternalBlob {
    getBytes(): Promise<Uint8Array<ArrayBuffer>>;
    getDirectURL(): string;
    static fromURL(url: string): ExternalBlob;
    static fromBytes(blob: Uint8Array<ArrayBuffer>): ExternalBlob;
    withUploadProgress(onProgress: (percentage: number) => void): ExternalBlob;
}
export interface Part {
    id: bigint;
    partNumber: string;
    name: string;
    jobId?: bigint;
    description: string;
    quantityOnHand: bigint;
    unitCost: bigint;
}
export type Time = bigint;
export interface LaborLineItem {
    hours?: number;
    laborRateId: bigint;
    description: string;
    amount: bigint;
    rateType: RateType;
}
export interface LaborRate {
    id: bigint;
    name: string;
    amount: bigint;
    rateType: RateType;
}
export interface Job {
    id: bigint;
    status: JobStatus;
    clientId: bigint;
    waiverType?: WaiverType;
    date: Time;
    tech: Principal;
    estimate?: Estimate;
    notes: string;
    stripePaymentId?: string;
    maintenancePackage?: string;
    laborLineItems: Array<LaborLineItem>;
    photos: Array<ExternalBlob>;
}
export interface Estimate {
    sigData: Uint8Array;
    sigTime: Time;
    amount: bigint;
}
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
export enum JobStatus {
    open = "open",
    complete = "complete",
    inProgress = "inProgress"
}
export enum RateType {
    flat = "flat",
    hourly = "hourly"
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export enum WaiverType {
    general = "general",
    preexisting = "preexisting",
    potential = "potential"
}
export interface backendInterface {
    addJobPhoto(jobId: bigint, photo: ExternalBlob): Promise<void>;
    addLaborLineItem(jobId: bigint, laborLineItem: LaborLineItem): Promise<void>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    createClient(client: Client): Promise<bigint>;
    createJob(job: Job): Promise<bigint>;
    createLaborRate(laborRate: LaborRate): Promise<bigint>;
    createPart(part: Part): Promise<bigint>;
    deleteClient(clientId: bigint): Promise<void>;
    deleteJob(jobId: bigint): Promise<void>;
    deleteLaborRate(laborRateId: bigint): Promise<void>;
    deletePart(partId: bigint): Promise<void>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getClient(_clientId: bigint): Promise<Client>;
    getJob(_jobId: bigint): Promise<Job>;
    getPart(partId: bigint): Promise<Part>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    getUserSignature(): Promise<Uint8Array | null>;
    isCallerAdmin(): Promise<boolean>;
    listClients(): Promise<Array<Client>>;
    listJobs(): Promise<Array<Job>>;
    listLaborRates(): Promise<Array<LaborRate>>;
    listParts(): Promise<Array<Part>>;
    removeJobPhoto(jobId: bigint, photoIndex: bigint): Promise<void>;
    removeLaborLineItem(jobId: bigint, index: bigint): Promise<void>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    storeUserSignature(sig: Uint8Array): Promise<void>;
    updateClient(client: Client): Promise<void>;
    updateJob(job: Job): Promise<void>;
    updateJobStatus(jobId: bigint, newStatus: JobStatus): Promise<void>;
    updateLaborRate(laborRate: LaborRate): Promise<void>;
    updatePart(part: Part): Promise<void>;
    usePartOnJob(partId: bigint, jobId: bigint, quantityUsed: bigint): Promise<void>;
}
