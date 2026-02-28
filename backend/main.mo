import Map "mo:core/Map";
import List "mo:core/List";
import Nat "mo:core/Nat";
import Blob "mo:core/Blob";
import Time "mo:core/Time";
import Iter "mo:core/Iter";
import Runtime "mo:core/Runtime";
import Principal "mo:core/Principal";
import MixinAuthorization "authorization/MixinAuthorization";
import AccessControl "authorization/access-control";
import MixinStorage "blob-storage/Mixin";
import Storage "blob-storage/Storage";
import Migration "migration";

(with migration = Migration.run)
actor {
  include MixinStorage();

  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  let ownerPrincipal : Principal = Principal.fromText(
    "qo6l3-2omfi-cld33-ayy2m-apjgc-3encg-s6jub-j5dzz-npkyk-5wo3k-lae",
  );

  public type UserProfile = { name : Text };
  let userProfiles = Map.empty<Principal, UserProfile>();
  let userSignatures = Map.empty<Principal, Blob>();

  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can get profiles");
    };
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    userProfiles.add(caller, profile);
  };

  public type Client = {
    id : Nat;
    name : Text;
    phone : Text;
    address : Text;
    notes : Text;
    email : ?Text;
    googleReviewUrl : ?Text;
  };

  public type RateType = { #hourly; #flat };

  public type LaborRate = {
    id : Nat;
    name : Text;
    rateType : RateType;
    amount : Nat;
  };

  public type LaborLineItem = {
    laborRateId : Nat;
    rateType : RateType;
    hours : ?Float;
    amount : Nat;
    description : Text;
  };

  public type JobStatus = { #open; #inProgress; #complete };

  public type Estimate = {
    amount : Nat;
    sigData : Blob;
    sigTime : Time.Time;
  };

  public type WaiverType = {
    #preexisting;
    #potential;
    #general;
  };

  public type Job = {
    id : Nat;
    clientId : Nat;
    tech : Principal;
    date : Time.Time;
    status : JobStatus;
    notes : Text;
    photos : [Storage.ExternalBlob];
    estimate : ?Estimate;
    waiverType : ?WaiverType;
    maintenancePackage : ?Text;
    stripePaymentId : ?Text;
    laborLineItems : [LaborLineItem];
  };

  public type Part = {
    id : Nat;
    name : Text;
    partNumber : Text;
    description : Text;
    quantityOnHand : Nat;
    unitCost : Nat;
    jobId : ?Nat;
  };

  let clientStore = Map.empty<Nat, Client>();
  let jobStore = Map.empty<Nat, Job>();
  let partStore = Map.empty<Nat, Part>();
  let laborRatesStore = Map.empty<Nat, LaborRate>();

  func ensureAuthorizedOrOwner(caller : Principal) {
    if (caller == ownerPrincipal) {
      return;
    };
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only authorized users can perform this action");
    };
  };

  func ensureAuthorized(caller : Principal) {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only authorized users can perform this action");
    };
  };

  func ensureOwner(caller : Principal) {
    if (caller != ownerPrincipal) {
      Runtime.trap("Unauthorized: Only the owner can perform this action");
    };
  };

  // Client operations
  public shared ({ caller }) func createClient(client : Client) : async Nat {
    ensureAuthorized(caller);
    clientStore.add(client.id, client);
    client.id;
  };

  public query ({ caller }) func getClient(_clientId : Nat) : async Client {
    ensureAuthorized(caller);
    switch (clientStore.get(_clientId)) {
      case (null) { Runtime.trap("Client not found") };
      case (?client) { client };
    };
  };

  public query ({ caller }) func listClients() : async [Client] {
    ensureAuthorized(caller);
    clientStore.values().toArray();
  };

  public shared ({ caller }) func updateClient(client : Client) : async () {
    ensureAuthorized(caller);
    if (not clientStore.containsKey(client.id)) {
      Runtime.trap("Client not found");
    };
    clientStore.add(client.id, client);
  };

  public shared ({ caller }) func deleteClient(clientId : Nat) : async () {
    ensureAuthorized(caller);
    if (not clientStore.containsKey(clientId)) {
      Runtime.trap("Client not found");
    };
    clientStore.remove(clientId);
  };

  // Job operations
  public shared ({ caller }) func createJob(job : Job) : async Nat {
    ensureAuthorized(caller);
    jobStore.add(job.id, job);
    job.id;
  };

  public query ({ caller }) func getJob(_jobId : Nat) : async Job {
    ensureAuthorized(caller);
    switch (jobStore.get(_jobId)) {
      case (null) { Runtime.trap("Job not found") };
      case (?job) { job };
    };
  };

  public query ({ caller }) func listJobs() : async [Job] {
    ensureAuthorized(caller);
    jobStore.values().toArray();
  };

  public shared ({ caller }) func updateJob(job : Job) : async () {
    ensureAuthorized(caller);
    if (not jobStore.containsKey(job.id)) {
      Runtime.trap("Job not found");
    };
    jobStore.add(job.id, job);
  };

  public shared ({ caller }) func updateJobStatus(jobId : Nat, newStatus : JobStatus) : async () {
    ensureAuthorized(caller);
    switch (jobStore.get(jobId)) {
      case (null) { Runtime.trap("Job not found") };
      case (?job) {
        let updatedJob = { job with status = newStatus };
        jobStore.add(jobId, updatedJob);
      };
    };
  };

  public shared ({ caller }) func deleteJob(jobId : Nat) : async () {
    ensureAuthorized(caller);
    if (not jobStore.containsKey(jobId)) {
      Runtime.trap("Job not found");
    };
    jobStore.remove(jobId);
  };

  // Job photo management using blob storage
  public shared ({ caller }) func addJobPhoto(jobId : Nat, photo : Storage.ExternalBlob) : async () {
    ensureAuthorized(caller);

    switch (jobStore.get(jobId)) {
      case (null) { Runtime.trap("Job not found") };
      case (?job) {
        let photosList = List.fromArray(job.photos);
        photosList.add(photo);
        let updatedJob = { job with photos = photosList.toArray() };
        jobStore.add(jobId, updatedJob);
      };
    };
  };

  public shared ({ caller }) func removeJobPhoto(jobId : Nat, photoIndex : Nat) : async () {
    ensureAuthorized(caller);

    switch (jobStore.get(jobId)) {
      case (null) { Runtime.trap("Job not found") };
      case (?job) {
        if (photoIndex >= job.photos.size()) {
          Runtime.trap("Invalid photo index");
        };

        let photosList = List.fromArray(job.photos);
        let filteredPhotos = photosList.enumerate().filter(
          func((i, _)) { i != photoIndex }
        );
        let newPhotosList = filteredPhotos.map(
          func((_, photo)) { photo }
        );
        let updatedJob = { job with photos = newPhotosList.toArray() };
        jobStore.add(jobId, updatedJob);
      };
    };
  };

  // Labor Line Item Management
  public shared ({ caller }) func addLaborLineItem(jobId : Nat, laborLineItem : LaborLineItem) : async () {
    ensureAuthorized(caller);

    switch (jobStore.get(jobId)) {
      case (null) { Runtime.trap("Job not found") };
      case (?job) {
        let laborItemsList = List.fromArray<LaborLineItem>(job.laborLineItems);
        laborItemsList.add(laborLineItem);
        let updatedJob = { job with laborLineItems = laborItemsList.toArray() };
        jobStore.add(jobId, updatedJob);
      };
    };
  };

  public shared ({ caller }) func removeLaborLineItem(jobId : Nat, index : Nat) : async () {
    ensureAuthorized(caller);

    switch (jobStore.get(jobId)) {
      case (null) { Runtime.trap("Job not found") };
      case (?job) {
        if (index >= job.laborLineItems.size()) {
          Runtime.trap("Invalid labor line item index");
        };

        let laborItemsList = List.fromArray<LaborLineItem>(job.laborLineItems);
        let filteredLaborItems = laborItemsList.enumerate().filter(
          func((i, _)) { i != index }
        );
        let newLaborItemsList = filteredLaborItems.map(
          func((_, item)) { item }
        );
        let updatedJob = { job with laborLineItems = newLaborItemsList.toArray() };
        jobStore.add(jobId, updatedJob);
      };
    };
  };

  // User Signature Management
  public shared ({ caller }) func storeUserSignature(sig : Blob) : async () {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only authorized users can store signatures");
    };
    userSignatures.add(caller, sig);
  };

  public query ({ caller }) func getUserSignature() : async ?Blob {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only authorized users can get signatures");
    };
    userSignatures.get(caller);
  };

  // Inventory (Part) operations - accessible by authorized users and owner
  public shared ({ caller }) func createPart(part : Part) : async Nat {
    ensureAuthorizedOrOwner(caller);
    partStore.add(part.id, part);
    part.id;
  };

  public query ({ caller }) func getPart(partId : Nat) : async Part {
    ensureAuthorizedOrOwner(caller);
    switch (partStore.get(partId)) {
      case (null) { Runtime.trap("Part not found") };
      case (?part) { part };
    };
  };

  public query ({ caller }) func listParts() : async [Part] {
    ensureAuthorizedOrOwner(caller);
    partStore.values().toArray();
  };

  public shared ({ caller }) func updatePart(part : Part) : async () {
    ensureAuthorizedOrOwner(caller);
    if (not partStore.containsKey(part.id)) {
      Runtime.trap("Part not found");
    };
    partStore.add(part.id, part);
  };

  public shared ({ caller }) func deletePart(partId : Nat) : async () {
    ensureAuthorizedOrOwner(caller);
    if (not partStore.containsKey(partId)) {
      Runtime.trap("Part not found");
    };
    partStore.remove(partId);
  };

  public shared ({ caller }) func usePartOnJob(partId : Nat, jobId : Nat, quantityUsed : Nat) : async () {
    ensureAuthorizedOrOwner(caller);
    switch (partStore.get(partId)) {
      case (null) { Runtime.trap("Part not found") };
      case (?part) {
        if (not jobStore.containsKey(jobId)) {
          Runtime.trap("Job not found");
        };
        if (part.quantityOnHand < quantityUsed) {
          Runtime.trap("Insufficient quantity on hand");
        };
        let updatedPart = {
          part with
          quantityOnHand = part.quantityOnHand - quantityUsed;
          jobId = ?jobId;
        };
        partStore.add(partId, updatedPart);
      };
    };
  };

  // Labor Rate operations - only owner
  public shared ({ caller }) func createLaborRate(laborRate : LaborRate) : async Nat {
    ensureOwner(caller);
    laborRatesStore.add(laborRate.id, laborRate);
    laborRate.id;
  };

  public query ({ caller }) func listLaborRates() : async [LaborRate] {
    ensureAuthorized(caller);
    laborRatesStore.values().toArray();
  };

  public shared ({ caller }) func updateLaborRate(laborRate : LaborRate) : async () {
    ensureOwner(caller);
    if (not laborRatesStore.containsKey(laborRate.id)) {
      Runtime.trap("Labor rate not found");
    };
    laborRatesStore.add(laborRate.id, laborRate);
  };

  public shared ({ caller }) func deleteLaborRate(laborRateId : Nat) : async () {
    ensureOwner(caller);
    if (not laborRatesStore.containsKey(laborRateId)) {
      Runtime.trap("Labor rate not found");
    };
    laborRatesStore.remove(laborRateId);
  };
};
