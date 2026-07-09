import { existsSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { call, endpoints } from "../client/endpoints.mjs";
import { die } from "../client/http.mjs";
import { arg } from "../cli/args.mjs";

export async function listAvatars(auth, args) {
  const limit = arg(args, "--limit") || "20";
  console.log(JSON.stringify(
    await call(auth, endpoints.avatarGroupPrivateList, { limit, page: 1 }), null, 2));
}

export async function listLooks(auth, args) {
  const g = arg(args, "--group"); if (!g) die("list-looks needs --group <group_id>");
  console.log(JSON.stringify(
    await call(auth, endpoints.avatarLookList, { group_id: g }), null, 2));
}

export async function createPhotoAvatar(auth, args) {
  const img = args.find((a) => !a.startsWith("--"));
  if (!img) die("create-photo-avatar needs <image-path> [--name N]");
  if (!existsSync(img)) die(`no such image: ${img}`);
  const name = arg(args, "--name") || `avatar ${new Date().toISOString().slice(0, 16).replace("T", " ")}`;

  const tc = await call(auth, endpoints.photoTempCreate);
  const tid = tc?.data?.temporary_user_photar_ids?.[0];
  const key = tc?.data?.keys?.[0];
  const url = tc?.data?.upload_urls?.[0];
  if (!tid || !url) die("temp.create failed: " + JSON.stringify(tc));

  const bytes = readFileSync(img);
  const ct = img.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
  const put = await fetch(url, {
    method: "PUT",
    headers: { "content-type": ct, "x-amz-server-side-encryption": "AES256" },
    body: bytes,
  });
  if (!put.ok) die(`S3 upload failed: HTTP ${put.status}\n${(await put.text()).slice(0, 300)}`);
  console.error(`✓ uploaded ${(bytes.length / 1e6).toFixed(1)}MB image`);

  try {
    await call(auth, endpoints.imageAttributesSubmit, {},
      { body: { image_url: `s3://heygen-product/${key}`, workflow_id: randomUUID() } });
  } catch {}
  await new Promise((r) => setTimeout(r, 2500));

  const cv = await call(auth, endpoints.photoTempConvert, { tid, name });
  const gid = cv?.data?.group_id;
  if (!gid) die("temp.convert failed: " + JSON.stringify(cv));

  const ll = await call(auth, endpoints.avatarLookList, { group_id: gid });
  const look = ll?.data?.avatar_looks?.[0]?.look || {};
  const lookId = look.look_id || gid;
  console.log(JSON.stringify({ name, group_id: gid, look_id: lookId, is_valid: look.is_valid }, null, 2));
  console.error(`\n✓ Avatar III photo avatar created.\n  look_id (avatar_id) = ${lookId}\n  → use: generate/studio-render --avatar ${lookId}`);
  return { look_id: lookId };
}
