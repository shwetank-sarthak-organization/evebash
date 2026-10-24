let authCache = null;

const ONE_HOUR = 60 * 60 * 1000;
const BROWSER_CACHE_CONTROL = "public, max-age=31536000, immutable";
const EDGE_CACHE_CONTROL = "public, max-age=2592000";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Accept, Content-Type",
  };
}

function sanitizePath(pathname) {
  return pathname.replace(/^\/+/, "").replace(/\/+/g, "/");
}

async function getBackblazeAuth(env) {
  if (authCache && Date.now() < authCache.expiresAt) {
    return authCache;
  }

  const credentials = btoa(env.B2_KEY_ID + ":" + env.B2_APPLICATION_KEY);
  const response = await fetch("https://api.backblazeb2.com/b2api/v3/b2_authorize_account", {
    headers: {
      Authorization: "Basic " + credentials,
    },
  });

  if (!response.ok) {
    throw new Error("Backblaze authorization failed: " + response.status);
  }

  const data = await response.json();
  authCache = {
    authorizationToken: data.authorizationToken,
    downloadUrl: data.apiInfo.storageApi.downloadUrl,
    expiresAt: Date.now() + ONE_HOUR,
  };

  return authCache;
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders() });
    }

    const url = new URL(request.url);
    const cleanPath = sanitizePath(url.pathname);

    if (!cleanPath) {
      return new Response("Missing file path", { status: 404, headers: corsHeaders() });
    }

    // Edge cache: plain GETs only. Range requests (video seeking) and HEAD go to B2 as before.
    const useCache = env.MEDIA_EDGE_CACHE === "on" && request.method === "GET" && !request.headers.has("Range");
    const cacheKey = new Request(url.toString(), { method: "GET" });
    if (useCache) {
      const cached = await caches.default.match(cacheKey);
      if (cached) {
        const headers = new Headers(cached.headers);
        headers.set("Cache-Control", BROWSER_CACHE_CONTROL);
        headers.set("X-Media-Cache", "HIT");
        return new Response(cached.body, { status: cached.status, statusText: cached.statusText, headers });
      }
    }

    try {
      const auth = await getBackblazeAuth(env);
      const encodedPath = cleanPath.split("/").map(encodeURIComponent).join("/");
      const bucketName = encodeURIComponent(env.B2_BUCKET_NAME);
      const targetUrl = auth.downloadUrl + "/file/" + bucketName + "/" + encodedPath + url.search;

      const originResponse = await fetch(targetUrl, {
        method: request.method,
        headers: {
          Authorization: auth.authorizationToken,
          Accept: request.headers.get("Accept") || "*/*",
        },
      });

      const headers = new Headers(originResponse.headers);
      for (const [key, value] of Object.entries(corsHeaders())) {
        headers.set(key, value);
      }

      if (originResponse.ok) {
        headers.set("Cache-Control", BROWSER_CACHE_CONTROL);
      } else {
        headers.set("Cache-Control", "no-store");
      }

      const response = new Response(originResponse.body, {
        status: originResponse.status,
        statusText: originResponse.statusText,
        headers,
      });

      // Only whole files (200) are kept. The edge copy lives 30 days, not a year: previews and thumbnails are
      // rewritten at the same path when a photo is reprocessed. Files over the cache size limit just aren't kept.
      if (useCache && originResponse.status === 200) {
        response.headers.set("X-Media-Cache", "MISS");
        const edgeCopy = response.clone();
        const edgeHeaders = new Headers(edgeCopy.headers);
        edgeHeaders.set("Cache-Control", EDGE_CACHE_CONTROL);
        edgeHeaders.delete("X-Media-Cache");
        ctx.waitUntil(
          caches.default
            .put(cacheKey, new Response(edgeCopy.body, { status: 200, headers: edgeHeaders }))
            .catch(() => {})
        );
      }

      return response;
    } catch (error) {
      return new Response("Media worker error: " + error.message, {
        status: 502,
        headers: {
          ...corsHeaders(),
          "Cache-Control": "no-store",
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    }
  },
};
