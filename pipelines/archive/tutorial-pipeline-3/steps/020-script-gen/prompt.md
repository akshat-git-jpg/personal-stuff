# Script generation prompt (fill placeholders, paste into a Claude session)

Read these files completely before writing anything:

1. pipelines/youtube/tutorial-pipeline-3/steps/020-script-gen/rulebook.md
2. pipelines/youtube/tutorial-pipeline-3/PIPELINE.md (the script.json contract)
3. videos/{{SLUG}}/inputs/topic.md
4. videos/{{SLUG}}/inputs/vision.md
5. every file under videos/{{SLUG}}/inputs/transcripts/
6. {{DOSSIER_PATH}}            <!-- e.g. pipelines/youtube/dossiers/tools/notion.md, or "none" -->
7. {{STYLE_DNA_PATH}}          <!-- the channel's style pack, or "none" -->

Then write videos/{{SLUG}}/script.json and videos/{{SLUG}}/script.md following
the rulebook exactly. Target length: {{TARGET_MINUTES}} minutes of narration.

Finish by running:

    node pipelines/youtube/tutorial-pipeline-3/lib/lint-script.mjs videos/{{SLUG}}/script.json

Fix every ERROR. Then report: section count, demo/non-demo split, flag count,
and any vision.md points you deliberately dropped.
