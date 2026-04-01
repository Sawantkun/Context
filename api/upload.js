const Busboy = require('busboy');

// Disable Vercel's default body parser so we can handle multipart
export const config = {
  api: { bodyParser: false }
};

function parseFile(req) {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({ headers: req.headers });
    const chunks = [];
    let filename = 'upload';

    busboy.on('file', (_field, stream, info) => {
      filename = info.filename || filename;
      stream.on('data', chunk => chunks.push(chunk));
      stream.on('error', reject);
    });

    busboy.on('finish', () => resolve({ filename, buffer: Buffer.concat(chunks) }));
    busboy.on('error', reject);
    req.pipe(busboy);
  });
}

async function getFileSha(owner, repo, branch, path, token) {
  const r = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } }
  );
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`SHA lookup failed: ${r.status}`);
  return (await r.json()).sha;
}

export default async function handler(req, res) {
  // CORS for local dev
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    GITHUB_TOKEN,
    GITHUB_OWNER,
    GITHUB_REPO,
    GITHUB_BRANCH = 'main',
  } = process.env;

  if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
    return res.status(500).json({ error: 'Server is not configured. Set GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO in Vercel env vars.' });
  }

  try {
    const { filename, buffer } = await parseFile(req);

    if (!filename) return res.status(400).json({ error: 'No file received' });
    if (buffer.length > 25 * 1024 * 1024) return res.status(413).json({ error: 'File exceeds 25 MB limit' });

    const safeName = filename.replace(/[^a-zA-Z0-9._\-() ]/g, '_');
    const path = `Context/assets/${safeName}`;
    const content = buffer.toString('base64');

    const sha = await getFileSha(GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH, path, GITHUB_TOKEN);

    const ghRes = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodeURIComponent(path)}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: `docs: upload ${safeName}`,
          content,
          branch: GITHUB_BRANCH,
          ...(sha ? { sha } : {}),
        }),
      }
    );

    if (!ghRes.ok) {
      const err = await ghRes.json();
      throw new Error(err.message || `GitHub API error ${ghRes.status}`);
    }

    res.status(200).json({ success: true, filename: safeName });
  } catch (e) {
    console.error('Upload error:', e);
    res.status(500).json({ error: e.message });
  }
}
