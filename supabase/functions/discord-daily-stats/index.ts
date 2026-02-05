// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { SystemLogger } from "../_shared/systemLogger.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;

const LOG_PREFIX = "[DISCORD-DAILY-STATS]";

// Chart color palette (dark-theme friendly)
const COLORS = {
  imagesGenerated: { bg: "rgba(99, 102, 241, 0.8)", border: "rgb(99, 102, 241)" },   // indigo
  imagesEdited:    { bg: "rgba(244, 114, 182, 0.8)", border: "rgb(244, 114, 182)" },  // pink
  videosGenerated: { bg: "rgba(52, 211, 153, 0.8)", border: "rgb(52, 211, 153)" },    // emerald
};

interface DayBucket {
  date: string;
  images_generated: number;
  images_edited: number;
  videos_generated: number;
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const discordWebhookUrl = Deno.env.get("DISCORD_STATS_WEBHOOK_URL");

  if (!serviceKey || !supabaseUrl) {
    return new Response("Missing required environment variables", { status: 500 });
  }

  if (!discordWebhookUrl) {
    return new Response("DISCORD_STATS_WEBHOOK_URL not configured", { status: 500 });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);
  const logger = new SystemLogger(supabaseAdmin, "discord-daily-stats");

  // Authenticate: only service role allowed
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (token !== serviceKey) {
    logger.error("Unauthorized request");
    await logger.flush();
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    logger.info("Starting daily stats collection");

    // Query completed tasks grouped by day, categorized into 3 buckets
    const { data: dailyStats, error: statsError } = await supabaseAdmin.rpc(
      "func_daily_task_stats"
    );

    let buckets: DayBucket[];

    if (statsError || !dailyStats) {
      // Fallback: query directly if RPC doesn't exist
      logger.warn("RPC func_daily_task_stats not available, using direct query", {
        error: statsError?.message,
      });

      const { data: rawStats, error: rawError } = await supabaseAdmin
        .from("tasks")
        .select("created_at, task_type, task_types!inner(tool_type, content_type, category, name)")
        .eq("status", "Complete")
        .gte("created_at", "2026-02-09T00:00:00Z");

      if (rawError) throw rawError;

      // Aggregate in memory
      const dayMap = new Map<string, DayBucket>();
      for (const task of rawStats || []) {
        const date = task.created_at.substring(0, 10); // YYYY-MM-DD
        if (!dayMap.has(date)) {
          dayMap.set(date, { date, images_generated: 0, images_edited: 0, videos_generated: 0 });
        }
        const bucket = dayMap.get(date)!;
        const tt = task.task_types;

        if (tt.tool_type === "image-generation") {
          bucket.images_generated++;
        } else if (tt.content_type === "image" && tt.tool_type !== "image-generation") {
          bucket.images_edited++;
        } else if (
          tt.content_type === "video" &&
          (tt.category === "orchestration" ||
            ["animate_character", "individual_travel_segment", "video_enhance"].includes(tt.name))
        ) {
          bucket.videos_generated++;
        }
      }

      buckets = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    } else {
      buckets = dailyStats;
    }

    if (buckets.length === 0) {
      logger.info("No stats data found");
      await logger.flush();
      return new Response(JSON.stringify({ message: "No data" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Determine if we should aggregate by week (>90 days of data)
    const shouldAggregateWeekly = buckets.length > 90;
    const chartData = shouldAggregateWeekly ? aggregateByWeek(buckets) : buckets;

    // Calculate yesterday's stats
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayStr = yesterday.toISOString().substring(0, 10);
    const yesterdayStats = buckets.find((b) => b.date === yesterdayStr) || {
      date: yesterdayStr,
      images_generated: 0,
      images_edited: 0,
      videos_generated: 0,
    };

    // Calculate all-time totals
    const totals = buckets.reduce(
      (acc, b) => ({
        images_generated: acc.images_generated + b.images_generated,
        images_edited: acc.images_edited + b.images_edited,
        videos_generated: acc.videos_generated + b.videos_generated,
      }),
      { images_generated: 0, images_edited: 0, videos_generated: 0 }
    );

    // Generate chart via QuickChart.io
    const chartUrl = await generateChart(chartData, shouldAggregateWeekly);

    // Format date for title
    const titleDate = yesterday.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });

    // Post to Discord
    const embed = {
      title: `Daily Stats — ${titleDate}`,
      color: 0x6366f1, // indigo
      fields: [
        {
          name: "Images Generated",
          value: `**${yesterdayStats.images_generated.toLocaleString()}**`,
          inline: true,
        },
        {
          name: "Images Edited",
          value: `**${yesterdayStats.images_edited.toLocaleString()}**`,
          inline: true,
        },
        {
          name: "Videos Generated",
          value: `**${yesterdayStats.videos_generated.toLocaleString()}**`,
          inline: true,
        },
      ],
      image: chartUrl ? { url: chartUrl } : undefined,
      footer: {
        text: `Total (since Feb 9): ${totals.images_generated.toLocaleString()} images generated · ${totals.images_edited.toLocaleString()} images edited · ${totals.videos_generated.toLocaleString()} videos generated`,
      },
      timestamp: new Date().toISOString(),
    };

    const discordPayload = { embeds: [embed] };

    const discordRes = await fetch(discordWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(discordPayload),
    });

    if (!discordRes.ok) {
      const errText = await discordRes.text();
      throw new Error(`Discord webhook failed (${discordRes.status}): ${errText}`);
    }

    logger.info("Discord message sent successfully", {
      yesterday_images_gen: yesterdayStats.images_generated,
      yesterday_images_edit: yesterdayStats.images_edited,
      yesterday_videos: yesterdayStats.videos_generated,
      chart_url: chartUrl,
    });
    await logger.flush();

    return new Response(
      JSON.stringify({
        success: true,
        yesterday: yesterdayStats,
        totals,
        chart_url: chartUrl,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    logger.error("Failed to generate/send daily stats", { error: error.message });
    await logger.flush();
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
});

/**
 * Aggregate daily buckets into weekly buckets (Mon-Sun weeks)
 */
function aggregateByWeek(buckets: DayBucket[]): DayBucket[] {
  const weekMap = new Map<string, DayBucket>();

  for (const bucket of buckets) {
    const date = new Date(bucket.date + "T00:00:00Z");
    // Get Monday of this week
    const day = date.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day; // Monday = 1
    const monday = new Date(date);
    monday.setUTCDate(date.getUTCDate() + diff);
    const weekKey = monday.toISOString().substring(0, 10);

    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, { date: weekKey, images_generated: 0, images_edited: 0, videos_generated: 0 });
    }
    const week = weekMap.get(weekKey)!;
    week.images_generated += bucket.images_generated;
    week.images_edited += bucket.images_edited;
    week.videos_generated += bucket.videos_generated;
  }

  return Array.from(weekMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Generate a chart image URL via QuickChart.io
 */
async function generateChart(
  data: DayBucket[],
  isWeekly: boolean
): Promise<string | null> {
  const labels = data.map((d) => {
    const date = new Date(d.date + "T00:00:00Z");
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  });

  const chartConfig = {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Images Generated",
          data: data.map((d) => d.images_generated),
          backgroundColor: COLORS.imagesGenerated.bg,
          borderColor: COLORS.imagesGenerated.border,
          borderWidth: 1,
        },
        {
          label: "Images Edited",
          data: data.map((d) => d.images_edited),
          backgroundColor: COLORS.imagesEdited.bg,
          borderColor: COLORS.imagesEdited.border,
          borderWidth: 1,
        },
        {
          label: "Videos Generated",
          data: data.map((d) => d.videos_generated),
          backgroundColor: COLORS.videosGenerated.bg,
          borderColor: COLORS.videosGenerated.border,
          borderWidth: 1,
        },
      ],
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: isWeekly ? "Weekly Trend (since Feb 9)" : "Daily Trend (since Feb 9)",
          color: "#e2e8f0",
          font: { size: 14 },
        },
        legend: {
          labels: { color: "#e2e8f0" },
        },
      },
      scales: {
        x: {
          ticks: { color: "#94a3b8", maxRotation: 45 },
          grid: { color: "rgba(148, 163, 184, 0.1)" },
        },
        y: {
          ticks: { color: "#94a3b8" },
          grid: { color: "rgba(148, 163, 184, 0.1)" },
          beginAtZero: true,
        },
      },
    },
  };

  try {
    const res = await fetch("https://quickchart.io/chart/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        backgroundColor: "#1e1b2e",
        width: 800,
        height: 400,
        format: "png",
        chart: chartConfig,
      }),
    });

    if (!res.ok) {
      console.error(`${LOG_PREFIX} QuickChart error: ${res.status}`);
      return null;
    }

    const result = await res.json();
    return result.url || null;
  } catch (err) {
    console.error(`${LOG_PREFIX} QuickChart request failed:`, err);
    return null;
  }
}
