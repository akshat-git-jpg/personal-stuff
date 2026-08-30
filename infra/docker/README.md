# docker

Compose files for the containers that run on the Hostinger VPS. Each subfolder is one compose project. The VPS copies these under `/docker/<name>` and brings them up there; this folder is the source of truth for the config.


For the full container inventory (traefik, n8n, minio, personal-dashboard, and the rest), see `../../INFRA.md`.
