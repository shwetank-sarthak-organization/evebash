import { getCachedBackblazeAuth } from '@/lib/backblaze';

type B2File = {
  fileName?: string;
  contentLength?: number;
  size?: number;
};

function corsHeaders() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

async function readBackblazeError(response: Response) {
  try {
    const payload = await response.json();
    return {
      code: payload?.code,
      message: payload?.message || payload?.error || `Backblaze API returned status ${response.status}`,
    };
  } catch {
    const text = await response.text().catch(() => '');
    return {
      code: undefined,
      message: text || `Backblaze API returned status ${response.status}`,
    };
  }
}

export async function GET() {
  const bucketId = process.env.B2_BUCKET_ID?.trim();
  const bucketName = process.env.B2_BUCKET_NAME?.trim() || 'EveBash';

  if (!bucketId) {
    return new Response(
      JSON.stringify({ error: 'B2_BUCKET_ID environment variable is not configured on the server.' }),
      { status: 500, headers: corsHeaders() }
    );
  }

  try {
    const auth = await getCachedBackblazeAuth();
    let startFileName: string | undefined;
    let totalBytes = 0;
    let fileCount = 0;

    do {
      const response = await fetch(`${auth.apiUrl}/b2api/v3/b2_list_file_names`, {
        method: 'POST',
        headers: {
          Authorization: auth.authorizationToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bucketId,
          maxFileCount: 10000,
          ...(startFileName ? { startFileName } : {}),
        }),
        cache: 'no-store',
      });

      if (!response.ok) {
        const backblazeError = await readBackblazeError(response);
        return new Response(
          JSON.stringify({
            error: backblazeError.message,
            code: backblazeError.code,
            bucketId,
            bucketName,
          }),
          { status: response.status, headers: corsHeaders() }
        );
      }

      const data = await response.json();
      const files: B2File[] = Array.isArray(data.files) ? data.files : [];

      for (const file of files) {
        totalBytes += Number(file.contentLength ?? file.size ?? 0) || 0;
        fileCount += 1;
      }

      startFileName = data.nextFileName || undefined;
    } while (startFileName);

    return new Response(
      JSON.stringify({
        bucketId,
        bucketName,
        fileCount,
        totalBytes,
        totalGb: totalBytes / (1024 * 1024 * 1024),
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: corsHeaders() }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        error: error?.message || 'Failed to fetch Backblaze bucket usage.',
        bucketId,
        bucketName,
      }),
      { status: 500, headers: corsHeaders() }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(),
  });
}
