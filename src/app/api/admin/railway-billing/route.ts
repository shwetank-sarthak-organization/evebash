import { NextResponse } from 'next/server';

// Railway GraphQL API endpoint
const RAILWAY_GQL = 'https://backboard.railway.app/graphql/v2';

// Railway pricing rates (per unit consumed over the billing period)
// CPU: $0.00000772 / vCPU-second
// Memory: $0.00000386 / GB-second
// Network egress (TX): $0.05 / GB
const RATE_CPU_PER_VCPU_SEC = 0.00000772;
const RATE_MEM_PER_GB_SEC = 0.00000386;
const RATE_NETWORK_TX_PER_GB = 0.05;

export async function GET(request: Request) {
  // NOTE: This works with a Project Token OR Account Token.
  // The `usage` query only needs projectId — accessible via project token.
  const apiToken = process.env.RAILWAY_API_TOKEN;
  const projectId = process.env.RAILWAY_PROJECT_ID;

  if (!apiToken) {
    return NextResponse.json(
      { error: 'RAILWAY_API_TOKEN not configured. Add it to .env.' },
      { status: 500 }
    );
  }

  if (!projectId) {
    return NextResponse.json(
      { error: 'RAILWAY_PROJECT_ID not configured. Add it to .env.' },
      { status: 500 }
    );
  }

  try {
    // Parse query parameters for custom start/end dates
    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    const now = new Date();
    const startOfMonth = startDateParam || new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const endOfMonth = endDateParam || now.toISOString();

    // 1. Get project name
    const projectQuery = {
      query: `{ project(id: "${projectId}") { id name } }`,
    };
    let projectName = 'EveBash';
    try {
      const projectRes = await fetch(RAILWAY_GQL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(projectQuery),
        cache: 'no-store',
      });
      if (projectRes.ok) {
        const projectData = await projectRes.json();
        projectName = projectData.data?.project?.name || projectName;
      }
    } catch (_) {}

    // 2. Fetch aggregated resource usage for the billing period
    const usageQuery = {
      query: `{
        usage(
          projectId: "${projectId}",
          measurements: [CPU_USAGE, MEMORY_USAGE_GB, NETWORK_TX_GB, NETWORK_RX_GB],
          startDate: "${startOfMonth}",
          endDate: "${endOfMonth}"
        ) {
          measurement
          value
        }
      }`,
    };

    const usageRes = await fetch(RAILWAY_GQL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(usageQuery),
      cache: 'no-store',
    });

    if (!usageRes.ok) {
      const errText = await usageRes.text();
      return NextResponse.json(
        { error: `Railway API returned ${usageRes.status}: ${errText}` },
        { status: 502 }
      );
    }

    const usageData = await usageRes.json();
    if (usageData.errors) {
      return NextResponse.json(
        { error: usageData.errors[0]?.message || 'Railway GraphQL error' },
        { status: 502 }
      );
    }

    const usageItems: { measurement: string; value: number }[] = usageData.data?.usage || [];

    // Extract raw values (which are aggregated in vCPU-minutes and GB-minutes)
    let cpuVcpuMin = 0;
    let memGbMin = 0;
    let networkTxGb = 0;
    let networkRxGb = 0;

    for (const item of usageItems) {
      const v = Number(item.value) || 0;
      switch (item.measurement) {
        case 'CPU_USAGE':       cpuVcpuMin  = v; break;
        case 'MEMORY_USAGE_GB': memGbMin    = v; break;
        case 'NETWORK_TX_GB':   networkTxGb = v; break;
        case 'NETWORK_RX_GB':   networkRxGb = v; break;
      }
    }

    // Convert minutes to seconds
    const cpuVcpuSec = cpuVcpuMin * 60;
    const memGbSec = memGbMin * 60;

    // Calculate dollar costs
    const cpuDollars    = cpuVcpuSec  * RATE_CPU_PER_VCPU_SEC;
    const memoryDollars = memGbSec    * RATE_MEM_PER_GB_SEC;
    // Only egress (TX) is billed, ingress (RX) is free
    const networkDollars = networkTxGb * RATE_NETWORK_TX_PER_GB;
    const totalEstimatedDollars = cpuDollars + memoryDollars + networkDollars;

    return new Response(
      JSON.stringify({
        projectName,
        projectId,
        billingPeriod: { start: startOfMonth, end: endOfMonth },
        // Raw usage
        cpuVcpuMin,
        memGbMin,
        cpuVcpuSec,
        memGbSec,
        networkTxGb,
        networkRxGb,
        // Dollar costs
        cpuDollars,
        memoryDollars,
        networkDollars,
        totalEstimatedDollars,
        invoiceDollars: null, // requires account token; use estimated total instead
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
      JSON.stringify({ error: error.message || 'Failed to fetch Railway billing data.' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
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
