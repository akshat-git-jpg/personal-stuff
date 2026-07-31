# Access Reviews — MongoDB Collection Relationships

```mermaid
---
title: Access Reviews — MongoDB Collection Relationships
---
graph TD

    subgraph "Blueprint (Template)"
        blueprints["<b>accesscertificationblueprints</b><br/><i>_id, org_id, created_by_id, owner_id, stage</i>"]
        bp_entitysets["<b>accesscertificationblueprintentitysets</b><br/><i>_id, blueprint_id, org_id, entity_type, subject_entity_type</i>"]
        bp_entities["<b>accesscertificationblueprintentities</b><br/><i>_id, blueprint_id, blueprint_entity_set_id, entity_id, entity_type, entity_class</i>"]

        blueprints -->|"1:N blueprint_id"| bp_entitysets
        bp_entitysets -->|"1:N blueprint_entity_set_id"| bp_entities
        blueprints -->|"1:N blueprint_id"| bp_entities
    end

    subgraph "Draft (Creation Flow)"
        drafts["<b>accesscertificationdraftsv2</b><br/><i>_id, blueprint_id, org_id, last_edited_by_id, stage</i>"]
        autosaves["<b>accesscertificationdraftsautosaves</b><br/><i>_id, key (embeds org_id + session), data (snapshot)</i>"]

        blueprints -->|"1:N blueprint_id"| drafts
    end

    subgraph "Certification (Live Review)"
        certs["<b>accesscertifications2</b><br/><i>_id, blueprint_id, draft_id, org_id, created_by_id, owner_id, certification_stage</i>"]
        entitysets["<b>accesscertificationentitysets</b><br/><i>_id, certification_id, blueprint_entity_set_id, org_id, entity_type, subject_entity_type</i>"]
        entities["<b>accesscertificationentities</b><br/><i>_id, certification_id, certification_entity_set_id, blueprint_entity_id, entity_id, entity_type, entity_class</i>"]
        subjects["<b>accesscertificationsubjects</b><br/><i>_id, certification_id, certification_entity_id, certification_entity_set_id, entity_id, subject_id, reviewer_id, review_status, signoff_level</i>"]

        certs -->|"1:N certification_id"| entitysets
        entitysets -->|"1:N certification_entity_set_id"| entities
        certs -->|"1:N certification_id"| entities
        entities -->|"1:N certification_entity_id"| subjects
        entitysets -->|"1:N certification_entity_set_id"| subjects
        certs -->|"1:N certification_id"| subjects
    end

    subgraph "Supporting Collections"
        configs["<b>accesscertificationobjectconfigs</b><br/><i>_id, access_certification_id, blueprint_id, draft_id, org_id, type, target_id (polymorphic)</i>"]
        jobs["<b>accesscertificationbackgroundjobs</b><br/><i>_id, access_certification_id, certification_entity_id, certification_entity_set_id, entity_id, job_type, status</i>"]
        insights["<b>accesscertificationsubjectinsights</b><br/><i>_id, access_certification_subject_id, certification_id, certification_entity_id, entity_id, subject_id, insight_key</i>"]
        metadata["<b>accesscertificationentitymetadatas</b><br/><i>_id, certification_entity_id, entity_id, certification_id, org_id, type</i>"]
    end

    %% Creation flow
    drafts -->|"1:1 draft_id"| certs
    blueprints -->|"1:N blueprint_id"| certs

    %% Lineage links
    bp_entitysets -.->|"cloned → blueprint_entity_set_id"| entitysets
    bp_entities -.->|"cloned → blueprint_entity_id"| entities

    %% Object Configs (polymorphic target_id)
    certs -->|"1:N access_certification_id"| configs
    blueprints -->|"1:N blueprint_id"| configs
    drafts -->|"1:N draft_id"| configs

    %% Background Jobs
    certs -->|"1:N access_certification_id"| jobs
    entities -->|"1:N certification_entity_id"| jobs

    %% Subject Insights
    subjects -->|"1:N access_certification_subject_id"| insights
    certs -->|"1:N certification_id"| insights

    %% Entity Metadata
    entities -->|"1:N certification_entity_id"| metadata
    certs -->|"1:N certification_id"| metadata
```

## Relationship Summary

| From → To | FK field | Cardinality |
|---|---|---|
| `accesscertificationblueprints` → `accesscertificationblueprintentitysets` | `blueprint_id` | 1:N |
| `accesscertificationblueprintentitysets` → `accesscertificationblueprintentities` | `blueprint_entity_set_id` | 1:N |
| `accesscertificationblueprints` → `accesscertificationdraftsv2` | `blueprint_id` | 1:N |
| `accesscertificationblueprints` → `accesscertifications2` | `blueprint_id` | 1:N |
| `accesscertificationdraftsv2` → `accesscertifications2` | `draft_id` | 1:1 |
| `accesscertifications2` → `accesscertificationentitysets` | `certification_id` | 1:N |
| `accesscertificationentitysets` → `accesscertificationentities` | `certification_entity_set_id` | 1:N |
| `accesscertificationentities` → `accesscertificationsubjects` | `certification_entity_id` | 1:N |
| `accesscertificationsubjects` → `accesscertificationsubjectinsights` | `access_certification_subject_id` | 1:N |
| `accesscertificationentities` → `accesscertificationentitymetadatas` | `certification_entity_id` | 1:N |
| `accesscertifications2` → `accesscertificationbackgroundjobs` | `access_certification_id` | 1:N |
| `accesscertifications2` → `accesscertificationobjectconfigs` | `access_certification_id` | 1:N |
| `accesscertificationblueprintentitysets` ⇢ `accesscertificationentitysets` | `blueprint_entity_set_id` (lineage) | 1:N |
| `accesscertificationblueprintentities` ⇢ `accesscertificationentities` | `blueprint_entity_id` (lineage) | 1:N |

> `accesscertificationdraftsautosaves` is a TTL key-value store with no direct FK references — the `key` string embeds org_id and a session UUID.

> `accesscertificationobjectconfigs.target_id` is polymorphic — the `type` field determines which collection `target_id` points to (entity_set, entity, blueprint_entity, etc.).
