async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH = 'main' } = process.env;

  if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
    return res.status(500).json({ error: 'Server not configured — set GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO in Vercel env vars.' });
  }

  try {
    const r = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/Context/assets?ref=${GITHUB_BRANCH}`,
      { headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' } }
    );

    if (!r.ok) {
      const err = await r.json();
      throw new Error(err.message || `GitHub API error ${r.status}`);
    }

    const items = await r.json();
    const files = items
      .filter(f => f.type === 'file' && f.name !== 'README.md')
      .map(f => ({
        name: f.name,
        size: f.size,
        download_url: f.download_url,
        sha: f.sha,
      }));

    res.status(200).json({ files });
  } catch (e) {
    console.error('Files list error:', e);
    res.status(500).json({ error: e.message });
  }
}

module.exports = handler;
