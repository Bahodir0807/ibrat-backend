import fetch from 'node-fetch';

const URL = 'https://b.sultonoway.uz/ping';

setInterval(async () => {
  try {
    const res = await fetch(URL);
    const text = await res.text();
    console.log(`[Pinger] Pinged /ping. Status: ${res.status}. Response: ${text}`);
  } catch (err) {
    console.error('[Pinger] Failed to ping:', err.message);
  }
}, 5 * 60 * 1000);
