import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Text "mo:core/Text";
import Time "mo:core/Time";
import Runtime "mo:core/Runtime";
import Principal "mo:core/Principal";
import MixinAuthorization "authorization/MixinAuthorization";
import AccessControl "authorization/access-control";



actor {
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  stable let ownerPrincipal : Principal = Principal.fromText("q5rzs-s67ph-qtb5w-e66j5-2iqax-vlwa5-5pqxy-yosti-xhcis-ocfw6-yqe");

  public type UserProfile = { name : Text };
  let userProfiles = Map.empty<Principal, UserProfile>();

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

  public type Job = {
    id : Nat;
    clientId : Nat;
    tech : Principal;
    date : Time.Time;
    status : { #open; #inProgress; #complete };
    notes : Text;
    photos : [Blob];
    estimate : ?{ amount : Nat; sigData : Blob; sigTime : Time.Time };
    waiverType : ?{ #preexisting; #potential; #general };
    maintenancePackage : ?Text;
    stripePaymentId : ?Text;
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

  public type LaborRate = {
    id : Nat;
    name : Text;
    rateType : { #hourly; #flat };
    amount : Nat;
  };

  let laborRatesStore = Map.empty<Nat, LaborRate>();

  // Checks that caller is an authorized user (at minimum #user role) OR is the owner principal
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

  public shared ({ caller }) func updateJobStatus(jobId : Nat, newStatus : { #open; #inProgress; #complete }) : async () {
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
