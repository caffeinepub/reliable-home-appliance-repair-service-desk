import AccessControl "./access-control";
import Prim "mo:prim";
import Runtime "mo:core/Runtime";
import Principal "mo:core/Principal";

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
    if (caller == ownerPrincipal) { return #admin };
    AccessControl.getUserRole(accessControlState, caller);
  };

  public shared ({ caller }) func assignCallerUserRole(user : Principal, role : AccessControl.UserRole) : async () {
    // Owner can always assign roles; AccessControl admins can also assign roles
    if (caller == ownerPrincipal) {
      accessControlState.userRoles.add(user, role);
      return;
    };
    AccessControl.assignRole(accessControlState, caller, user, role);
  };

  public query ({ caller }) func isCallerAdmin() : async Bool {
    if (caller == ownerPrincipal) { return true };
    AccessControl.isAdmin(accessControlState, caller);
  };
};
