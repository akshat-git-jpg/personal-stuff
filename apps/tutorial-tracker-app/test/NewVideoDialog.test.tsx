// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { NewVideoDialog } from "../src/client/NewVideoDialog";
import { testable_setChannels } from "../src/client/api";

const DUMMY_PIPELINES = [{ id: "standard", name: "Standard", stages: [{ id: "topic", label: "Topic", role: "Admin" }] }];

describe("NewVideoDialog", () => {
  afterEach(() => {
    cleanup();
    testable_setChannels(null);
  });

  it("renders the channel picker when there are multiple channels", async () => {
    testable_setChannels({
      channels: [
        { id: "agrollo", name: "Agrollo", handle: "@agrollo", link_domain: "go.agrolloo.com" },
        { id: "second", name: "Second", handle: "@second", link_domain: "go.second.com" }
      ],
      default_channel_id: "agrollo",
    });

    render(<NewVideoDialog open={true} onOpenChange={() => {}} pipelines={DUMMY_PIPELINES} defaultPipeline="standard" names={{}} memberRoles={{}} memberships={{}} onCreated={() => {}} />);

    const label = await screen.findByText(/Channel/);
    expect(label).toBeTruthy();
  });

  it("does NOT render the channel picker when there is only one channel", async () => {
    testable_setChannels({
      channels: [
        { id: "agrollo", name: "Agrollo", handle: "@agrollo", link_domain: "go.agrolloo.com" },
      ],
      default_channel_id: "agrollo",
    });

    render(<NewVideoDialog open={true} onOpenChange={() => {}} pipelines={DUMMY_PIPELINES} defaultPipeline="standard" names={{}} memberRoles={{}} memberships={{}} onCreated={() => {}} />);

    // Wait for the dialog to render (we can wait for Pipeline or just use findByText for something else)
    await screen.findByText(/The video/);
    
    // Channel should not exist
    expect(screen.queryByText(/Channel/)).toBeNull();
  });
});
