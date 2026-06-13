# docker

Compose files for the containers that run on the Hostinger VPS. Each subfolder is one compose project. The VPS copies these under `/docker/<name>` and brings them up there; this folder is the source of truth for the config.

- `ntfy/` — self-hosted push-notification server. Runs public on `:8888` without TLS by design — the threat model is "the topic name is the secret," which keeps payloads off the public ntfy.sh. See `ntfy/README.md`.

For the full container inventory (traefik, n8n, minio, personal-dashboard, and the rest), see `../INFRA.md`.
