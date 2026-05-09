Source Video: tHbboSWjOnw

The following information is extracted from the provided YouTube transcript:

## 1. Per-Software Facts

### Google Cloud
*   **Features discussed:**
    *   **Compute Engine:** Provides virtual machine instances (VMs).
    *   **E2 micro instance:** A low-cost computing VM, specifically the E2 micro type is available in the free tier.
    *   **Storage:** 30 GB of memory storage for Compute Engine.
    *   **Regions:** Free E2 micro VMs available in Oregon, Iowa, and South Carolina.
    *   **SSH access:** Command-line access to the VM instance.
    *   **VPC Firewall rules:** For controlling network access (e.g., global access for specific ports).
    *   **Static IP address:** Allows a permanent IP address for the server, essential for domain pointing.
    *   **Engine X:** Used as a reverse proxy to point HTTP traffic to n8n's port.
    *   **Certbot:** Tool for setting up and managing HTTPS/SSL certificates.
    *   **Docker:** Used for containerizing and running n8n (requires manual installation on the VM).
    *   **Docker Compose:** Used to run Docker containers in the background and ensure they restart with the system.
    *   **Logging and monitoring:** Available but incur additional costs, can be disabled.
    *   **Snapshots:** Available for backups but incur additional costs, can be disabled.
*   **Pros mentioned by the reviewer:**
    *   Allows running n8n for free 24/7 without paying a single dollar.
    *   Offers an "always free" tier for specific resources.
    *   Provides $300 in free credits for new consumers [time-sensitive].
    *   Possible to configure to avoid costs by disabling features like snapshots and observability.
    *   Static IP address is "pretty much free for us to use" for the standard one.
    *   Reviewer personally used it for about 2 months without incurring any costs for the free tier.
    *   "Perfectly free and it's simple for you to use" for testing out n8n.
    *   "Enough to get you started into the rabbit hole of AI and automation."
*   **Cons or complaints mentioned:**
    *   Requires setting up a billing account and adding a payment method (to prove not a bot), even for free tier.
    *   Default storage is 10GB; needs to be manually changed to 30GB to utilize the full free tier allowance.
    *   Snapshots and observability (logging/monitoring) incur additional costs and must be disabled to stay within the free tier.
    *   n8n requires HTTPS, which necessitates additional complex setup steps (Engine X, Certbot, domain configuration, static IP).
    *   The E2 micro instance (free tier) only gets 2 GB of RAM, causing the service to "lag a little bit."
    *   The free tier instance is "not quite enough" for the reviewer's personal needs, as it requires "a lot of computing power."
*   **Specific claims:**
    *   Offers one E2 micro VM instance per month, always free.
    *   Provides 30 GB of storage for Compute Engine, always free.
    *   E2 micro instance has 2 GB of RAM.
    *   Reviewer uses it for ~2 months without cost.
*   **Unique selling points or differentiators highlighted:**
    *   Ability to host a full n8n server "for absolutely free, always free" by leveraging the specific free tier offerings and careful configuration.
*   **Pricing mentions (non-authoritative):**
    *   $300 in free credits for consumers [time-sensitive].
    *   "Always free" tier includes one E2 micro instance and 30GB storage.
    *   Snapshots cost money.
    *   Observability (logging and monitoring) costs money.
    *   Upgrading to a more powerful instance requires payment.
    *   Standard static IP address is "pretty much free."

### Docker (as a tool used on Google Cloud)
*   **Features discussed:**
    *   Containerization for n8n.
    *   Running n8n using an image from docker.io.
    *   Used in conjunction with Docker Compose for background operation and persistence.
*   **Pros mentioned by the reviewer:**
    *   Allows running n8n instance "without installing everything one by one."
    *   Docker Compose ensures n8n runs even after system restarts.
*   **Cons or complaints mentioned:**
    *   "Docker command not found" – not pre-installed on the default E2 micro instance, requires manual installation.
*   **Specific claims:**
    *   None specific to Docker itself.
*   **Unique selling points or differentiators highlighted:**
    *   Simplifies deployment and management of n8n within the server environment.
*   **Pricing mentions (non-authoritative):**
    *   None mentioned; Docker is implicitly used as a free/open-source tool here.

## 2. Comparative Observations

*   **Dimension-specific comparisons:**
    *   **Google Cloud Free Tier vs. Local Laptop Hosting:** Google Cloud allows n8n to run 24/7 on a server, unlike hosting on one's own laptop which would require the laptop to be constantly on, which the reviewer states "is not good."
*   **Use-case recommendations:**
    *   **Google Cloud Free Tier:** Recommended for users who "just want to test out and end" or "to get you started into the rabbit hole of AI and automation."
    *   **Google Cloud Paid Tiers:** Recommended if you "want a more powerful instance" or require "a lot of computing power," as the free tier's 2GB RAM can lead to lagging.
*   **Overall conclusions or final recommendations:**
    *   The video strongly recommends Google Cloud's free tier as a viable and cost-free solution for self-hosting an n8n server, particularly for testing, learning, or small-scale automation. It concludes that with careful configuration, it's possible to run n8n on Google Cloud "for absolutely free, always free."

No other specific softwares from the provided list (Railway, Render, Oracle cloud, Hostinger, Digital Ocean, Hiroku, Netcup, Hetzner, Amazon AWS, Contabo, fly.io, coolify, Raspberry Pi, Synology NAS docker) were mentioned or compared in this specific transcript.
