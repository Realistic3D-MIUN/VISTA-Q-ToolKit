const winston = require('winston');
const express = require('express');
const fs = require('fs');
const https = require('https');
const app = express();

require('./startup/logging');
require('./startup/routes')(app);

const options = {
    key: fs.readFileSync('key.pem'),
    cert: fs.readFileSync('cert.pem')
  };
  
  https.createServer(options, app).listen(3000, () => {
    console.log('HTTPS server running on port 3000');
  });
  /*
const port = process.env.PORT || 9000;
app.listen(port, () => winston.info(`Listening on port ${port}...`));
*/

