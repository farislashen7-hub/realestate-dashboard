export const dynamic = 'force-dynamic';

export async function GET() {
  const url = process.env.NEXT_PUBLIC_N8N_DASHBOARD_URL;

  if (!url) {
    return Response.json({ error: 'NEXT_PUBLIC_N8N_DASHBOARD_URL not set' }, { status: 500 });
  }

  try {
    const res = await fetch(url, { 
      cache: 'no-store',
      headers: {
        'ngrok-skip-browser-warning': 'true'
      }
    });

    if (!res.ok) {
      return Response.json({ error: `n8n responded ${res.status}` }, { status: 500 });
    }

    const data = await res.json();
    return Response.json(data);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 502 });
  }
}