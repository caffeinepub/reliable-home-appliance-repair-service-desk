import Map "mo:core/Map";
import List "mo:core/List";
import Nat "mo:core/Nat";
import Blob "mo:core/Blob";
import Time "mo:core/Time";
import Int "mo:core/Int";
import Runtime "mo:core/Runtime";
import Principal "mo:core/Principal";
import Float "mo:core/Float";

import MixinAuthorization "authorization/MixinAuthorization";
import AccessControl "authorization/access-control";
import MixinStorage "blob-storage/Mixin";
import Storage "blob-storage/Storage";
import Stripe "stripe/stripe";
import OutCall "http-outcalls/outcall";



actor {
  // Persistent blob storage now handled by storage component, no explicit migration needed.
  include MixinStorage();

  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  var nextJobNumber = 1;

  let ownerPrincipal = Principal.fromText(
    "q5rzs-s67ph-qtb5w-e66j5-2iqax-vlwa5-5pqxy-yosti-xhcis-ocfw6-yqe"
  );

  public type UserProfile = { name : Text };
  var userProfiles = Map.empty<Principal, UserProfile>();
  var userSignatures = Map.empty<Principal, Blob>();

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

  public type DamageWaiver = {
    enabled : Bool;
    waiverText : Text;
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
    scheduledStart : ?Time.Time;
    scheduledEnd : ?Time.Time;
    damageWaiver : ?DamageWaiver;
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

  var clientStore = Map.empty<Nat, Client>();
  var jobStore = Map.empty<Nat, Job>();
  var partStore = Map.empty<Nat, Part>();
  var laborRatesStore = Map.empty<Nat, LaborRate>();
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
    let newJob = { job with id = nextJobNumber };
    jobStore.add(newJob.id, newJob);
    nextJobNumber += 1;
    newJob.id;
  };

  public query ({ caller }) func getJob(_jobId : Nat) : async Job {
    checkAuth(caller);
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
    checkAuth(caller);
    jobStore.add(job.id, job);
  };

  public shared ({ caller }) func deleteJob(jobId : Nat) : async () {
    checkAuth(caller);
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
    checkAuth(caller);
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
    checkAuth(caller);
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
    checkAuth(caller);
    switch (jobStore.get(jobId)) {
      case (null) { Runtime.trap("Job not found") };
      case (?job) {
        let updatedJob = { job with estimate = ?estimate };
        jobStore.add(jobId, updatedJob);
      };
    };
  };

  public shared ({ caller }) func addLaborLineItem(jobId : Nat, laborLineItem : LaborLineItem) : async () {
    checkAuth(caller);
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
    checkAuth(caller);
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
    if (not isAuthorizedOrOwner(caller)) {
      Runtime.trap("Unauthorized: Only authorized users or owner can get Stripe session status");
    };
    await Stripe.getSessionStatus(getStripeConfiguration(), sessionId, transform);
  };

  public shared ({ caller }) func createCheckoutSession(items : [Stripe.ShoppingItem], successUrl : Text, cancelUrl : Text) : async Text {
    checkAuth(caller);
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

  public shared ({ caller }) func storeUserSignature(sig : Blob) : async () {
    checkAuth(caller);
    userSignatures.add(caller, sig);
  };

  public query ({ caller }) func getUserSignature() : async ?Blob {
    checkAuth(caller);
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

  public query ({ caller }) func getTotalPartCostByJob(jobId : Nat) : async Nat {
    if (not isAuthorizedOrOwner(caller)) {
      Runtime.trap("Unauthorized: Only authorized users or owner can get total part cost");
    };
    let parts = partStore.values().toArray();
    let jobParts = parts.filter(func(p) { p.jobId == ?jobId });
    let total = jobParts.foldLeft(
      0,
      func(acc, part) { acc + part.unitCost },
    );
    total;
  };

  public shared ({ caller }) func updateJobSchedule(jobId : Nat, scheduledStart : ?Time.Time, scheduledEnd : ?Time.Time) : async () {
    if (not isAuthorizedOrOwner(caller)) {
      Runtime.trap("Unauthorized: Only authorized users or owner can update job schedule");
    };
    switch (jobStore.get(jobId)) {
      case (null) { Runtime.trap("Job not found") };
      case (?job) {
        let updatedJob = {
          job with
          scheduledStart;
          scheduledEnd;
        };
        jobStore.add(jobId, updatedJob);
      };
    };
  };

  public shared ({ caller }) func updateJobPayment(jobId : Nat, paymentIntentId : Text) : async () {
    if (not isAuthorizedOrOwner(caller)) {
      Runtime.trap("Unauthorized: Only authorized users or owner can update job payment");
    };
    switch (jobStore.get(jobId)) {
      case (null) { Runtime.trap("Job not found") };
      case (?job) {
        let updatedJob = { job with stripePaymentId = ?paymentIntentId };
        jobStore.add(jobId, updatedJob);
      };
    };
  };

  public shared ({ caller }) func createPaymentIntent(jobId : Nat, amountInCents : Nat) : async Text {
    if (not isAuthorizedOrOwner(caller)) {
      Runtime.trap("Unauthorized: Only authorized users or owner can create payment intents");
    };

    let amount = Int.abs(amountInCents);

    let url = "https://api.stripe.com/v1/payment_intents";
    let headers : [OutCall.Header] = [
      {
        name = "Authorization";
        value = "Bearer " # getStripeConfiguration().secretKey;
      },
      { name = "Content-Type"; value = "application/x-www-form-urlencoded" },
    ];
    let body = "amount=" # amount.toText() # "&currency=usd";

    let response = await OutCall.httpPostRequest(url, headers, body, transform);

    switch (response.size()) {
      case (0) { Runtime.trap("Stripe API call failed or returned no data") };
      case (_) { response };
    };
  };

  // Damage Waiver Management
  public query ({ caller }) func getDamageWaiver(jobId : Nat) : async ?DamageWaiver {
    if (not isAuthorizedOrOwner(caller)) {
      Runtime.trap("Unauthorized: Only authorized users can get damage waivers");
    };
    switch (jobStore.get(jobId)) {
      case (null) { Runtime.trap("Job not found") };
      case (?job) { job.damageWaiver };
    };
  };

  public shared ({ caller }) func updateDamageWaiver(jobId : Nat, waiver : DamageWaiver) : async () {
    if (not isAuthorizedOrOwner(caller)) {
      Runtime.trap("Unauthorized: Only authorized users can update damage waivers");
    };
    switch (jobStore.get(jobId)) {
      case (null) { Runtime.trap("Job not found") };
      case (?job) {
        let updatedJob = { job with damageWaiver = ?waiver };
        jobStore.add(jobId, updatedJob);
      };
    };
  };

  func checkAuth(caller : Principal) {
    if (not isAuthorizedOrOwner(caller)) {
      Runtime.trap("Unauthorized: Only authorized users or owner can perform this action");
    };
  };
};
