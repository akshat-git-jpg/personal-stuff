#!/usr/bin/env bash
# down.sh — stop the dev server cleanly (npm -> nodemon -> node tree).
source "$(dirname "$0")/common.sh"

KILLED=0
if [ -f "$PIDFILE" ]; then
	PID="$(cat "$PIDFILE")"
	if kill -0 "$PID" 2>/dev/null; then
		kill "$PID" 2>/dev/null || true
		KILLED=1
	fi
	rm -f "$PIDFILE"
fi
# nodemon/node children survive the npm parent; sweep by listener port and
# the unique inspector port from the dev script (--inspect=9333).
for port in "$SERVER_PORT" 9333; do
	PIDS="$(lsof -ti "tcp:$port" 2>/dev/null || true)"
	if [ -n "$PIDS" ]; then
		echo "$PIDS" | xargs kill 2>/dev/null || true
		KILLED=1
	fi
done
sleep 1
if lsof -ti "tcp:$SERVER_PORT" >/dev/null 2>&1; then
	warn "port $SERVER_PORT still occupied — force killing"
	lsof -ti "tcp:$SERVER_PORT" | xargs kill -9 2>/dev/null || true
fi
[ "$KILLED" -eq 1 ] && ok "server stopped" || ok "nothing was running"
