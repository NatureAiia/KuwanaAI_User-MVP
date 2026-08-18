#!/bin/bash
# Keeps the `kuwana` pm2 process alive on the cPanel box, where there is no
# root/systemd access for `pm2 startup`. Run on a schedule via cPanel Cron
# Jobs: /bin/bash -lc '/home/uat/kuwana/scripts/cpanel/pm2-watchdog.sh'
set -euo pipefail

APP_NAME="kuwana"
HEALTH_URL="http://127.0.0.1:3001/api/health"
DEPLOY_PATH="/home/uat/kuwana"
LOG_FILE="/home/uat/logs/pm2-watchdog.log"

mkdir -p "$(dirname "$LOG_FILE")"

log() {
  printf '%s [watchdog] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1" >> "$LOG_FILE"
}

pm2_app_status() {
  pm2 jlist | node -e "
    let raw = '';
    process.stdin.on('data', d => raw += d);
    process.stdin.on('end', () => {
      const proc = JSON.parse(raw || '[]').find(p => p.name === '$APP_NAME');
      console.log(proc ? proc.pm2_env.status : 'missing');
    });
  "
}

status=$(pm2_app_status)

if [ "$status" = "missing" ]; then
  log "$APP_NAME not registered with pm2, attempting resurrect"
  pm2 resurrect || true
  status=$(pm2_app_status)
fi

if [ "$status" != "online" ]; then
  log "$APP_NAME status=$status, restarting"
  pm2 restart "$APP_NAME" 2>>"$LOG_FILE" \
    || (pm2 start npx --name "$APP_NAME" --cwd "$DEPLOY_PATH" -- next start -p 3001 && pm2 save)
  exit 0
fi

if ! curl -fsS --max-time 5 "$HEALTH_URL" >/dev/null 2>&1; then
  log "liveness check failed ($HEALTH_URL), restarting $APP_NAME"
  pm2 restart "$APP_NAME"
fi
