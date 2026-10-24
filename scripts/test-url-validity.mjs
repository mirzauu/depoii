async function checkUrl(url) {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: AbortSignal.timeout(5000)
    });
    return { url, status: res.status, ok: res.ok };
  } catch (err) {
    return { url, error: err.message };
  }
}

async function run() {
  const tests = [
    'https://www.claudinecooperroofing.com',
    'https://www.bbb.org/us/tx/dallas/profile/commercial-roofing/claudine-cooper',
    'https://www.linkedin.com/company/claudine-cooper',
    'https://kpostcompany.com',
    'https://www.peakroofingconstruction.com/'
  ];
  for (const t of tests) {
    console.log(await checkUrl(t));
  }
}

run();
