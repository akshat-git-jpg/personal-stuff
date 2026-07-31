# Access Reviews (Access Certification) — Module HLD

## Overview

**Access Review/Certification Business Use case**
- Access reviews are a critical component of an organization's identity governance and compliance efforts. These reviews ensure that users retain only the necessary access to applications and systems, in accordance with the principle of least privilege and internal security policies. Zluri's Access Reviews module provides InfoSec and IT teams with a centralized platform to configure, execute, and monitor access certifications across the SaaS ecosystem.
- Users can review access of different subjects (Users, Accounts, Identities, Applicaitons, Groups) in their organization against different Entities (Applications, Groups, Users etc). Access Reviews ,Access Certifications and Campaigns terms mean the same thing and are used interchangably. Access Review is always working on point in time data.
**EntitySets**
- EntitySets are logical grouping within an access Certification. Each entity set has a entity_type and a subject_entity_type and all the configurations for how to review these types (like what entities to review, what subjects to review within those entities, who are the reviewers and how to remediate unwanted access). There can be multiple entitysets of same type in a single access certificate defining different configurations.
**Entities**
- Defines the first (top) level entity. This is used to narrow down the review to a specific search set. Examples: I want to review access to all Restricted applications OR I want to review Access of All Users with account_type as external. Entities are stored in 3 types, DYNAMIC (defines how to create 1 or many entities dynamically using a set of entity_filters), STATIC (single entity with all its configurations) and OVERRIDES (specific configurations for entities generated dynamically). Configurations can be at an entity level or an entity can use configurations from defaults specified at EntitySet level.
**Subjects**
- Defines the second (low) level entity. Whether this subject should have access to the given entity (selected above). Example: Each user having access to the Restricted applications (selected in entities) OR Each Group the external user (selected in entities) has accesss to OR Each Application with Paid license that an external user (selected in entities) is excessing. Subjects are dynamically created at run time (on start_date of a given access certificate). And these are the entities that are in review.
**Configurations**
- Users can configure metadata like, start_date, end_date, owner, recurrence settings and self review configurations (if a reviewer is the subject how to handle it whether to allow or reassign)
- Per Entity configurations include: Remediations, Reviewers (multiple level of reviews can be configured), Subject filters and Columns - Each of these can be configured on entity level or as defaults on entityset level.
**Reviews and signoffs**
- Once an Access Certication starts, subjects will be assigned to reviewers based on configurations, each reviewer has to login to the system and review the subjects assigned to him. He can take 3 actions approve (no remediation, access is correct), modify (run remediation to change access level using playbooks (workflows) ), revoke (run remediation to remove using playbooks (workflows))
remediation.
- Once user has completed his set of reviews he needs to signoff the review. Once all the reviewers at a given level signoff their review for an entity, the entity moves to next level of review.
- Admins can track progress by each reviewer separately and can also force Signoff if reviewer has completed reviews but not signed off.
**Remediations**
- Once all entities of an access certification are signed off from all reviewers, The certification is ready for remediation. When an Admin concludes this review, remediation playbooks will be created for each revoked and modified access. The progress of these playbooks is managed by external workflow system, but progress can be monitored from the certification.
**Reports**
- Admins can create a PDF report with all the details of an access certification. This includes details of all entities and all subjects along with remediation details and per level review details.
**insights**
- Zluri shows custom insights based on entity_type and subject_entity_type, for each entity of an access certification. System also shows recommended actions. Examples: How many Dormant accounts are part of review or How many external users are part of the Group under review. These are calculated at certificate creation time and it is a static data post creation.
**Blueprints**
- Blueprints are templates for access certifications. Each recurring certificate links to the same Blueprint and any changes made to a blueprint will result in all future recurring certifications getting changed.
- Blueprints are also used for Drafts, since Drafts have a similar concept as partially configured templates.
**Drafts and AutoSave**
- Drafts are partially created certifications so that admins can stop configurations midway and come back to it later.
- AutoSave is an internal Draft which keeps a checkpoint of configuration while an Admin is making configuration change on UI. This is an ephimeral storage and is destroyed if a session is closed.


### MongoDB Collections
- `accesscertifications2` — Main Certification Data - Stores metadata regarding each access certification that is created (defined in backend-libs)
- `accesscertificationentitysets` — Defines the type of entity and subject entity that is reviewed based on other configs, stores default configs  (defined in backend-libs)
- `accesscertificationentities` — Defines individual entities to be reviewed in this entity set along with their configs  (defined in backend-libs)
- `accesscertificationblueprints` — Acts as a template for certification creations and drafts, stores metadata required to create a certification (defined in backend-libs)
- `accesscertificationblueprintentitysets` — Same as entitysets but for blueprint (defined in backend-libs)
- `accesscertificationblueprintentities` — Stores config to dynamically create entities. Also stores per entity configs and overrides (defined in backend-libs)
- `accesscertificationobjectconfigs` — Stores configuration styles, and some common configurations for different type of targets like access_certification, entity, blueprint, bleuprint_entity, entity_set, blueprint_entity_set (defined in backend-libs)
- `accesscertificationdraftsv2` — Stores the record of draft certificates so that user can leave certification creation midway (defined in backend-libs)
- `accesscertificationdraftsautosaves` — temporary Session storage (internal) to empower certification creation at scale (defined in dashboard-api)
- `accesscertificationbackgroundjobs` — Tracks different type background processes like subject creation, entity creation, conclude review etc (defined in backend-libs)
- `accesscertificationsubjects` — Store the lowest granularity (second level) of entities that are reviewed. (defined in backend-libs)
- `accesscertificationsubjectinsights` — Stores insights for subjects 1 record per (subject + insight_key) (defined in backend-libs)
- `accesscertificationentitymetadatas` — Store metadata of entities in review like what roles an entity had when review was performed. (defined in backend-libs)

## Relevant Repositories

| Repository | Responsibility | Repo-level docs |
|---|---|---|
| `dashboard-api` | API layer — controllers, routes, DAL executors, and service logic for access certifications | `postgres/zluri-docs/docs/accessreviews.md` |
| `bull-scheduler` | Async job orchestration — scheduling and running background jobs like subject creation, notifications, recurring certs, and conclude review | `zluri-docs/docs/accessreviews.md` |
| `backend-libs` | Shared models, schemas, DAL helpers, and subject creation logic used by all other repos | `zluri-docs/docs/accessreviews.md` |
| `backend-scripts` | One-off and scheduled scripts — subject creation, entity creation, insights calculation, metadata population, state updates | `zluri-docs/docs/accessreviews.md` |
| `Integration-queue-consumer` | Event-driven consumer — processes async access review events from the queue | `zluri-docs/docs/accessreviews.md` |
