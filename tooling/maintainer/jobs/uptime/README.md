# uptime

This job checks whether the deployment inventories agree. It can also probe the public
sites and run every app's checks, but both expensive checks are off by default.

Run the inventory-only check:

```bash
bash tooling/maintainer/bin/run-job.sh uptime
```

Set `UPTIME_PROBE=1` to make real network requests. Set `UPTIME_APPS=1` to install
dependencies and run each app's test suite. The job reports drift; it never edits either
inventory.
