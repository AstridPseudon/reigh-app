-- Schedule daily Discord stats report at 9 AM UTC
-- Posts task completion stats (images generated, images edited, videos generated) to Discord

-- Create RPC for daily task stats (avoids pulling all tasks into the edge function)
CREATE OR REPLACE FUNCTION public.func_daily_task_stats()
RETURNS TABLE (
  date text,
  images_generated bigint,
  images_edited bigint,
  videos_generated bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    to_char(t.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
    COUNT(*) FILTER (
      WHERE tt.tool_type = 'image-generation'
    ) AS images_generated,
    COUNT(*) FILTER (
      WHERE tt.content_type = 'image' AND tt.tool_type != 'image-generation'
    ) AS images_edited,
    COUNT(*) FILTER (
      WHERE tt.content_type = 'video'
        AND (tt.category = 'orchestration'
             OR tt.name IN ('animate_character', 'individual_travel_segment', 'video_enhance'))
    ) AS videos_generated
  FROM tasks t
  JOIN task_types tt ON tt.name = t.task_type
  WHERE t.status = 'Complete'
    AND t.created_at >= '2026-02-09T00:00:00Z'::timestamptz
  GROUP BY 1
  ORDER BY 1;
$$;

-- Schedule cron job (requires pg_cron and pg_net extensions)
SELECT cron.schedule(
  'discord_daily_stats',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/discord-daily-stats',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Verify
SELECT 'discord_daily_stats cron job scheduled' AS status;
