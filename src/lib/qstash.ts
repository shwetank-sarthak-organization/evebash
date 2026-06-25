/**
 * Upstash QStash helper utility
 * Uses simple fetch to publish tasks to QStash without adding external dependencies.
 */

interface QStashPublishOptions {
  storageKey: string;
}

export async function publishResizeTask(options: QStashPublishOptions): Promise<boolean> {
  const qstashToken = process.env.QSTASH_TOKEN;
  if (!qstashToken) {
    console.warn("[QStash] QSTASH_TOKEN is not configured. Background resizing will run synchronously or fall back to sweeper.");
    return false;
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || `https://${process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'lens-and-frame-wedding-album.netlify.app'}`;
  const targetUrl = `${siteUrl}/api/media/resize-worker`;

  console.log(`[QStash] Publishing resize task for ${options.storageKey} to target: ${targetUrl}`);

  try {
    const headers: Record<string, string> = {
      "Authorization": `Bearer ${qstashToken}`,
      "Content-Type": "application/json",
    };

    // Forward the CRON_SECRET for security if configured
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      headers["Upstash-Forward-Authorization"] = `Bearer ${cronSecret}`;
    }

    const response = await fetch(`https://qstash-us-east-1.upstash.io/v2/publish/${encodeURIComponent(targetUrl)}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ storageKey: options.storageKey }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`QStash publish failed with status ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log(`[QStash] Successfully published task. Message ID: ${result.messageId}`);
    return true;
  } catch (error) {
    console.error("[QStash] Error publishing resize task:", error);
    return false;
  }
}
