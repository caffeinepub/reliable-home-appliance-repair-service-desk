import Map "mo:core/Map";
import Prim "mo:prim";
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
  include MixinStorage();

  // ─── Dynamic owner principal (survives upgrades, works on any domain) ────────
  // Initialized to the known live principal so existing access is preserved.
  // Call setOwner() from a new domain to transfer ownership to that session's principal.
  var ownerPrincipal : Principal = Principal.fromText(
    "asn62-s2yb6-ezdxu-wy6eu-ml2sx-yaqyb-tvmkf-bgefi-2iqtw-a7b53-yqe"
  );
  // Draft domain principal — also recognized as owner for continuity.
  let draftOwnerPrincipal = Principal.fromText(
    "q5rzs-s67ph-qtb5w-e66j5-2iqax-vlwa5-5pqxy-yosti-xhcis-ocfw6-yqe"
  );

  // ─── Stable access control state (survives upgrades) ────────────────────────
  var stableUserRoles : [(Principal, AccessControl.UserRole)] = [];
  var stableAdminAssigned : Bool = false;

  let accessControlState = AccessControl.initState();

  // On every start, seed both known owner principals as admin.
  accessControlState.userRoles.add(ownerPrincipal, #admin);
  accessControlState.userRoles.add(draftOwnerPrincipal, #admin);
  accessControlState.adminAssigned := true;

  system func preupgrade() {
    stableUserRoles := accessControlState.userRoles.entries().toArray();
    stableAdminAssigned := accessControlState.adminAssigned;
  };

  system func postupgrade() {
    for ((p, r) in stableUserRoles.vals()) {
      accessControlState.userRoles.add(p, r);
    };
    accessControlState.adminAssigned := stableAdminAssigned;
    // Always re-seed owner principals after upgrade
    accessControlState.userRoles.add(ownerPrincipal, #admin);
    accessControlState.userRoles.add(draftOwnerPrincipal, #admin);
    accessControlState.adminAssigned := true;
  };

  include MixinAuthorization(accessControlState);

  // ─── Owner management ───────────────────────────────────────────────────────

  // Set dynamically on deploy/upgrade — caller becomes owner if they are
  // already one of the known owner principals.
  public shared ({ caller }) func setOwner() : async Text {
    if (caller == ownerPrincipal or caller == draftOwnerPrincipal) {
      ownerPrincipal := caller;
      accessControlState.userRoles.add(caller, #admin);
      return "Owner set to " # caller.toText();
    };
    "Unauthorized: Only a known owner principal can call setOwner"
  };

  var nextInvoiceNumber = 1;
  var nextJobNumber = 1;

  public type UserProfile = { name : Text };
  var userProfiles = Map.empty<Principal, UserProfile>();
  var userSignatures = Map.empty<Principal, Blob>();


  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (caller == ownerPrincipal or caller == draftOwnerPrincipal) {
      return userProfiles.get(caller);
    };
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      return null;
    };
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (caller != ownerPrincipal and caller != draftOwnerPrincipal and caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (caller == ownerPrincipal or caller == draftOwnerPrincipal) {
      userProfiles.add(caller, profile);
      return;
    };
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

  public type JobPartLineItem = {
    id : Nat;
    partId : ?Nat;
    partNumber : Text;
    name : Text;
    description : Text;
    quantity : Nat;
    unitPrice : Nat;
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

  public type Invoice = {
    id : Nat;
    jobId : Nat;
    invoiceNumber : Nat;
    issuedAt : Time.Time;
    notes : Text;
    isPaid : Bool;
  };

  var clientStore = Map.empty<Nat, Client>();
  var jobStore = Map.empty<Nat, Job>();
  var partStore = Map.empty<Nat, Part>();
  var laborRatesStore = Map.empty<Nat, LaborRate>();
  var jobPartLineItemsStore = Map.empty<Nat, [JobPartLineItem]>();
  var invoiceStore = Map.empty<Nat, Invoice>();
  var stripeKey : ?Text = null;
  var stripeConfigured : Bool = false;

  func isAuthorizedOrOwner(caller : Principal) : Bool {
    if (caller == ownerPrincipal or caller == draftOwnerPrincipal) return true;
    AccessControl.hasPermission(accessControlState, caller, #user);
  };

  func checkAuth(caller : Principal) {
    if (not isAuthorizedOrOwner(caller)) {
      Runtime.trap("Unauthorized: Only authorized users or owner can perform this action");
    };
  };

  func isAdminOrOwner(caller : Principal) : Bool {
    if (caller == ownerPrincipal or caller == draftOwnerPrincipal) return true;
    AccessControl.isAdmin(accessControlState, caller);
  };

  // ─── Clients ────────────────────────────────────────────────────────────────

  public shared ({ caller }) func createClient(client : Client) : async Nat {
    checkAuth(caller);
    clientStore.add(client.id, client);
    client.id;
  };

  public query ({ caller }) func getClient(_clientId : Nat) : async Client {
    checkAuth(caller);
    switch (clientStore.get(_clientId)) {
      case (null) { Runtime.trap("Client not found") };
      case (?c) { c };
    };
  };

  public query ({ caller }) func listClients() : async [Client] {
    checkAuth(caller);
    clientStore.values().toArray();
  };

  public shared ({ caller }) func updateClient(client : Client) : async () {
    checkAuth(caller);
    clientStore.add(client.id, client);
  };

  public shared ({ caller }) func deleteClient(clientId : Nat) : async () {
    checkAuth(caller);
    clientStore.remove(clientId);
  };

  // ─── Jobs ───────────────────────────────────────────────────────────────────

  public shared ({ caller }) func createJob(job : Job) : async Nat {
    checkAuth(caller);
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
    checkAuth(caller);
    jobStore.values().toArray();
  };

  public shared ({ caller }) func updateJob(job : Job) : async () {
    checkAuth(caller);
    jobStore.add(job.id, job);
  };

  public shared ({ caller }) func deleteJob(jobId : Nat) : async () {
    checkAuth(caller);
    jobStore.remove(jobId);
    jobPartLineItemsStore.remove(jobId);
  };

  public shared ({ caller }) func updateJobStatus(jobId : Nat, newStatus : JobStatus) : async () {
    checkAuth(caller);
    switch (jobStore.get(jobId)) {
      case (null) { Runtime.trap("Job not found") };
      case (?job) {
        jobStore.add(jobId, { job with status = newStatus });
      };
    };
  };

  public shared ({ caller }) func addJobPhoto(jobId : Nat, photo : Storage.ExternalBlob) : async () {
    checkAuth(caller);
    switch (jobStore.get(jobId)) {
      case (null) { Runtime.trap("Job not found") };
      case (?job) {
        let list = List.fromArray(job.photos);
        list.add(photo);
        jobStore.add(jobId, { job with photos = list.toArray() });
      };
    };
  };

  public shared ({ caller }) func removeJobPhoto(jobId : Nat, photoIndex : Nat) : async () {
    checkAuth(caller);
    switch (jobStore.get(jobId)) {
      case (null) { Runtime.trap("Job not found") };
      case (?job) {
        if (photoIndex >= job.photos.size()) Runtime.trap("Invalid photo index");
        let filtered = List.fromArray(job.photos).enumerate()
          .filter(func((i, _)) { i != photoIndex })
          .map(func((_, p)) { p });
        jobStore.add(jobId, { job with photos = filtered.toArray() });
      };
    };
  };

  public shared ({ caller }) func updateEstimate(jobId : Nat, estimate : Estimate) : async () {
    checkAuth(caller);
    switch (jobStore.get(jobId)) {
      case (null) { Runtime.trap("Job not found") };
      case (?job) {
        jobStore.add(jobId, { job with estimate = ?estimate });
      };
    };
  };

  public shared ({ caller }) func addLaborLineItem(jobId : Nat, laborLineItem : LaborLineItem) : async () {
    checkAuth(caller);
    switch (jobStore.get(jobId)) {
      case (null) { Runtime.trap("Job not found") };
      case (?job) {
        let list = List.fromArray<LaborLineItem>(job.laborLineItems);
        list.add(laborLineItem);
        jobStore.add(jobId, { job with laborLineItems = list.toArray() });
      };
    };
  };

  public shared ({ caller }) func removeLaborLineItem(jobId : Nat, index : Nat) : async () {
    checkAuth(caller);
    switch (jobStore.get(jobId)) {
      case (null) { Runtime.trap("Job not found") };
      case (?job) {
        if (index >= job.laborLineItems.size()) Runtime.trap("Invalid labor line item index");
        let filtered = List.fromArray<LaborLineItem>(job.laborLineItems).enumerate()
          .filter(func((i, _)) { i != index })
          .map(func((_, it)) { it });
        jobStore.add(jobId, { job with laborLineItems = filtered.toArray() });
      };
    };
  };

  // ─── Job Part Line Items ────────────────────────────────────────────────────

  public query ({ caller }) func getJobPartLineItems(jobId : Nat) : async [JobPartLineItem] {
    checkAuth(caller);
    switch (jobPartLineItemsStore.get(jobId)) {
      case (null) { [] };
      case (?items) { items };
    };
  };

  public shared ({ caller }) func addJobPartLineItem(jobId : Nat, item : JobPartLineItem) : async () {
    checkAuth(caller);
    if (not jobStore.containsKey(jobId)) Runtime.trap("Job not found");
    let existing = switch (jobPartLineItemsStore.get(jobId)) {
      case (null) { [] };
      case (?items) { items };
    };
    let list = List.fromArray<JobPartLineItem>(existing);
    list.add(item);
    jobPartLineItemsStore.add(jobId, list.toArray());
    switch (item.partId) {
      case (null) {};
      case (?pid) {
        switch (partStore.get(pid)) {
          case (null) {};
          case (?part) {
            let used = if (item.quantity > part.quantityOnHand) { part.quantityOnHand } else { item.quantity };
            let newQty = if (part.quantityOnHand >= used) { part.quantityOnHand - used } else { 0 };
            partStore.add(pid, { part with quantityOnHand = newQty; jobId = ?jobId });
          };
        };
      };
    };
  };

  public shared ({ caller }) func removeJobPartLineItem(jobId : Nat, index : Nat) : async () {
    checkAuth(caller);
    let existing = switch (jobPartLineItemsStore.get(jobId)) {
      case (null) { Runtime.trap("No parts on this job") };
      case (?items) { items };
    };
    if (index >= existing.size()) Runtime.trap("Invalid part line item index");
    let filtered = List.fromArray<JobPartLineItem>(existing).enumerate()
      .filter(func((i, _)) { i != index })
      .map(func((_, it)) { it });
    jobPartLineItemsStore.add(jobId, filtered.toArray());
  };

  // ─── Invoices ───────────────────────────────────────────────────────────────

  public shared ({ caller }) func createInvoice(invoice : Invoice) : async Nat {
    checkAuth(caller);
    let newInvoice = { invoice with id = nextInvoiceNumber; invoiceNumber = nextInvoiceNumber };
    invoiceStore.add(newInvoice.id, newInvoice);
    nextInvoiceNumber += 1;
    newInvoice.id;
  };

  public query ({ caller }) func getInvoice(invoiceId : Nat) : async Invoice {
    checkAuth(caller);
    switch (invoiceStore.get(invoiceId)) {
      case (null) { Runtime.trap("Invoice not found") };
      case (?inv) { inv };
    };
  };

  public query ({ caller }) func listInvoices() : async [Invoice] {
    checkAuth(caller);
    invoiceStore.values().toArray();
  };

  public shared ({ caller }) func updateInvoice(invoice : Invoice) : async () {
    checkAuth(caller);
    invoiceStore.add(invoice.id, invoice);
  };

  public shared ({ caller }) func deleteInvoice(invoiceId : Nat) : async () {
    checkAuth(caller);
    invoiceStore.remove(invoiceId);
  };

  // ─── Inventory (Parts) ──────────────────────────────────────────────────────

  public shared ({ caller }) func createPart(part : Part) : async Nat {
    checkAuth(caller);
    partStore.add(part.id, part);
    part.id;
  };

  public query ({ caller }) func getPart(partId : Nat) : async Part {
    checkAuth(caller);
    switch (partStore.get(partId)) {
      case (null) { Runtime.trap("Part not found") };
      case (?part) { part };
    };
  };

  public query ({ caller }) func listParts() : async [Part] {
    checkAuth(caller);
    partStore.values().toArray();
  };

  public shared ({ caller }) func updatePart(part : Part) : async () {
    checkAuth(caller);
    if (not partStore.containsKey(part.id)) Runtime.trap("Part not found");
    partStore.add(part.id, part);
  };

  public shared ({ caller }) func deletePart(partId : Nat) : async () {
    checkAuth(caller);
    if (not partStore.containsKey(partId)) Runtime.trap("Part not found");
    partStore.remove(partId);
  };

  public shared ({ caller }) func usePartOnJob(partId : Nat, jobId : Nat, quantityUsed : Nat) : async () {
    checkAuth(caller);
    switch (partStore.get(partId)) {
      case (null) { Runtime.trap("Part not found") };
      case (?part) {
        if (not jobStore.containsKey(jobId)) Runtime.trap("Job not found");
        if (part.quantityOnHand < quantityUsed) Runtime.trap("Insufficient quantity on hand");
        let newQty = if (part.quantityOnHand >= quantityUsed) { part.quantityOnHand - quantityUsed } else { 0 };
        partStore.add(partId, { part with quantityOnHand = newQty; jobId = ?jobId });
      };
    };
  };

  public query ({ caller }) func getTotalPartCostByJob(jobId : Nat) : async Nat {
    checkAuth(caller);
    switch (jobPartLineItemsStore.get(jobId)) {
      case (null) { 0 };
      case (?items) {
        items.foldLeft(0, func(acc, item) { acc + item.unitPrice * item.quantity });
      };
    };
  };

  // ─── Labor Rates ────────────────────────────────────────────────────────────

  public shared ({ caller }) func createLaborRate(laborRate : LaborRate) : async Nat {
    checkAuth(caller);
    laborRatesStore.add(laborRate.id, laborRate);
    laborRate.id;
  };

  public query ({ caller }) func listLaborRates() : async [LaborRate] {
    checkAuth(caller);
    laborRatesStore.values().toArray();
  };

  public shared ({ caller }) func updateLaborRate(laborRate : LaborRate) : async () {
    checkAuth(caller);
    laborRatesStore.add(laborRate.id, laborRate);
  };

  public shared ({ caller }) func deleteLaborRate(laborRateId : Nat) : async () {
    checkAuth(caller);
    laborRatesStore.remove(laborRateId);
  };

  // ─── Scheduling ─────────────────────────────────────────────────────────────

  public shared ({ caller }) func updateJobSchedule(jobId : Nat, scheduledStart : ?Time.Time, scheduledEnd : ?Time.Time) : async () {
    checkAuth(caller);
    switch (jobStore.get(jobId)) {
      case (null) { Runtime.trap("Job not found") };
      case (?job) {
        jobStore.add(jobId, { job with scheduledStart; scheduledEnd });
      };
    };
  };

  // ─── Payments (Stripe) ──────────────────────────────────────────────────────

  func getStripeConfiguration() : Stripe.StripeConfiguration {
    switch (stripeKey) {
      case (null) { Runtime.trap("Stripe key not set") };
      case (?key) { { secretKey = key; allowedCountries = ["US"] } };
    };
  };

  public query ({ caller }) func isStripeConfigured() : async Bool {
    stripeConfigured;
  };

  // Allow owner to claim admin rights by token (for live domain recovery)
  public shared ({ caller }) func forceGrantAdminByToken(token : Text) : async Bool {
    switch (Prim.envVar<system>("CAFFEINE_ADMIN_TOKEN")) {
      case (null) { false };
      case (?adminToken) {
        if (caller == ownerPrincipal or caller == draftOwnerPrincipal or token == adminToken) {
          accessControlState.userRoles.add(caller, #admin);
          accessControlState.adminAssigned := true;
          true;
        } else { false };
      };
    };
  };

  public shared ({ caller }) func setStripeConfiguration(config : Stripe.StripeConfiguration) : async () {
    if (not isAdminOrOwner(caller)) Runtime.trap("Unauthorized: Only the owner or admin can set Stripe configuration");
    stripeKey := ?config.secretKey;
    stripeConfigured := true;
  };

  public shared ({ caller }) func getStripeSessionStatus(sessionId : Text) : async Stripe.StripeSessionStatus {
    checkAuth(caller);
    await Stripe.getSessionStatus(getStripeConfiguration(), sessionId, transform);
  };

  public shared ({ caller }) func createCheckoutSession(items : [Stripe.ShoppingItem], successUrl : Text, cancelUrl : Text) : async Text {
    checkAuth(caller);
    await Stripe.createCheckoutSession(getStripeConfiguration(), caller, items, successUrl, cancelUrl, transform);
  };

  public query func transform(input : OutCall.TransformationInput) : async OutCall.TransformationOutput {
    OutCall.transform(input);
  };

  public shared ({ caller }) func updateJobPayment(jobId : Nat, paymentIntentId : Text) : async () {
    checkAuth(caller);
    switch (jobStore.get(jobId)) {
      case (null) { Runtime.trap("Job not found") };
      case (?job) {
        jobStore.add(jobId, { job with stripePaymentId = ?paymentIntentId });
      };
    };
  };

  public shared ({ caller }) func createPaymentIntent(_jobId : Nat, amountInCents : Nat) : async Text {
    checkAuth(caller);
    let amount = Int.abs(amountInCents);
    let url = "https://api.stripe.com/v1/payment_intents";
    let headers : [OutCall.Header] = [
      { name = "Authorization"; value = "Bearer " # getStripeConfiguration().secretKey },
      { name = "Content-Type"; value = "application/x-www-form-urlencoded" },
    ];
    let body = "amount=" # amount.toText() # "&currency=usd";
    let response = await OutCall.httpPostRequest(url, headers, body, transform);
    switch (response.size()) {
      case (0) { Runtime.trap("Stripe API call failed or returned no data") };
      case (_) { response };
    };
  };

  // ─── Signatures ─────────────────────────────────────────────────────────────

  public shared ({ caller }) func storeUserSignature(sig : Blob) : async () {
    checkAuth(caller);
    userSignatures.add(caller, sig);
  };

  public query ({ caller }) func getUserSignature() : async ?Blob {
    checkAuth(caller);
    userSignatures.get(caller);
  };

  // ─── Damage Waivers ─────────────────────────────────────────────────────────

  public query ({ caller }) func getDamageWaiver(jobId : Nat) : async ?DamageWaiver {
    checkAuth(caller);
    switch (jobStore.get(jobId)) {
      case (null) { Runtime.trap("Job not found") };
      case (?job) { job.damageWaiver };
    };
  };

  public shared ({ caller }) func updateDamageWaiver(jobId : Nat, waiver : DamageWaiver) : async () {
    checkAuth(caller);
    switch (jobStore.get(jobId)) {
      case (null) { Runtime.trap("Job not found") };
      case (?job) {
        jobStore.add(jobId, { job with damageWaiver = ?waiver });
      };
    };
  };

};
