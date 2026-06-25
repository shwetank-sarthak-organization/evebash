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

    let imagePath = url.pathname;
    let resizeOptions: any = null;

    // Parse /cdn-cgi/image/ prefix if present
    const cdnCgiPrefix = '/cdn-cgi/image/';
    if (url.pathname.startsWith(cdnCgiPrefix)) {
      const rest = url.pathname.slice(cdnCgiPrefix.length);
      const firstSlashIdx = rest.indexOf('/');
      if (firstSlashIdx !== -1) {
        const optionsStr = rest.slice(0, firstSlashIdx);
        imagePath = '/' + rest.slice(firstSlashIdx + 1);

        resizeOptions = {};
        const optionsParts = optionsStr.split(',');
        for (const part of optionsParts) {
          const [key, val] = part.split('=');
          if (key === 'width') resizeOptions.width = parseInt(val, 10);
          if (key === 'height') resizeOptions.height = parseInt(val, 10);
          if (key === 'quality') resizeOptions.quality = parseInt(val, 10);
          if (key === 'format') resizeOptions.format = val;
          if (key === 'fit') resizeOptions.fit = val;
        }
      }
    }

    const cleanPath = imagePath.replace(/^\/+/, '');
    const b2Url = `https://${bucketName}.${b2Endpoint}/${cleanPath}`;

    const headers = new Headers(request.headers);
    headers.delete('host');
    headers.delete('cookie');

    const fetchOptions: RequestInit & { cf?: any } = {
      method: 'GET',
      headers: headers,
    };

    if (resizeOptions) {
      fetchOptions.cf = {
        image: {
          ...resizeOptions,
          fit: resizeOptions.fit || 'cover',
        }
      };
    }

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

      // Fail-Safe: If the thumbnail or preview file does not exist yet (returns 404),
      // fall back to fetching and serving the original file.
      if (response.status === 404 && (cleanPath.endsWith('-thumbnail.webp') || cleanPath.endsWith('-preview.webp'))) {
        const originalPath = cleanPath.replace(/-thumbnail\.webp$/, '').replace(/-preview\.webp$/, '');
        const originalB2Url = `https://${bucketName}.${b2Endpoint}/${originalPath}`;
        const signedOriginalRequest = await aws.sign(new Request(originalB2Url, { method: 'GET' }));
        response = await fetch(signedOriginalRequest);
      }
    } else {
      response = await fetch(b2Url, fetchOptions);

      // Fail-Safe: If the thumbnail or preview file does not exist yet (returns 404),
      // fall back to fetching and serving the original file.
      if (response.status === 404 && (cleanPath.endsWith('-thumbnail.webp') || cleanPath.endsWith('-preview.webp'))) {
        const originalPath = cleanPath.replace(/-thumbnail\.webp$/, '').replace(/-preview\.webp$/, '');
        const originalB2Url = `https://${bucketName}.${b2Endpoint}/${originalPath}`;
        response = await fetch(originalB2Url);
      }
    }

    // Fallback to original image if resizing is not enabled on this Cloudflare plan
    if (resizeOptions && (response.status === 400 || response.status === 403 || response.status === 9524)) {
      console.warn('Cloudflare Image Resizing failed or not enabled. Falling back to original.');
      if (env.B2_KEY_ID && env.B2_APPLICATION_KEY) {
        const aws = new AwsClient({
          accessKeyId: env.B2_KEY_ID,
          secretAccessKey: env.B2_APPLICATION_KEY,
          region: b2Region,
          service: 's3',
        });
        const signedRequest = await aws.sign(new Request(b2Url, { method: 'GET' }));
        response = await fetch(signedRequest);
      } else {
        response = await fetch(b2Url);
      }
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
