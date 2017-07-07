'use strict';

const http = require('http');

const target_host = process.env['DEBUGPROXY_HOST'];
const target_port = process.env['DEBUGPROXY_PORT'];


module.exports.debugfunction = (event, context, callback) => {
  var response = '';

  const post_options = {
    host: target_host,
    port: target_port,
    method: 'POST',
    path: '/',
  };

  http.request(post_options, (res) => {
    console.log('DEBUGPROXY ANSWER STATUS: ' + res.statusCode);
    console.log('DEBUGPROXY ANSWER HEADERS: ' + JSON.stringify(res.headers));
    res.setEncoding('utf8');

    res.on('data', (chunk) => {
      //do something with chunk
      console.log('BODY CHUNK RECEIVED: ' + chunk);
      response += chunk;
    });

    res.on('end', () => {
      // Nothing more is coming from the developper.
      console.log('BODY RECEIVED: ' + response);
      callback(null, JSON.parse(response));
    });

    res.on('close', (err) => {
      // Connection closed abruptly.
      console.log('GOT CLOSED: ' + err.message);

      const response = {
        statusCode: 200,
        body: JSON.stringify({
          message: 'DebugProxy: GOT CLOSED: ' + err.message,
          input: event,
        }),
      };
      callback(null, response);
    });

    // Send the payload to be processed on the dev machine.
    req.write('DEADBEEF!\n');

    // Start the show!
    req.end();

  }).on("error", (err) => {
    console.log("Got error: " + err.message);
  });

  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  // callback(null, { message: 'Go Serverless v1.0! Your function executed successfully!', event });
};
