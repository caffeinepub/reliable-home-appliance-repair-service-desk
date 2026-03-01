import Map "mo:core/Map";
import List "mo:core/List";
import Nat "mo:core/Nat";
import Text "mo:core/Text";
import Blob "mo:core/Blob";
import Time "mo:core/Time";
import Iter "mo:core/Iter";
import Runtime "mo:core/Runtime";
import Principal "mo:core/Principal";
import Float "mo:core/Float";
import Option "mo:core/Option";

import MixinAuthorization "authorization/MixinAuthorization";
import AccessControl "authorization/access-control";
import MixinStorage "blob-storage/Mixin";
import Storage "blob-storage/Storage";
import Stripe "stripe/stripe";
import OutCall "http-outcalls/outcall";
import Migration "migration";

(with migration = Migration.run)
actor {
  include MixinStorage();

  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  // This : `ownerPrincipal` must never be changed.
  // Do never reassign this. 
  // This is constant for max security.
  let ownerPrincipal : Principal = Principal.fromText(
    "q5rzs-s67ph-qtb5w-e66j5-2iqax-vlwa5-5pqxy-yosti-xhcis-ocfw6-yqe"
  );

  public type UserProfile = { name : Text };
  stable let userProfiles = Map.empty<Principal, UserProfile>();
  stable let userSignatures = Map.empty<Principal, Blob>();

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
    name : Text;
    rateType : RateType;
    hours : Float;
    rateAmount : Nat;
    description : Text;
    totalAmount : Nat;
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
    laborLineItems : [LaborLineItem];
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

  stable let clientStore = Map.empty<Nat, Client>();
  stable let jobStore = Map.empty<Nat, Job>();
  stable let partStore = Map.empty<Nat, Part>();
  stable let laborRatesStore = Map.empty<Nat, LaborRate>();

  var stripeKey : ?Text = null;
  var stripeConfigured : Bool = false;

  func isAuthorizedOrOwner(caller : Principal) : Bool {
    if (caller == ownerPrincipal) {
      return true;
    };
    AccessControl.hasPermission(accessControlState, caller, #user);
  };

  public shared ({ caller }) func createClient(client : Client) : async Nat {
    if (not isAuthorizedOrOwner(caller)) {
      Runtime.trap("Unauthorized: Only authorized users or owner can create clients");
    };
    clientStore.add(client.id, client);
    client.id;
  };

  public query ({ caller }) func getClient(_clientId : Nat) : async Client {
    if (not isAuthorizedOrOwner(caller)) {
      Runtime.trap("Unauthorized: Only authorized users or owner can get clients");
    };
    switch (clientStore.get(_clientId)) {
      case (null) { Runtime.trap("Client not found") };
      case (?client) { client };
    };
  };

  public query ({ caller }) func listClients() : async [Client] {
    if (not isAuthorizedOrOwner(caller)) {
      Runtime.trap("Unauthorized: Only authorized users or owner can list clients");
    };
    clientStore.values().toArray();
  };

  public shared ({ caller }) func updateClient(client : Client) : async () {
    if (not isAuthorizedOrOwner(caller)) {
      Runtime.trap("Unauthorized: Only authorized users or owner can update clients");
    };
    clientStore.add(client.id, client);
  };

  public shared ({ caller }) func deleteClient(clientId : Nat) : async () {
    if (not isAuthorizedOrOwner(caller)) {
      Runtime.trap("Unauthorized: Only authorized users or owner can delete clients");
    };
    clientStore.remove(clientId);
  };

  public shared ({ caller }) func createJob(job : Job) : async Nat {
    if (not isAuthorizedOrOwner(caller)) {
      Runtime.trap("Unauthorized: Only authorized users or owner can create jobs");
    };
    jobStore.add(job.id, job);
    job.id;
  };

  public query ({ caller }) func getJob(_jobId : Nat) : async Job {
    if (not isAuthorizedOrOwner(caller)) {
      Runtime.trap("Unauthorized: Only authorized users or owner can get jobs");
    };
    switch (jobStore.get(_jobId)) {
      case (null) { Runtime.trap("Job not found") };
      case (?job) { job };
    };
  };

  public query ({ caller }) func listJobs() : async [Job] {
    if (not isAuthorizedOrOwner(caller)) {
      Runtime.trap("Unauthorized: Only authorized users or owner can list jobs");
    };
    jobStore.values().toArray();
  };

  public shared ({ caller }) func updateJob(job : Job) : async () {
    if (not isAuthorizedOrOwner(caller)) {
      Runtime.trap("Unauthorized: Only authorized users or owner can update jobs");
    };
    jobStore.add(job.id, job);
  };

  public shared ({ caller }) func deleteJob(jobId : Nat) : async () {
    if (not isAuthorizedOrOwner(caller)) {
      Runtime.trap("Unauthorized: Only authorized users or owner can delete jobs");
    };
    jobStore.remove(jobId);
  };

  public shared ({ caller }) func updateJobStatus(jobId : Nat, newStatus : JobStatus) : async () {
    if (not isAuthorizedOrOwner(caller)) {
      Runtime.trap("Unauthorized: Only authorized users or owner can update job status");
    };
    switch (jobStore.get(jobId)) {
      case (null) { Runtime.trap("Job not found") };
      case (?job) {
        let updatedJob = { job with status = newStatus };
        jobStore.add(jobId, updatedJob);
      };
    };
  };

  public shared ({ caller }) func addJobPhoto(jobId : Nat, photo : Storage.ExternalBlob) : async () {
    if (not isAuthorizedOrOwner(caller)) {
      Runtime.trap("Unauthorized: Only authorized users or owner can add job photos");
    };
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
    if (not isAuthorizedOrOwner(caller)) {
      Runtime.trap("Unauthorized: Only authorized users or owner can remove job photos");
    };
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

  public shared ({ caller }) func updateEstimate(jobId : Nat, estimate : Estimate) : async () {
    if (not isAuthorizedOrOwner(caller)) {
      Runtime.trap("Unauthorized: Only authorized users or owner can update estimate");
    };
    switch (jobStore.get(jobId)) {
      case (null) { Runtime.trap("Job not found") };
      case (?job) {
        let updatedJob = { job with estimate = ?estimate };
        jobStore.add(jobId, updatedJob);
      };
    };
  };

  func getStripeConfiguration() : Stripe.StripeConfiguration {
    switch (stripeKey) {
      case (null) { Runtime.trap("Stripe key not set") };
      case (?key) {
        {
          secretKey = key;
          allowedCountries = ["US"];
        };
      };
    };
  };

  public shared ({ caller }) func addLaborLineItem(jobId : Nat, laborLineItem : LaborLineItem) : async () {
    if (not isAuthorizedOrOwner(caller)) {
      Runtime.trap("Unauthorized: Only authorized users or owner can add labor line items");
    };
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
    if (not isAuthorizedOrOwner(caller)) {
      Runtime.trap("Unauthorized: Only authorized users or owner can remove labor line items");
    };
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

  public query ({ caller }) func isStripeConfigured() : async Bool {
    stripeConfigured;
  };

  public shared ({ caller }) func setStripeConfiguration(config : Stripe.StripeConfiguration) : async () {
    if (caller != ownerPrincipal) {
      Runtime.trap("Unauthorized: Only the owner can set Stripe configuration");
    };
    stripeKey := ?config.secretKey;
    stripeConfigured := true;
  };

  public shared ({ caller }) func getStripeSessionStatus(sessionId : Text) : async Stripe.StripeSessionStatus {
    await Stripe.getSessionStatus(getStripeConfiguration(), sessionId, transform);
  };

  public shared ({ caller }) func createCheckoutSession(items : [Stripe.ShoppingItem], successUrl : Text, cancelUrl : Text) : async Text {
    await Stripe.createCheckoutSession(
      getStripeConfiguration(),
      caller,
      items,
      successUrl,
      cancelUrl,
      transform
    );
  };

  public query func transform(input : OutCall.TransformationInput) : async OutCall.TransformationOutput {
    OutCall.transform(input);
  };

  // Store the caller's signature blob. Requires at minimum #user role (or owner).
  public shared ({ caller }) func storeUserSignature(sig : Blob) : async () {
    if (not isAuthorizedOrOwner(caller)) {
      Runtime.trap("Unauthorized: Only authorized users or owner can store signatures");
    };
    userSignatures.add(caller, sig);
  };

  // Retrieve the caller's stored signature blob. Requires at minimum #user role (or owner).
  public query ({ caller }) func getUserSignature() : async ?Blob {
    if (not isAuthorizedOrOwner(caller)) {
      Runtime.trap("Unauthorized: Only authorized users or owner can get signatures");
    };
    userSignatures.get(caller);
  };

  public shared ({ caller }) func createPart(part : Part) : async Nat {
    if (not isAuthorizedOrOwner(caller)) {
      Runtime.trap("Unauthorized: Only authorized users or owner can create parts");
    };
    partStore.add(part.id, part);
    part.id;
  };

  public query ({ caller }) func getPart(partId : Nat) : async Part {
    if (not isAuthorizedOrOwner(caller)) {
      Runtime.trap("Unauthorized: Only authorized users or owner can get parts");
    };
    switch (partStore.get(partId)) {
      case (null) { Runtime.trap("Part not found") };
      case (?part) { part };
    };
  };

  public query ({ caller }) func listParts() : async [Part] {
    if (not isAuthorizedOrOwner(caller)) {
      Runtime.trap("Unauthorized: Only authorized users or owner can list parts");
    };
    partStore.values().toArray();
  };

  public shared ({ caller }) func updatePart(part : Part) : async () {
    if (not isAuthorizedOrOwner(caller)) {
      Runtime.trap("Unauthorized: Only authorized users or owner can update parts");
    };
    if (not partStore.containsKey(part.id)) {
      Runtime.trap("Part not found");
    };
    partStore.add(part.id, part);
  };

  public shared ({ caller }) func deletePart(partId : Nat) : async () {
    if (not isAuthorizedOrOwner(caller)) {
      Runtime.trap("Unauthorized: Only authorized users or owner can delete parts");
    };
    if (not partStore.containsKey(partId)) {
      Runtime.trap("Part not found");
    };
    partStore.remove(partId);
  };

  public shared ({ caller }) func usePartOnJob(partId : Nat, jobId : Nat, quantityUsed : Nat) : async () {
    if (not isAuthorizedOrOwner(caller)) {
      Runtime.trap("Unauthorized: Only authorized users or owner can use parts on jobs");
    };
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

  public shared ({ caller }) func createLaborRate(laborRate : LaborRate) : async Nat {
    if (caller != ownerPrincipal) {
      Runtime.trap("Unauthorized: Only the owner can create labor rates");
    };
    laborRatesStore.add(laborRate.id, laborRate);
    laborRate.id;
  };

  public query ({ caller }) func listLaborRates() : async [LaborRate] {
    if (not isAuthorizedOrOwner(caller)) {
      Runtime.trap("Unauthorized: Only authorized users or owner can list labor rates");
    };
    laborRatesStore.values().toArray();
  };

  public shared ({ caller }) func updateLaborRate(laborRate : LaborRate) : async () {
    if (caller != ownerPrincipal) {
      Runtime.trap("Unauthorized: Only the owner can update labor rates");
    };
    laborRatesStore.add(laborRate.id, laborRate);
  };

  public shared ({ caller }) func deleteLaborRate(laborRateId : Nat) : async () {
    if (caller != ownerPrincipal) {
      Runtime.trap("Unauthorized: Only the owner can delete labor rates");
    };
    laborRatesStore.remove(laborRateId);
  };
};

