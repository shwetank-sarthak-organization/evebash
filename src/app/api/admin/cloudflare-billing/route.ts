import { NextResponse } from 'next/server';

export async function GET() {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;

  if (!apiToken) {
    return NextResponse.json(
      { error: 'CLOUDFLARE_API_TOKEN environment variable is not configured on the server.' },
      { status: 500 }
    );
  }

  if (!accountId) {
    return NextResponse.json(
      { error: 'CLOUDFLARE_ACCOUNT_ID environment variable is not configured on the server.' },
      { status: 500 }
    );
  }

  try {
    // 1. Fetch Cloudflare subscriptions (e.g. Pro Plan, paid workers, etc.)
    // Standard endpoint: GET /accounts/{account_id}/subscriptions
    const subsRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/subscriptions`,
      {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    );

    let subscriptions: any[] = [];
    if (subsRes.ok) {
      const subsData = await subsRes.json();
      subscriptions = subsData.result || [];
    } else {
      console.warn(`Cloudflare subscriptions API returned status ${subsRes.status}`);
    }

    // 2. Fetch zone settings (to verify active plan of the main domain, e.g. Free/Pro/etc.)
    let zonePlan = 'free';
    if (zoneId) {
      const zoneRes = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${zoneId}`,
        {
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
        }
      );
      if (zoneRes.ok) {
        const zoneData = await zoneRes.json();
        zonePlan = zoneData.result?.plan?.legacy_id || zoneData.result?.plan?.id || 'free';
      }
    }

    // 3. Fetch Image Resizing usage (GraphQL unique transformations for the last 30 days)
    // Cloudflare GraphQL endpoint
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const gqlQuery = {
      query: `
        query GetImageTransformations($accountId: String!, $start: String!, $end: String!) {
          viewer {
            accounts(filter: { accountTag: $accountId }) {
              imagesUniqueTransformations(
                filter: { datetime_geq: $start, datetime_leq: $end }
                limit: 100
              ) {
                datetime
                uniqueTransformations
              }
            }
          }
        }
      `,
      variables: {
        accountId: accountId,
        start: thirtyDaysAgo.toISOString(),
        end: now.toISOString(),
      },
    };

    let uniqueTransformations = 0;
    try {
      const gqlRes = await fetch('https://api.cloudflare.com/client/v4/graphql', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(gqlQuery),
        cache: 'no-store',
      });

      if (gqlRes.ok) {
        const gqlData = await gqlRes.json();
        const records = gqlData.data?.viewer?.accounts?.[0]?.imagesUniqueTransformations || [];
        // Sum up unique transformations returned
        uniqueTransformations = records.reduce(
          (sum: number, record: any) => sum + (record.uniqueTransformations || 0),
          0
        );
      } else {
        console.warn(`Cloudflare GraphQL API returned status ${gqlRes.status}`);
      }
    } catch (gqlErr) {
      console.error('Failed to query Cloudflare GraphQL analytics API:', gqlErr);
    }

    // 4. Fallback: If GraphQL returns 0, try fetching from the images stats REST API if available
    let storedImagesCount = 0;
    try {
      const statsRes = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1/stats`,
        {
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
        }
      );
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        storedImagesCount = statsData.result?.count?.current || 0;
      }
    } catch (statsErr) {
      console.error('Failed to query Cloudflare images stats API:', statsErr);
    }

    return new Response(
      JSON.stringify({
        zonePlan,
        subscriptions,
        uniqueTransformations,
        storedImages: storedImagesCount,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to fetch Cloudflare billing data.' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
