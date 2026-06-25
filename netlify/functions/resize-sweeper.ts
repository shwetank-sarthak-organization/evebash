export default async (request: Request) => {
  const siteUrl = process.env.URL || "https://lens-and-frame-wedding-album.netlify.app";
  const cronSecret = process.env.CRON_SECRET;

  const headers: Record<string, string> = {};
  if (cronSecret) {
    headers["Authorization"] = `Bearer ${cronSecret}`;
  }

  const targetUrl = `${siteUrl}/api/media/retry-resizing`;
  console.log(`[Cron Sweeper] Triggering image resize repair at: ${targetUrl}`);

  try {
    const res = await fetch(targetUrl, {
      method: "GET",
      headers,
    });

    const text = await res.text();
    console.log(`[Cron Sweeper] Response status: ${res.status}, body: ${text}`);

    return new Response(JSON.stringify({ success: res.ok, status: res.status }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error: any) {
    console.error("[Cron Sweeper] Error triggering repair endpoint:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

export const config = {
  schedule: "*/10 * * * *", // Run every 10 minutes
};
