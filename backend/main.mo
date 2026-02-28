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

  let ownerPrincipal : Principal = Principal.fromText("w3w26-hrxnk-kfpaw-7trqf-ngcqt-xm3i3-qebzp-vtech-eqcjs-nahkw-fae");

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

  let clientStore = Map.empty<Nat, Client>();
  let jobStore = Map.empty<Nat, Job>();

  public type LaborRate = {
    id : Nat;
    name : Text;
    rateType : { #hourly; #flat };
    amount : Nat;
  };

  let laborRatesStore = Map.empty<Nat, LaborRate>();

  func ensureAuthorized(caller : Principal) {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only authorized users can perform this action");
    };
  };

  func ensureOwner(caller : Principal) {
    if (caller != ownerPrincipal and not AccessControl.isAdmin(accessControlState, caller)) {
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
