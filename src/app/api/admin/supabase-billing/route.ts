import { NextResponse } from 'next/server';

export async function GET() {
  const mgmtKey = process.env.SUPABASE_MGMT_KEY;
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!mgmtKey) {
    return NextResponse.json(
      { error: 'SUPABASE_MGMT_KEY environment variable is not configured on the server.' },
      { status: 500 }
    );
  }

  if (!projectUrl) {
    return NextResponse.json(
      { error: 'NEXT_PUBLIC_SUPABASE_URL environment variable is not configured.' },
      { status: 500 }
    );
  }

  // Extract project ref (e.g. sbhouirpyiyybrravvih from https://sbhouirpyiyybrravvih.supabase.co)
  const match = projectUrl.match(/https:\/\/(.*?)\.supabase\./);
  const projectRef = match ? match[1] : null;

  if (!projectRef) {
    return NextResponse.json(
      { error: 'Could not extract Supabase project reference from NEXT_PUBLIC_SUPABASE_URL.' },
      { status: 400 }
    );
  }

  try {
    // Step 1: Fetch project details to get organization ID
    const projectRes = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}`,
      {
        headers: {
          'Authorization': `Bearer ${mgmtKey}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    );

    if (!projectRes.ok) {
      const errText = await projectRes.text();
      return new Response(
        JSON.stringify({ error: `Supabase Project API returned status ${projectRes.status}: ${errText}` }),
        {
          status: projectRes.status,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        }
      );
    }

    const projectData = await projectRes.json();
    const orgId = projectData.organization_id || projectData.organization_slug;

    if (!orgId) {
      return new Response(
        JSON.stringify({ error: 'Could not find organization_id in project details response.' }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        }
      );
    }

    // Step 2: Fetch organization details to get billing plan
    const orgRes = await fetch(
      `https://api.supabase.com/v1/organizations/${orgId}`,
      {
        headers: {
          'Authorization': `Bearer ${mgmtKey}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    );

    if (!orgRes.ok) {
      const errText = await orgRes.text();
      return new Response(
        JSON.stringify({ error: `Supabase Org API returned status ${orgRes.status}: ${errText}` }),
        {
          status: orgRes.status,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        }
      );
    }

    const orgData = await orgRes.json();
    const plan = orgData.plan || 'free';

    const mockSubscriptionData = {
      billing_tier: {
        id: plan,
        name: plan === 'free' ? 'Free' : plan === 'pro' ? 'Pro' : plan.toUpperCase(),
        price: plan === 'pro' ? 25 : 0,
        currency: 'usd',
        interval: 'monthly',
      }
    };

    return new Response(JSON.stringify(mockSubscriptionData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to fetch Supabase billing data.' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
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
    }
  });
}
