/**
 * Upstash QStash helper utility
 * Uses simple fetch to publish tasks to QStash without adding external dependencies.
 */

interface PhotoPayload {
  id: string;
  storage_key: string;
  event_id: string;
  url: string;
  width: number | null;
  height: number | null;
}

interface QStashPublishOptions {
  storageKey: string;
  origin?: string;
}

export async function publishModalBatchTask(previewUrls: string[]): Promise<boolean> {
  const qstashToken = process.env.QSTASH_TOKEN;
  if (!qstashToken) {
    console.warn("[QStash] QSTASH_TOKEN is not configured. Background media processing will not run.");
    return false;
  }

  // The new Modal.com serverless endpoint
  const targetUrl = "https://shwetank-sarthak--wedding-media-engine-process-media-batch.modal.run";

  console.log(`[QStash] Publishing batch media task for ${previewUrls.length} photos to Modal`);

  try {
    const headers: Record<string, string> = {
      "Authorization": `Bearer ${qstashToken}`,
      "Content-Type": "application/json",
      // Adding a large timeout header to QStash since Modal might take 1-2 minutes for a massive batch
      "Upstash-Timeout": "120s"
    };

    const response = await fetch(`https://qstash-us-east-1.upstash.io/v2/publish/${targetUrl}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ urls: previewUrls }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`QStash publish failed with status ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log(`[QStash] Successfully published task to Modal. Message ID: ${result.messageId}`);
    return true;
  } catch (error) {
    console.error("[QStash] Error publishing Modal media task:", error);
    return false;
  }
}

export async function publishResizeTask(options: QStashPublishOptions): Promise<boolean> {
  const qstashToken = process.env.QSTASH_TOKEN;
  if (!qstashToken) {
    console.warn("[QStash] QSTASH_TOKEN is not configured. Background resizing will run synchronously or fall back to sweeper.");
    return false;
  }

  const railwayUrl = process.env.RAILWAY_STATIC_URL ? `https://${process.env.RAILWAY_STATIC_URL}` : null;
  const isLocalOrigin = options.origin && (
    options.origin.includes('localhost') || 
    options.origin.includes('127.0.0.1') || 
    options.origin.includes('192.168.') || 
    options.origin.startsWith('http://10.')
  );
  
  const siteUrl = (!options.origin || isLocalOrigin)
    ? (process.env.NEXT_PUBLIC_SITE_URL || railwayUrl || `https://${process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000'}`)
    : options.origin;
    
  const targetUrl = `${siteUrl}/api/media/process-thumbnail`;

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
    console.log(`[QStash] Successfully published resize task. Message ID: ${result.messageId}`);
    return true;
  } catch (error) {
    console.error("[QStash] Error publishing resize task:", error);
    return false;
  }
}

