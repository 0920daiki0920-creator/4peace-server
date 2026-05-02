const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  let filePath = './index.html';
  if (url !== '/') filePath = '.' + url;

  const ext = path.extname(filePath);
  const map = {
    '.js': 'text/javascript',
    '.html': 'text/html',
    '.css': 'text/css'
  };

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
    } else {
      res.writeHead(200, { 'Content-Type': map[ext] || 'text/plain' });
      res.end(data);
    }
  });
});
