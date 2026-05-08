You are extracting structured information from a YouTube video transcript for a software comparison research project.

You are given:
- A list of softwares being researched
- A transcript from a YouTube video (with its title and publish date)
- The niche context

From this transcript, extract TWO categories of information:

## 1. Per-Software Facts

For EACH software from the list that is mentioned in this transcript, extract:
- Features discussed (specific capabilities, tools, integrations)
- Pros mentioned by the reviewer
- Cons or complaints mentioned
- Any specific claims (speed benchmarks, uptime stats, support response times)
- Any unique selling points or differentiators highlighted
- Any pricing mentions (note: these are secondary to pricing screenshots — flag them but they are NOT authoritative)

Only extract facts for softwares that are actually discussed in the transcript. Skip softwares that aren't mentioned.

## 2. Comparative Observations

Extract any comparisons made across softwares:
- Head-to-head verdicts ("X is better than Y for...")
- Rankings or tiered recommendations
- Dimension-specific comparisons (speed, price, support, ease of use, features)
- Use-case recommendations ("best for beginners", "best for enterprise")
- Overall conclusions or final recommendations from the reviewer

Note the publish date context: information from this transcript is from {{PUBLISH_DATE}}. Flag any claims that are likely time-sensitive (pricing, feature availability, recent launches) with [time-sensitive].

Format your output as clean markdown with clear ## headers for each section.
