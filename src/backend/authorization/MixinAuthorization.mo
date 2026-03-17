import AccessControl "./access-control";
import Prim "mo:prim";
import Runtime "mo:core/Runtime";

mixin (accessControlState : AccessControl.AccessControlState, ownerPrincipal : Principal) {
  // Initialize auth (first caller becomes admin, others become users)
  public shared ({ caller }) func _initializeAccessControlWithSecret(userSecret : Text) : async () {
    switch (Prim.envVar<system>("CAFFEINE_ADMIN_TOKEN")) {
      case (null) {
        Runtime.trap("CAFFEINE_ADMIN_TOKEN environment variable is not set");
      };
      case (?adminToken) {
        AccessControl.initialize(accessControlState, caller, adminToken, userSecret);
      };
    };
  };

  public query ({ caller }) func getCallerUserRole() : async AccessControl.UserRole {
    AccessControl.getUserRole(accessControlState, caller);
  };

  // Allow the hardcoded owner to bypass AccessControl role assignment restrictions
  public shared ({ caller }) func assignCallerUserRole(user : Principal, role : AccessControl.UserRole) : async () {
    if (caller == ownerPrincipal) {
      // Owner can always assign roles directly
      accessControlState.userRoles.add(user, role);
    } else {
      // Admin-only check happens inside
      AccessControl.assignRole(accessControlState, caller, user, role);
    };
  };

  // Returns true if caller is the hardcoded owner OR in the AccessControl admin list
  public query ({ caller }) func isCallerAdmin() : async Bool {
    if (caller == ownerPrincipal) return true;
    AccessControl.isAdmin(accessControlState, caller);
  };
};
