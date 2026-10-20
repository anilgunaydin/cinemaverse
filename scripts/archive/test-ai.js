const http = require('http');

const loginData = JSON.stringify({ email: 'anil@cinemaverse.local', password: 'Av7XtDFzG6amjbLEJyjh' });

const loginReq = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(loginData)
  }
}, (res) => {
  const cookies = res.headers['set-cookie'] || [];
  const cookieHeader = cookies.map(c => c.split(';')[0]).join('; ');
  console.log('Login status:', res.statusCode);
  
  // Conversation oluştur
  const convData = JSON.stringify({ titleId: 'ttl_eee9f3768b734aaba03a8164', heading: 'Inception Test', spoilerMode: 'none' });
  
  const convReq = http.request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/ai/conversations',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookieHeader
    }
  }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('Conversation status:', res.statusCode);
      console.log(data);
      try {
        const conv = JSON.parse(data);
        if (conv.conversation?.id) {
          const msgData = JSON.stringify({ content: 'Inception filmi hakkında ne düşünüyorsun?' });
          const msgReq = http.request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/ai/conversations/' + conv.conversation.id + '/messages',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Cookie': cookieHeader
            }
          }, (res3) => {
            let data3 = '';
            res3.on('data', chunk => data3 += chunk);
            res3.on('end', () => {
              console.log('Message status:', res3.statusCode, data3);
            });
          });
          msgReq.on('error', console.error);
          msgReq.write(JSON.stringify({ content: 'Inception filmi hakkında ne düşünüyorsun?' }));
          msgReq.end();
        }
      } catch (e) {
        console.log('Conv parse error:', e.message, data);
      }
    });
    convReq.on('error', console.error);
    convReq.write(JSON.stringify({ titleId: 'ttl_eee9f3768b734aaba03a8164', heading: 'Inception Test', spoilerMode: 'none' }));
    convReq.end();
  });
  
  loginReq.on('error', console.error);
  loginReq.write(loginData);
  loginReq.end();
});