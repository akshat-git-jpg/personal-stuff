#!/usr/bin/env bash
# preflight.sh — kill the fragility before booting the local server.
# Checks: gh account, dev PG, Mongo Atlas (IP-block classified), AWS SSO
# (report-only), node_modules/@zluri/backend-libs state.
# Exit 0 = safe to boot. Exit 1 = something fatal (message says what).
source "$(dirname "$0")/common.sh"
FATAL=0

echo "== preflight: gh account =="
GH_USER="$(gh api user --jq .login 2>/dev/null || true)"
if [ "$GH_USER" = "kushal-zluri" ]; then
	ok "gh active account: kushal-zluri"
elif [ -n "$GH_USER" ]; then
	warn "gh active account is '$GH_USER' — switching to kushal-zluri"
	if gh auth switch -u kushal-zluri >/dev/null 2>&1; then
		ok "switched to kushal-zluri"
	else
		bad "could not switch gh account (gh auth switch -u kushal-zluri failed)"
		FATAL=1
	fi
else
	warn "gh not authenticated or offline — remote git ops will fail (non-fatal for local debugging)"
fi

echo "== preflight: dev PostgreSQL =="
# Resolve the EFFECTIVE host:port the same way the app does (via its dotenv),
# so duplicate/legacy POSTGRES_DB_* sections in .env don't produce false alarms.
PG_PAIR="$(node -e "require('$DASH/node_modules/dotenv').config({path:'$DASH/.env'});console.log((process.env.POSTGRES_DB_HOST||'')+':'+(process.env.POSTGRES_DB_PORT||''))" 2>/dev/null || true)"
if [ -z "${PG_PAIR%%:*}" ] || [ -z "${PG_PAIR##*:}" ]; then
	bad "could not resolve POSTGRES_DB_HOST/PORT from $DASH/.env"
	FATAL=1
else
	host="${PG_PAIR%%:*}"; port="${PG_PAIR##*:}"
	if nc -z -G 5 "$host" "$port" >/dev/null 2>&1; then
		ok "PG reachable: $PG_PAIR"
	else
		bad "PG unreachable: $PG_PAIR (VPN down? tunnel not up?)"
		FATAL=1
	fi
fi

echo "== preflight: Mongo Atlas =="
MONGO_CHECK="$SCRATCH/mongo-check.js"
cat > "$MONGO_CHECK" <<'JSEOF'
// Reachability probe using the app's own env + mongoose, mirroring src/boot/mongo.ts.
const path = process.argv[2];
require(path + '/node_modules/dotenv').config({ path: path + '/.env' });
const mongoose = require(path + '/node_modules/mongoose');
const uri =
	`mongodb+srv://${process.env.DATABASE_USERNAME}:${process.env.DATABASE_PASSWORD}` +
	`@${process.env.DATABASE_HOST}/${process.env.DATABASE_NAME}` +
	`?retryWrites=true&w=majority&appName=bl-preflight`;
mongoose
	.connect(uri, { serverSelectionTimeoutMS: 15000, connectTimeoutMS: 15000 })
	.then(async () => {
		await mongoose.connection.db.admin().ping();
		console.log('MONGO_OK');
		process.exit(0);
	})
	.catch((err) => {
		const msg = String(err && err.message);
		// Non-allowlisted IPs surface as server-selection timeouts (TLS handshake
		// dropped by Atlas), while bad creds say "Authentication failed".
		if (/Server selection timed out|getaddrinfo|ETIMEDOUT|ENOTFOUND/i.test(msg)) {
			console.log('MONGO_IPBLOCK_SUSPECT: ' + msg.slice(0, 200));
		} else {
			console.log('MONGO_ERR: ' + msg.slice(0, 200));
		}
		process.exit(1);
	});
JSEOF
# Atlas rejects intermittently; retry once before believing a failure.
MONGO_RESULT="$(cd "$DASH" && node "$MONGO_CHECK" "$DASH" 2>/dev/null || true)"
case "$MONGO_RESULT" in
	MONGO_OK*) : ;;
	*)
		sleep 3
		MONGO_RESULT="$(cd "$DASH" && node "$MONGO_CHECK" "$DASH" 2>/dev/null || true)"
		;;
esac
case "$MONGO_RESULT" in
	MONGO_OK*)
		ok "Mongo Atlas reachable (main db)"
		;;
	MONGO_IPBLOCK_SUSPECT*)
		PUB_IP="$(curl -4 -s --max-time 5 ifconfig.me || echo '<unknown>')"
		bad "Mongo unreachable — looks like an Atlas IP allowlist block (current public IP: $PUB_IP)"
		if command -v atlas >/dev/null 2>&1; then
			warn "attempting auto-allowlist via atlas CLI..."
			if atlas accessLists create --currentIp --comment "bl-debug $(date +%F)" >/dev/null 2>&1; then
				ok "IP added to Atlas access list — re-run preflight in ~1 min"
			else
				bad "atlas CLI present but the call failed (not authed for this project?) — allowlist $PUB_IP manually in the Atlas UI"
			fi
		else
			bad "fix manually: allowlist $PUB_IP in Atlas UI (or 'brew install mongodb-atlas-cli' + 'atlas auth login' once to make this self-healing)"
		fi
		FATAL=1
		;;
	*)
		bad "Mongo check failed: ${MONGO_RESULT:-no output} (server boot WILL exit(1) on mongo error)"
		FATAL=1
		;;
esac

echo "== preflight: AWS SSO / CodeArtifact (report-only) =="
if aws sts get-caller-identity >/dev/null 2>&1; then
	ok "AWS SSO valid (npm i / co:login will work)"
else
	warn "AWS SSO expired — fine for debugging, but 'npm i' / lib-sync pop will need: aws sso login && npm run co:login"
fi

echo "== preflight: node_modules state ($PKG) =="
PIN="$(python3 -c "import json;print(json.load(open('$DASH/package.json'))['dependencies']['$PKG'])")"
INSTALLED="$(python3 -c "import json;print(json.load(open('$DASH/node_modules/$PKG/package.json'))['version'])" 2>/dev/null || echo '<not installed>')"
echo "  package.json pin: $PIN | installed: $INSTALLED"
if [ -f "$DASH/yalc.lock" ]; then
	warn "yalc link ACTIVE (yalc.lock present) — installed build is a local backend-libs build, not the registry package"
fi
BAKS="$(ls -d "$DASH/node_modules/@zluri/"*.bak* 2>/dev/null || true)"
if [ -n "$BAKS" ]; then
	warn "hand-swap residue found: $BAKS — clean this up (lib-sync.sh/yalc replaces hand-swapping)"
fi
if [ "$PIN" != "$INSTALLED" ] && [ ! -f "$DASH/yalc.lock" ]; then
	warn "installed version differs from pin with no yalc link — node_modules was hand-modified; run a real 'npm i' when SSO is back"
fi
if [ -f "$MANIFEST" ] && [ -s "$MANIFEST" ]; then
	warn "instrumentation manifest is non-empty from a previous session — run instrument.sh list / revert"
fi

echo
if [ "$FATAL" -eq 0 ]; then
	echo "preflight PASSED — safe to boot (up.sh)"
else
	echo "preflight FAILED — fix the FAIL lines above before booting"
fi
exit "$FATAL"
