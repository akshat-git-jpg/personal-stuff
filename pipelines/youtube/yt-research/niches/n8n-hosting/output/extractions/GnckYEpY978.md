Source Video: GnckYEpY978

Here's the extracted information based on the provided transcript:

## 1. Per-Software Facts

### Render
*   **Cons/Complaints:**
    *   Free plans have a major catch: servers shut down from inactivity.
    *   Limited resources on free plans.
    *   Requires workarounds to keep automation online.
*   **Specific Claims:**
    *   Often just a "middleman."
    *   Built on top of Amazon Web Services.

### Amazon AWS
*   **Features Discussed:**
    *   **EC2 (Elastic Compute Cloud):** Described as a web service that provides resizable compute capacity in the cloud, acting as a virtual machine.
    *   Ubuntu OS for the virtual machine.
    *   Docker for deploying n8n.
    *   Key pairs for secure SSH connection to instances.
    *   Security groups for managing inbound rules (e.g., exposing port 5678 for n8n).
    *   SSH access via terminal or third-party software like Tabby.
*   **Pros Mentioned:**
    *   Offers free hosting and a free server for an entire year [time-sensitive].
    *   No sleeping servers on the free tier.
    *   No hidden limits.
    *   Allows direct access to the underlying infrastructure without a "middleman."
    *   Sufficient EC2 hours (750 hours/month) for 12 months to run applications 24/7.
*   **Cons or Complaints Mentioned:**
    *   None.
*   **Specific Claims:**
    *   EC2 offers 750 hours per month for 12 months with the Amazon Web Service free tier [time-sensitive].
    *   The setup shown resulted in $0 cost for EC2 usage [time-sensitive].
*   **Unique Selling Points/Differentiators:**
    *   Direct access to infrastructure (vs. middleman platforms).
    *   Reviewer works at Amazon AWS, implying an "expert way" of deployment.
*   **Pricing Mentions:**
    *   "750 hours per month for 12 months" for EC2 in the free tier [time-sensitive].
    *   Resulted in "$0 for the cost and usage" for EC2 after setup [time-sensitive].

## 2. Comparative Observations

*   **Render vs. Amazon AWS:**
    *   **Head-to-head verdict:** The reviewer argues that Render is a "middleman" with "more limitations." It's better to "go directly to the source" (AWS) rather than using a platform built on top of AWS with added restrictions.
    *   **Dimension-specific comparisons (free plans):**
        *   **Uptime:** Render's free plans shut down from inactivity, whereas AWS EC2 free tier offers 24/7 server uptime for 12 months.
        *   **Resources/Limits:** Render has limited resources and requires workarounds, while AWS EC2 offers sufficient resources (750 hours/month) without hidden limits for the free tier.
*   **Overall Conclusions/Final Recommendations:**
    *   The reviewer strongly recommends using Amazon AWS EC2 combined with Docker for self-hosting n8n.
    *   This method provides free hosting for a full year [time-sensitive], ensures continuous operation without servers sleeping, and has no hidden limits, offering a superior alternative to "middleman" platforms like Render.
    *   The video presents this as "the expert way" to deploy n8n.
