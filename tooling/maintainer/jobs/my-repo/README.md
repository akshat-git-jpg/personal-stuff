# my-repo

This job checks whether the live repo map at `my-repo.agrolloo.com` is older than the repo.
It reads the public `/api/version` (the commit the map was built from), then lists the mapped
files that changed since. It never redeploys; the `my-repo` skill does that.

```bash
bash tooling/maintainer/bin/run-job.sh my-repo
```
