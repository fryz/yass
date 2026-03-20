import { Auth0Client } from "@auth0/nextjs-auth0/server";

export const auth0 = new Auth0Client({
  async beforeSessionSaved(session) {
    // Return session unchanged to preserve all ID token claims, including
    // custom namespaced claims (e.g. https://yass.app/roles) that the SDK
    // would otherwise strip via filterDefaultIdTokenClaims.
    return session;
  },
});
