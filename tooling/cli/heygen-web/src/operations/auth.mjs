import { call, endpoints } from "../client/endpoints.mjs";

export async function authCheck(auth) {
  const r = await call(auth, endpoints.avatarGroupPrivateList, { limit: 1, page: 1 });
  console.log("✓ auth OK — session is live.");
  console.log(JSON.stringify(r, null, 2).slice(0, 800));
}
