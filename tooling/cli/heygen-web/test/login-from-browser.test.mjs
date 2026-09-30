import test from "node:test";
import assert from "node:assert/strict";
import { pbkdf2Sync, createCipheriv, createHash } from "node:crypto";
import { decryptCookie, cookiesForApi } from "../src/workflows/login-from-browser.mjs";

function encrypt(plain, password, host, withHostHash) {
  const key = pbkdf2Sync(password, "saltysalt", 1003, 16, "sha1");
  const c = createCipheriv("aes-128-cbc", key, Buffer.alloc(16, " "));
  const body = withHostHash ? Buffer.concat([createHash("sha256").update(host).digest(), Buffer.from(plain)]) : Buffer.from(plain);
  return Buffer.concat([Buffer.from("v10"), c.update(body), c.final()]);
}

test("decrypts old and v24+ Chromium cookies", () => {
  assert.equal(decryptCookie(encrypt("abc", "pw", ".heygen.com", false), "pw", { host: ".heygen.com", dbVersion: 23 }), "abc");
  assert.equal(decryptCookie(encrypt("abc", "pw", ".heygen.com", true), "pw", { host: ".heygen.com", dbVersion: 24 }), "abc");
});

test("only cookies api2.heygen.com would receive", () => {
  const h = cookiesForApi([
    { host: ".heygen.com", name: "heygen_token", value: "t" },
    { host: "api2.heygen.com", name: "heygen_session", value: "s" },
    { host: "app.heygen.com", name: "hg_us", value: "x" },
  ]);
  assert.equal(h, "heygen_token=t; heygen_session=s");
});
