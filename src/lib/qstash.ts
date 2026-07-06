/**
 * Upstash QStash helper utility
 * Uses simple fetch to publish tasks to QStash without adding external dependencies.
 */

interface QStashPublishOptions {
  storageKey: string;
  origin?: string;
}

export async function publishResizeTask(options: QStashPublishOptions): Promise<boolean> {
  const qstashToken = process.env.QSTASH_TOKEN;
  if (!qstashToken) {
    console.warn("[QStash] QSTASH_TOKEN is not configured. Background resizing will run synchronously or fall back to sweeper.");
    return false;
  }

  // Determine the target URL. Priority:
  // 1. Explicitly provided origin (e.g. from request headers)
  // 2. NEXT_PUBLIC_SITE_URL (manually configured, most reliable)
  // 3. RAILWAY_STATIC_URL (automatically injected by Railway)
  const railwayUrl = process.env.RAILWAY_STATIC_URL ? `https://${process.env.RAILWAY_STATIC_URL}` : null;
  
  // Local/private origins cannot be accessed by QStash, so fall back to NEXT_PUBLIC_SITE_URL (e.g. ngrok tunnel)
  const isLocalOrigin = options.origin && (
    options.origin.includes('localhost') || 
    options.origin.includes('127.0.0.1') || 
    options.origin.includes('192.168.') || 
    options.origin.startsWith('http://10.')
  );
  
  const siteUrl = (!options.origin || isLocalOrigin)
    ? (process.env.NEXT_PUBLIC_SITE_URL || railwayUrl || `https://${process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000'}`)
    : options.origin;
    
  const targetUrl = `${siteUrl}/api/media/resize-worker`;

  console.log(`[QStash] Publishing resize task for ${options.storageKey} to target: ${targetUrl}`);

  try {
    const headers: Record<string, string> = {
      "Authorization": `Bearer ${qstashToken}`,
      "Content-Type": "application/json",
    };

    const response = await fetch(`https://qstash-us-east-1.upstash.io/v2/publish/${targetUrl}`, {
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
