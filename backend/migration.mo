import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Text "mo:core/Text";
import Blob "mo:core/Blob";
import Time "mo:core/Time";
import List "mo:core/List";
import Principal "mo:core/Principal";
import Storage "blob-storage/Storage";
import Float "mo:core/Float";

module {
  type UserProfile = { name : Text };
  type Client = {
    id : Nat;
    name : Text;
    phone : Text;
    address : Text;
    notes : Text;
    email : ?Text;
    googleReviewUrl : ?Text;
  };
  type RateType = { #hourly; #flat };
  type LaborRate = {
    id : Nat;
    name : Text;
    rateType : RateType;
    amount : Nat;
  };
  type LaborLineItem = {
    name : Text;
    rateType : RateType;
    hours : Float;
    rateAmount : Nat;
    description : Text;
    totalAmount : Nat;
  };
  type JobStatus = { #open; #inProgress; #complete };
  type Estimate = {
    amount : Nat;
    sigData : Blob;
    sigTime : Time.Time;
  };
  type WaiverType = {
    #preexisting;
    #potential;
    #general;
  };
  type DamageWaiver = {
    enabled : Bool;
    waiverText : Text;
  };
  type Job = {
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
  type Part = {
    id : Nat;
    name : Text;
    partNumber : Text;
    description : Text;
    quantityOnHand : Nat;
    unitCost : Nat;
    jobId : ?Nat;
  };

  // Old record types (without damage waiver)
  type OldJob = {
    id : Nat;
    clientId : Nat;
    tech : Principal.Principal;
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
  };

  // Old actor (persistent state) type
  type OldActor = {
    userProfiles : Map.Map<Principal, UserProfile>;
    userSignatures : Map.Map<Principal, Blob>;
    clientStore : Map.Map<Nat, Client>;
    jobStore : Map.Map<Nat, OldJob>;
    partStore : Map.Map<Nat, Part>;
    laborRatesStore : Map.Map<Nat, LaborRate>;
    stripeKey : ?Text;
    stripeConfigured : Bool;
  };

  // New actor (persistent state) type
  type NewActor = {
    userProfiles : Map.Map<Principal, UserProfile>;
    userSignatures : Map.Map<Principal, Blob>;
    clientStore : Map.Map<Nat, Client>;
    jobStore : Map.Map<Nat, Job>;
    partStore : Map.Map<Nat, Part>;
    laborRatesStore : Map.Map<Nat, LaborRate>;
    stripeKey : ?Text;
    stripeConfigured : Bool;
  };

  public func run(old : OldActor) : NewActor {
    let jobsWithWaiver = old.jobStore.map<Nat, OldJob, Job>(
      func(_id, oldJob) {
        {
          oldJob with
          damageWaiver = ?{
            enabled = false;
            waiverText = "I acknowledge that pre-existing damage, cosmetic issues, or conditions not caused by the repair technician are not the responsibility of Reliable Home Appliance Repair LLC. By signing below, I agree to these terms.";
          };
        };
      }
    );
    { old with jobStore = jobsWithWaiver };
  };
};
