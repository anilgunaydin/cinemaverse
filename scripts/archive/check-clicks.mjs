import http from 'http';

http.get('http://localhost:3000/title/ttl_e453bcfd8db24a9c8f4e5b46', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    // Check for any pointer-events: none or similar
    const checks = [
      'pointer-events: none',
      'pointer-events:none',
      'user-select: none',
      'user-select:none',
      'touch-action: none',
      'touch-action:none',
    ];
    for (const check of checks) {
      if (data.includes(check)) console.log('FOUND:', check);
    }
    // Check for any elements with disabled attribute
    const disabled = data.match(/disabled=""/g);
    console.log('Disabled attributes:', disabled ? disabled.length : 0);
    
    // Check for any onclick handlers
    const onclick = data.match(/onclick=/gi);
    console.log('onclick handlers:', onclick ? onclick.length : 0);
    
    // Check for any links
    const links = data.match(/<a /gi);
    console.log('<a> tags:', links ? links.length : 0);
    
    // Check for any buttons
    const buttons = data.match(/<button/gi);
    console.log('<button> tags:', buttons ? buttons.length : 0);
  });
}).on('error', console.error);