// Salitreeni: Oura-välipalvelin (Cloudflare Worker)
//
// Ouran rajapinta ei lähetä CORS-otsakkeita, joten selain ei voi kutsua sitä suoraan.
// Tämä Worker välittää vain GET-kutsut osoitteeseen /v2/usercollection/* ja lisää CORS-otsakkeet.
// Se ei tallenna mitään: käyttäjän Oura-token kulkee läpi Authorization-otsakkeessa.
// Vain alla listatut alkuperät (origin) saavat käyttää tätä välipalvelinta.

const ALLOWED_ORIGINS = [
  'https://kossu69-kosamiitti.github.io',
];

const UPSTREAM = 'https://api.ouraring.com';

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') || '';
    const allowed = ALLOWED_ORIGINS.includes(origin);
    const cors = {
      'Access-Control-Allow-Origin': allowed ? origin : ALLOWED_ORIGINS[0],
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    };

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (!allowed) return new Response('Forbidden', { status: 403, headers: cors });

    const url = new URL(request.url);
    if (request.method !== 'GET' || !url.pathname.startsWith('/v2/usercollection/')) {
      return new Response('Not found', { status: 404, headers: cors });
    }

    const auth = request.headers.get('Authorization');
    if (!auth) return new Response('Missing Authorization', { status: 401, headers: cors });

    const upstream = await fetch(UPSTREAM + url.pathname + url.search, {
      headers: { Authorization: auth, Accept: 'application/json' },
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { ...cors, 'Content-Type': upstream.headers.get('Content-Type') || 'application/json' },
    });
  },
};
