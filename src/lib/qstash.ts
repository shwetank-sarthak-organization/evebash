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

export async function publishModalMediaTask(photos: PhotoPayload[]): Promise<boolean> {
  const qstashToken = process.env.QSTASH_TOKEN;
  if (!qstashToken) {
    console.warn("[QStash] QSTASH_TOKEN is not configured. Background media processing will not run.");
    return false;
  }

  // The new Modal.com serverless endpoint
  const targetUrl = "https://shwetank-sarthak--wedding-media-engine-process-media-batch.modal.run";

  console.log(`[QStash] Publishing batch media task for ${photos.length} photos to Modal`);

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
      body: JSON.stringify({ photos }),
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
