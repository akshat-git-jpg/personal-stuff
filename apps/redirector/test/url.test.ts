import { describe, expect, it } from "vitest";
import { normalizeTarget } from "../src/url";

describe("normalizeTarget", () => {
  it("passes a well-formed https URL through untouched", () => {
    const r = normalizeTarget("https://openart.ai/home/?via=seema");
    expect(r).toEqual({ url: "https://openart.ai/home/?via=seema", repaired: false });
  });

  // The 2026-08-28 production incident: 5 openart slugs + 1 shopify slug held a
  // scheme-less value, and Response.redirect() threw -> Error 1101.
  it("repairs the scheme-less value that caused the 1101 incident", () => {
    const r = normalizeTarget("openart.ai/home/?via=seema");
    expect(r).toEqual({ url: "https://openart.ai/home/?via=seema", repaired: true });
  });

  it("repairs a scheme-less affiliate-network link and keeps its path", () => {
    const r = normalizeTarget("shopify.pxf.io/da7EVW");
    expect(r).toEqual({ url: "https://shopify.pxf.io/da7EVW", repaired: true });
  });

  it("marks repaired=true so the caller can still report the bad stored value", () => {
    expect(normalizeTarget("teachable.sjv.io/GmQ5OL")?.repaired).toBe(true);
    expect(normalizeTarget("https://teachable.sjv.io/GmQ5OL")?.repaired).toBe(false);
  });

  it("preserves the query string that carries the affiliate credit", () => {
    const r = normalizeTarget("example.com/x?via=agrollo&ref=abc");
    expect(r?.url).toContain("via=agrollo");
    expect(r?.url).toContain("ref=abc");
  });

  it("trims surrounding whitespace pasted out of a spreadsheet", () => {
    expect(normalizeTarget("  https://alidropship.com/?via=21184  ")?.url).toBe(
      "https://alidropship.com/?via=21184",
    );
  });

  it("strips invisible characters that survive a sheet copy", () => {
    expect(normalizeTarget("​https://example.com/a﻿")?.url).toBe("https://example.com/a");
  });

  // The clickfunnels row holds prose, not a link. It must 404, never redirect.
  it("rejects prose typed into the link column", () => {
    expect(normalizeTarget('have multile campaign to choose named as "\r\nManage Affiliate Codes"')).toBeNull();
  });

  it("rejects empty and missing values", () => {
    expect(normalizeTarget("")).toBeNull();
    expect(normalizeTarget("   ")).toBeNull();
    expect(normalizeTarget(null)).toBeNull();
    expect(normalizeTarget(undefined)).toBeNull();
  });

  it("rejects a hostname with no dot", () => {
    expect(normalizeTarget("localhost")).toBeNull();
    expect(normalizeTarget("https://localhost")).toBeNull();
  });

  it("rejects non-http schemes so we never emit javascript: or data:", () => {
    expect(normalizeTarget("javascript:alert(1)")).toBeNull();
    expect(normalizeTarget("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(normalizeTarget("ftp://example.com/x")).toBeNull();
  });

  it("accepts an existing http:// link without silently upgrading it", () => {
    const r = normalizeTarget("http://openart.ai/home/?via=seema");
    expect(r).toEqual({ url: "http://openart.ai/home/?via=seema", repaired: false });
  });
});
