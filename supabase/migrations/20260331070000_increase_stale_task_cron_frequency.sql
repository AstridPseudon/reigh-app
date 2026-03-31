-- Increase auto_fail_stale_tasks frequency from hourly to every 5 minutes.
-- The cascade RPC handles most failure propagation immediately, but edge cases
-- (broken dependency refs, workers dying without clean heartbeat) can leave
-- orphaned tasks sitting in Queued for up to an hour. 5 minutes is a better
-- balance between catching stragglers and avoiding unnecessary DB load.

SELECT cron.unschedule('auto-fail-stale-tasks');

SELECT cron.schedule(
  'auto-fail-stale-tasks',
  '*/5 * * * *',
  $$SELECT auto_fail_stale_tasks();$$
);
