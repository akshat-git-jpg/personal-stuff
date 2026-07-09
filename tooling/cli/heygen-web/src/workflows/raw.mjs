import { arg } from "../cli/args.mjs";
import { api } from "../client/http.mjs";

export async function raw(auth, path, args) {
  const j = arg(args, "--json");
  console.log(JSON.stringify(
    await api(auth, path, j ? { method: "POST", body: JSON.parse(j) } : {}), null, 2));
}
