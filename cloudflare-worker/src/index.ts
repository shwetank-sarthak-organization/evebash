import { AwsClient } from 'aws4fetch';

interface Env {
  B2_KEY_ID?: string;          // Injected via wrangler secrets
  B2_APPLICATION_KEY?: string;  // Injected via wrangler secrets
  B2_BUCKET_NAME: string;
  B2_ENDPOINT: string;
  B2_REGION: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const cache = caches.default;

    // Check Cloudflare cache first
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    const bucketName = env.B2_BUCKET_NAME || 'EveBash';
    const b2Endpoint = env.B2_ENDPOINT || 's3.ca-east-006.backblazeb2.com';
    const b2Region = env.B2_REGION || 'ca-east-006';

    const cleanPath = url.pathname.replace(/^\/+/, '');
    const b2Url = `https://${bucketName}.${b2Endpoint}/${cleanPath}`;

    const headers = new Headers(request.headers);
    headers.delete('host');
    headers.delete('cookie');

    const fetchOptions: RequestInit = {
      method: 'GET',
      headers: headers,
    };

    let response: Response;

    // Sign B2 S3 API request if credentials are set
    if (env.B2_KEY_ID && env.B2_APPLICATION_KEY) {
      const aws = new AwsClient({
        accessKeyId: env.B2_KEY_ID,
        secretAccessKey: env.B2_APPLICATION_KEY,
        region: b2Region,
        service: 's3',
      });

      const signedRequest = await aws.sign(new Request(b2Url, fetchOptions));
      response = await fetch(signedRequest);
    } else {
      response = await fetch(b2Url, fetchOptions);
    }

    const newHeaders = new Headers(response.headers);
    newHeaders.set('Access-Control-Allow-Origin', '*');
    newHeaders.set('Cache-Control', 'public, max-age=31536000, immutable');
    
    const finalResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });

    if (response.ok) {
      ctx.waitUntil(cache.put(request, finalResponse.clone()));
    }

    return finalResponse;
  }
};
