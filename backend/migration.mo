import Map "mo:core/Map";
import Text "mo:core/Text";
import Principal "mo:core/Principal";
import Nat "mo:core/Nat";

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
  type Job = {
    id : Nat;
    clientId : Nat;
    tech : Principal;
    date : Int;
    status : { #open; #inProgress; #complete };
    notes : Text;
    photos : [Blob];
    estimate : ?{ amount : Nat; sigData : Blob; sigTime : Int };
    waiverType : ?{ #preexisting; #potential; #general };
    maintenancePackage : ?Text;
    stripePaymentId : ?Text;
  };
  type LaborRate = {
    id : Nat;
    name : Text;
    rateType : { #hourly; #flat };
    amount : Nat;
  };
  type Actor = {
    userProfiles : Map.Map<Principal, UserProfile>;
    clientStore : Map.Map<Nat, Client>;
    jobStore : Map.Map<Nat, Job>;
    laborRatesStore : Map.Map<Nat, LaborRate>;
  };

  public func run(old : Actor) : Actor {
    old;
  };
};
