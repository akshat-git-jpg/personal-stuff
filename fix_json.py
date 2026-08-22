import json

with open('pipelines/video/visuals-flow/steps/115-author-intro-simple-llm/step.json', 'r') as f:
    lines = f.read().splitlines()

for i, line in enumerate(lines):
    if '"summary":' in line:
        lines[i] = '  "summary": "`transcript.json` + `segments.json` + `concept.json` + `../card-library/catalog.json` → `intro-simple/cutlist.json`. Runs only when `run-config.json` has `introMode: \\"simple\\"`. Picks a card slug per beat from the shared body catalogue and fills its variables — it never writes HTML. Approved at 125, rendered at 135.",'

with open('pipelines/video/visuals-flow/steps/115-author-intro-simple-llm/step.json', 'w') as f:
    f.write('\n'.join(lines) + '\n')
