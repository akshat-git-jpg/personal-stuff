import { describe, expect, it } from "vitest";
import { creditWarnings, normalizeTargetUrl } from "../src/worker/linkhealth";

const codes = (url: string, kind: "affiliate" | "external" = "affiliate") =>
  creditWarnings(url, kind).map((w) => w.code);

describe("creditWarnings — the false-positive floor", () => {
  // Every URL below is a REAL earning link taken from the live catalogue on
  // 2026-08-28, and every one of them was reported as "no affiliate code found"
  // before this suite existed. Nine of the ten alarms in the Health tab's
  // "Costing you money now" group were these. The owner asked for a count of
  // things needing attention, and a count is only worth reading if the alarms
  // are real — so these are pinned individually rather than as a loop over a
  // list, so a regression names the programme it broke.
  it("credits an Impact branded short link", () =>
    expect(codes("https://go.expressvpn.com/OryBzA")).toEqual([]));

  it("credits a referral subdomain with a numeric code", () =>
    expect(codes("https://get.brevo.com/538136cj7gdc")).toEqual([]));

  it("credits a try. subdomain", () =>
    expect(codes("https://try.elevenlabs.io/mltn1n40l34s")).toEqual([]));

  it("credits a hyphenated referral subdomain", () =>
    expect(codes("https://free-trial.adcreative.ai/0mz8lbt0byeo")).toEqual([]));

  it("credits a referral. subdomain", () =>
    expect(codes("https://referral.magnific.com/mQMwrjE")).toEqual([]));

  it("credits PartnerStack get. links", () => {
    expect(codes("https://get.junglescout.com/qvmkrtnc684b")).toEqual([]);
    expect(codes("https://get.murf.ai/aztd3d3n5sba")).toEqual([]);
  });

  it("credits a vendor affiliate path prefix", () =>
    expect(codes("https://www.mailerlite.com/a/mqjayzbdlssd")).toEqual([]));

  it("credits the owner's own handle in a vanity path", () =>
    expect(codes("https://vidiq.com/agrollo")).toEqual([]));

  // The mirror. Widening the rules must not silence the one alarm that was
  // right: a bare partner landing page carries no code and credits nobody.
  it("still flags a bare partners landing page", () =>
    expect(codes("https://partners.emergent.sh/")).toContain("no_credit_marker"));

  it("still flags a plain homepage", () => {
    expect(codes("https://www.hostinger.com/")).toContain("no_credit_marker");
    expect(codes("https://lumen5.com/")).toContain("no_credit_marker");
    expect(codes("https://www.d-id.com/")).toContain("no_credit_marker");
  });

  // A referral subdomain is not a licence on its own — it needs the code too,
  // otherwise `partners.emergent.sh/` above would pass.
  it("does not credit a referral subdomain whose path is an ordinary page", () =>
    expect(codes("https://go.example.com/pricing")).toContain("no_credit_marker"));

  // Guards the dot exclusion in looksLikeGeneratedCode: an affiliate dashboard
  // must keep reading as a dashboard, not as a code that happens to live on one.
  it("still calls out our own affiliate dashboard", () =>
    expect(codes("https://affiliate.bookbolt.io/account.php")).toContain("points_at_dashboard"));

  it("still flags the agrolloo hop wherever it appears", () =>
    expect(codes("https://agrolloo.com/filmora")).toContain("own_redirect_layer"));

  // The exemption that must survive every widening: an external tool has no
  // programme, so a bare homepage is the RIGHT destination for it.
  it("never asks an external tool for a code", () => {
    expect(codes("https://cursor.com", "external")).toEqual([]);
    expect(codes("https://bolt.new", "external")).toEqual([]);
    expect(codes("https://replit.com", "external")).toEqual([]);
  });
});

describe("normalizeTargetUrl", () => {
  it("repairs a scheme-less host and says so", () => {
    const got = normalizeTargetUrl("openart.ai/home/?via=seema");
    expect(got?.url).toBe("https://openart.ai/home/?via=seema");
    expect(got?.repaired).toBe(true);
  });

  it("rejects prose, a bare word, and a non-web scheme", () => {
    expect(normalizeTargetUrl("ask me for the link")).toBeNull();
    expect(normalizeTargetUrl("localhost")).toBeNull();
    expect(normalizeTargetUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeTargetUrl("")).toBeNull();
  });
});

describe("looksLikeGeneratedCode boundary", () => {
  // The over-credit this suite caught during development: an ordinary page name
  // on a referral subdomain is not an affiliate code.
  it("rejects lowercase page names on a referral subdomain", () => {
    for (const page of ["pricing", "about", "features", "signup", "contact"]) {
      expect(codes(`https://go.example.com/${page}`)).toContain("no_credit_marker");
    }
  });

  it("accepts a code with a digit or mixed case", () => {
    expect(codes("https://go.example.com/abc123")).toEqual([]);
    expect(codes("https://go.example.com/aBcDeF")).toEqual([]);
  });
});
