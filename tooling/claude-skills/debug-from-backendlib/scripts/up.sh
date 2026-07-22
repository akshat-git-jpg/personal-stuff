#!/usr/bin/env bash
# up.sh — boot the dashboard-api dev server in the background with BL_DEBUG on.
# Waits for the health route; prints the last server log lines on failure.
source "$(dirname "$0")/common.sh"

if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
	warn "server already running (pid $(cat "$PIDFILE")) — use down.sh first for a clean restart"
	exit 1
fi
if lsof -ti "tcp:$SERVER_PORT" >/dev/null 2>&1; then
	bad "port $SERVER_PORT already in use by another process: $(lsof -ti "tcp:$SERVER_PORT" | tr '\n' ' ')"
	exit 1
fi

: > "$SERVER_LOG"
touch "$LOGFILE"
cd "$DASH"
BL_DEBUG=1 BL_DEBUG_LOG="$LOGFILE" nohup npm run dev >"$SERVER_LOG" 2>&1 &
echo $! > "$PIDFILE"
echo "booting (pid $(cat "$PIDFILE")) — logs: $SERVER_LOG"

# ts-node cold compile is slow; be generous. Healthy = ready line in the log
# AND the port answers HTTP (any status code — a 404 proves express is up;
# there is no unauthenticated health route in local config).
DEADLINE=$((SECONDS + 300))
while [ $SECONDS -lt $DEADLINE ]; do
	if grep -q "$READY_LINE" "$SERVER_LOG" 2>/dev/null \
		&& curl -s -o /dev/null --max-time 3 "http://localhost:$SERVER_PORT/"; then
		ok "server healthy on :$SERVER_PORT (BL_DEBUG=1, [bl] log: $LOGFILE)"
		exit 0
	fi
	if ! kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
		bad "server process died during boot — last 40 log lines:"
		tail -40 "$SERVER_LOG"
		rm -f "$PIDFILE"
		exit 1
	fi
	sleep 3
done
bad "server did not become healthy within 300s — last 40 log lines:"
tail -40 "$SERVER_LOG"
exit 1
