const express = require('express');
const path    = require('path');

require('dotenv').config();

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

// ── health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, keySet: !!process.env.ANTHROPIC_API_KEY });
});

// ── Claude proxy ──────────────────────────────────────────────────────────────
app.post('/api/claude', async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'ANTHROPIC_API_KEY не задан. Скопируйте .env.example → .env и укажите ключ.',
    });
  }

  try {
    const body = {
      model:      'claude-sonnet-4-6',
      max_tokens: 2048,
      ...req.body,
    };

    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: data?.error?.message || `Anthropic API error ${upstream.status}`,
      });
    }

    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Не удалось достучаться до Anthropic: ' + err.message });
  }
});

// ── serve index for any unmatched route ──────────────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('\n\x1b[36m🔬 ТЗ Анализатор · NTZ LAB\x1b[0m');
  console.log(`\x1b[32m✅ Сервер запущен:\x1b[0m http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('\n\x1b[33m⚠️  ANTHROPIC_API_KEY не найден в .env!\x1b[0m');
    console.warn('   Скопируйте .env.example → .env и добавьте ключ.\n');
  }
});
