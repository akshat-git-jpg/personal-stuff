# amul-watch

Self-hosted Amul stock notifier that alerts via Telegram when protein products come back in stock.

## API Flow
The application fetches stock data using a 6-step flow against the StoreHippo Amul frontend:
1. Initialize session with a GET request to seed cookies.
2. Fetch the session info JSON to extract the `tid` hash.
3. Map the given pincode to the correct regional substore using the `tid`.
4. Bind the session to that substore's inventory.
5. Retrieve the current storefront API version from `storeinfo.js`.
6. Query the products API using the resolved `tid`, version, and literal brackets in the URL query string.

## Setup
1. Copy the configuration template:
   `cp config.example.json config.json`
2. Edit `config.json` to include your target `pincode` and track SKUs.
3. Ensure `infra/secrets` contains the telegram environment config, as it is required by the underlying `notify` CLI tool.

## Manual Run
To perform a single read-only manual run:
```bash
python3 watch.py --once --dry-run --pincode <YOUR_PINCODE>
```

## VPS Cron Wiring
The script is designed for a Pattern-B VPS cron orchestration, running once every five minutes. Add this exact line to the crontab:
```
*/5 * * * * /srv/projects/personal-stuff/apps/amul-watch/run.sh >> /var/log/amul-watch.log 2>&1
```

**Rate Limiting**: Do not lower the cron poll interval below 5 minutes. The script employs a random pre-poll jitter to spread out load.
