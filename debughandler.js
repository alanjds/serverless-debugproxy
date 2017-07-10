'use strict';

const http = require('http');
const https = require("https");
const url = require('url');

console.log('DEBUGPROXY_HOST: ' + process.env['DEBUGPROXY_HOST']);
const target_url = url.parse(process.env['DEBUGPROXY_HOST']);


module.exports.debugfunction = (event, context, callback) => {
  console.log('DEBUGPROXY STARTING.');

  const payload = JSON.stringify({
    'event': event,
    'context': context,
  });

  console.log('DEBUGPROXY PAYLOAD: ' + payload);

  var full_response = '';

  # Request dance adapted from: https://stackoverflow.com/a/9577651/798575
  var driver = https;
  var target_port = 443;
  if (target_url.protocol == 'http:'){
    driver = http;
    target_port = 80;
  }
  console.log('DEBUGPROXY PROTOCOL: ' + target_url.protocol);

  var post_options = {
    host: target_url.hostname,
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
