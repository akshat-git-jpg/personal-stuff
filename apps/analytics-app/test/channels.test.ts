import { describe, expect, it } from "vitest";
import registry from "../../../config/channels.json";
import { DEFAULT_CHANNEL_ID, getChannel, linkDomainFor, listChannels, uploadsPlaylistFor } from "../src/worker/channels";

describe("channel resolution", () => {
  it("the default channel is listed", () => {
    expect(listChannels().map((c) => c.id)).toContain(DEFAULT_CHANNEL_ID);
  });

  it("throws on an unknown channel id", () => {
    expect(() => getChannel("does-not-exist")).toThrow(/CHANNEL_UNKNOWN/);
  });

  it("resolves each channel's own link domain", () => {
    for (const c of registry.channels) {
      expect(linkDomainFor(c.id)).toBe(c.link_domain);
    }
  });

  // GATE. uploadsPlaylistFor must READ the registry. A hardcoded playlist would show
  // one channel's uploads under every channel's name, with no error anywhere.
  //
  // Asserting only against the shipped file would be VACUOUS while one channel is
  // seeded: the hardcoded value IS agrollo's playlist. So the gate resolves a
  // SYNTHETIC channel that is not in the file and cannot be guessed.
  it("derives each channel's uploads playlist from its own YouTube id", () => {
    for (const c of registry.channels) {
      const expected = "UU" + c.youtube_channel_id.slice(2);
      expect(
        uploadsPlaylistFor(c.id),
        `CHANNEL_PLAYLIST_NOT_RESOLVED: uploadsPlaylistFor(${c.id}) must be ${expected}`,
      ).toBe(expected);
    }

    const probe = { ...registry.channels[0], id: "__probe__", youtube_channel_id: "UCzzzzzzzzzzzzzzzzzzzzzz" };
    const synthetic = [...registry.channels, probe];
    expect(
      uploadsPlaylistFor("__probe__", synthetic),
      "CHANNEL_PLAYLIST_NOT_RESOLVED: uploadsPlaylistFor must read the channel it is given, not a constant",
    ).toBe("UUzzzzzzzzzzzzzzzzzzzzzz");
    expect(
      uploadsPlaylistFor(registry.channels[0].id, synthetic),
      "CHANNEL_PLAYLIST_NOT_RESOLVED: resolution must stay per-channel",
    ).toBe("UU" + registry.channels[0].youtube_channel_id.slice(2));
  });
});
