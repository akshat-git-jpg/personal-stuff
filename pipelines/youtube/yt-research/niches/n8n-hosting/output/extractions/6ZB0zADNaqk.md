Source Video: 6ZB0zADNaqk

The transcript focuses almost exclusively on **Hostinger** as a self-hosting solution for n8n, directly comparing it to n8n Cloud. No other softwares from the provided list (Railway, Render, Oracle cloud, Digital Ocean, Hiroku, Netcup, Hetzner, Amazon AWS, Contabo, fly.io, coolify, Google Cloud, Raspberry Pi, Synology NAS docker) are discussed within the transcript.

## 1. Per-Software Facts

### Hostinger

*   **Features Discussed:**
    *   One-click n8n installation.
    *   Built for scalability and high performance.
    *   Automatic backups (daily automated backups available for an additional cost).
    *   AI VPS assistant named "Cody" for support.
    *   Specifically optimized and built to host n8n.
    *   Includes 100 free ready-to-use n8n workflows.
    *   Offers KVM VPS plans (KVM 1, 2, 4, 8) with configurable CPU cores, RAM, and storage.
    *   Ability to upgrade plans (scale up) as usage increases.
    *   Choice of server locations for best latency.
    *   Application options: regular n8n, n8n with 100 workflows, or n8n with Q mode.
    *   Free domain for a year with the 24-month plan [time-sensitive].
    *   Free malware scanner (optional).
    *   Dashboard for managing VPS, including options to reboot, update n8n, change the n8n domain, and reset the n8n user password.
    *   Extensive documentation and tutorials.
    *   Terminal access for running Docker commands (e.g., `docker compose pull`, `docker compose down`, `docker compose up` for updates).
    *   Docker manager to view and manage running containers (e.g., `root nitn`, `root traffic`).
    *   Monitoring metrics on the dashboard: CPU usage, memory usage, incoming/outgoing traffic, disk usage, bandwidth.
    *   Firewall configuration options.
    *   Hostname changing.
    *   Snapshots and backup scheduling.
    *   Ability to claim a free .cloud domain for the hostname or connect an existing domain.

*   **Pros Mentioned:**
    *   Cheaper, safer, and more powerful (in the context of n8n self-hosting).
    *   Very easy setup with the one-click installation, even for non-technical users.
    *   Scalable resources, allowing users to upgrade plans easily.
    *   Automatic backups provide peace of mind.
    *   AI assistant (Cody) helps with VPS health, connectivity, and general support.
    *   Platform is specifically optimized for n8n hosting.
    *   Offers a free domain for a year with longer-term plans [time-sensitive].
    *   Provides official support for its VPS service, unlike n8n itself for self-hosting.
    *   Full control over data, unlimited workflows and executions, and enhanced data privacy.
    *   No vendor lock-in, allowing migration of workflows to different VPS providers.

*   **Cons or Complaints Mentioned:**
    *   Maintenance of the n8n instance is on the user (or Hostinger as the VPS provider), not n8n Cloud.
    *   Does not include n8n Cloud-specific features like the AI workflow builder or the AI assistant for workflow creation [time-sensitive].
    *   Limited collaboration features compared to n8n Cloud; lacks direct project/member/role management within a single n8n instance (requires enterprise n8n self-hosted or spinning up separate instances).

*   **Specific Claims:**
    *   "Save up to four times your expenses compared to if you host it on Niden Cloud." [time-sensitive]
    *   A 24-month KVM2 plan costs $6 per month for the first two years. [time-sensitive]
    *   The n8n Cloud starter plan is approximately $25 per month. [time-sensitive]
    *   A Black Friday sale was ongoing at the time of filming. [time-sensitive]
    *   Updating n8n via Docker commands (pull, down, up) does not remove credentials or workflows, as it saves volume (memory).

*   **Unique Selling Points or Differentiators:**
    *   Explicitly built and optimized for n8n self-hosting with a custom UI.
    *   Features a one-click n8n installation process for ease of use.
    *   Includes an AI VPS assistant (Cody) for platform support.
    *   Offers 100 free ready-to-use n8n workflows.
    *   Provides extensive, n8n-specific documentation and tutorials within its platform.
    *   Offers direct support for troubleshooting n8n self-hosting issues on its platform.
    *   Provides special discount codes (e.g., "Nate Herk" for 10% off, and an even larger discount for community members) [time-sensitive].

*   **Pricing Mentions:**
    *   KVM plans (1, 2, 4, 8) with varying hardware specs (CPU cores, RAM, storage).
    *   KVM2 plan: $6/month for the first 2 years if chosen for 24 months. [time-sensitive]
    *   Yearly plans (12 or 24 months) are eligible for discount codes.
    *   Daily automated backups can be added for an additional $6/month. [time-sensitive]
    *   Coupon code "Nate Herk" offers an additional 10% off yearly plans. [time-sensitive]
    *   AI Automation Society Plus community members get an even larger discount. [time-sensitive]

## 2. Comparative Observations

*   **Hostinger / n8n Self-Hosting vs. n8n Cloud (General Comparisons):**
    *   **Cost:** Self-hosting (on Hostinger) is "much more cost-effective" and can "save up to four times your expenses" compared to n8n Cloud. Example: Hostinger KVM2 at $6/month (24-mo plan) vs. n8n Cloud starter at ~$25/month. [time-sensitive]
    *   **Ease of Setup/Maintenance:** n8n Cloud offers "super easy setup" and is a "managed service." Hostinger, with its one-click installation, makes self-hosting "a lot easier" but still implies "technical setup" and "maintenance is on you."
    *   **Control & Data:** Self-hosting (on Hostinger) provides "full control over everything," allowing data to be kept in one's own environment, ensuring "data privacy," and avoiding "vendor lock." n8n Cloud has "limited customization" and data privacy is listed as a potential con.
    *   **Workflow/Execution Limits:** Self-hosting (on Hostinger) allows "unlimited workflows and executions." n8n Cloud has "certain feature limits."
    *   **Feature Parity (n8n Specific):** n8n Cloud includes an "AI workflow builder" and an "AI assistant" (for building workflows) that are not available in self-hosted versions of n8n (including on Hostinger). [time-sensitive]
    *   **Collaboration:** n8n Cloud offers easier "collaboration and projects" with features like different projects, members, roles, and shared credentials. Self-hosted n8n (on Hostinger) has "limited collaboration" unless using an enterprise self-hosted n8n version or spinning up multiple instances for different environments.
    *   **Support:** With n8n Cloud, support is from n8n. For self-hosting on Hostinger, support is provided by Hostinger for the VPS, as n8n does not offer official support for self-hosted instances.
    *   **Vendor Lock:** Self-hosting on Hostinger allows users to move their workflows to a different VPS provider, indicating no vendor lock.

*   **Use-Case Recommendations:**
    *   **Beginners:** For a "complete beginner," the reviewer "would pretty much always recommend just starting on cloud to get a feel for everything" (referring to n8n Cloud).
    *   **Clients:** When working with clients, it is crucial not to charge for access to n8n (cloud or self-hosting). Clients should use their own billing information and own the accounts, with the service provider acting as an adviser/builder.

*   **Overall Conclusions/Final Recommendations:**
    *   Hostinger is presented as "the best and easiest way to self-host your NAND" (implying among self-hosting options, particularly for a beginner audience interested in self-hosting).
    *   The reviewer personally uses Hostinger for self-hosting n8n and believes in their approach.
