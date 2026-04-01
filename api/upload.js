function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => (data += chunk));
    req.on('end', () => {
      try { resolve(JSON.parse(data)); }
      catch { reject(new Error('Invalid JSON body')); }
    });
    req.on('error', reject);
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

async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH = 'main' } = process.env;

  if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
    return res.status(500).json({ error: 'Server not configured — set GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO in Vercel env vars.' });
  }

  try {
    const { filename, content } = await readBody(req);

    if (!filename || !content) return res.status(400).json({ error: 'Missing filename or content' });

    const safeName = filename.replace(/[^a-zA-Z0-9._\-() ]/g, '_');
    const path = `Context/assets/${safeName}`;

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
          content, // already base64 from frontend
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

module.exports = handler;
