const args = process.argv.slice(2);
const submit = args.includes('--submit');
const urls = args.filter((arg) => !arg.startsWith('--'));
const siteUrl = 'https://beyondrv.com.au';
const key = process.env.INDEXNOW_KEY?.trim();

if (urls.length === 0) {
  console.error('Usage: npm run authority:indexnow -- /guides/ /our-slide-on-campers/ [--submit]');
  process.exitCode = 1;
} else {
  const urlList = urls.map((value) => {
    const url = new URL(value, siteUrl);
    if (url.origin !== siteUrl) throw new Error(`URL must be on ${siteUrl}: ${value}`);
    return url.toString();
  });

  const payload = {
    host: 'beyondrv.com.au',
    key: key || 'SET_INDEXNOW_KEY',
    keyLocation: `${siteUrl}/${key || 'SET_INDEXNOW_KEY'}.txt`,
    urlList,
  };

  if (!submit) {
    console.log(JSON.stringify({ mode: 'dry-run', endpoint: 'https://api.indexnow.org/indexnow', payload }, null, 2));
    console.log('No request sent. Add --submit and set INDEXNOW_KEY after the matching public key file is deployed.');
  } else if (!key) {
    console.error('INDEXNOW_KEY is required when --submit is used.');
    process.exitCode = 1;
  } else {
    const response = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`IndexNow returned ${response.status}: ${await response.text()}`);
    }
    console.log(`IndexNow accepted ${urlList.length} URL(s) with status ${response.status}.`);
  }
}
