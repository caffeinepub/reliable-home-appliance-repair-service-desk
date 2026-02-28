import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Blob "mo:core/Blob";
import Time "mo:core/Time";
import Principal "mo:core/Principal";
import Storage "blob-storage/Storage";

module {
  // Types from old code (before adding laborLineItems)
  public type OldJob = {
    id : Nat;
    clientId : Nat;
    tech : Principal;
    date : Time.Time;
    status : { #open; #inProgress; #complete };
    notes : Text;
    photos : [Storage.ExternalBlob];
    estimate : ?{
      amount : Nat;
      sigData : Blob;
      sigTime : Time.Time;
    };
    waiverType : ?{
      #preexisting;
      #potential;
      #general;
    };
    maintenancePackage : ?Text;
    stripePaymentId : ?Text;
  };

  public type OldActor = {
    jobStore : Map.Map<Nat, OldJob>;
  };

  // Types from new code (with laborLineItems)
  public type NewJob = {
    id : Nat;
    clientId : Nat;
    tech : Principal;
    date : Time.Time;
    status : { #open; #inProgress; #complete };
    notes : Text;
    photos : [Storage.ExternalBlob];
    estimate : ?{
      amount : Nat;
      sigData : Blob;
      sigTime : Time.Time;
    };
    waiverType : ?{
      #preexisting;
      #potential;
      #general;
    };
    maintenancePackage : ?Text;
    stripePaymentId : ?Text;
    laborLineItems : [{
      laborRateId : Nat;
      rateType : { #hourly; #flat };
      hours : ?Float;
      amount : Nat;
      description : Text;
    }];
  };

  public type NewActor = {
    jobStore : Map.Map<Nat, NewJob>;
  };

  public func run(old : OldActor) : NewActor {
    let newJobStore = old.jobStore.map<Nat, OldJob, NewJob>(
      func(_id, oldJob) { { oldJob with laborLineItems = [] } }
    );
    { jobStore = newJobStore };
  };
};
