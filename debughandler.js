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

  // Request dance adapted from: https://stackoverflow.com/a/9577651/798575
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

  console.log('DEBUGPROXY: driver.request(...)');
  var request = driver.request(post_options, (response) => {
    console.log('DEBUGPROXY ANSWER STATUS: ' + response.statusCode);
    console.log('DEBUGPROXY ANSWER HEADERS: ' + JSON.stringify(response.headers));
    response.setEncoding('utf8');

    response.on('data', (chunk) => {
      //do something with chunk
      console.log('BODY CHUNK RECEIVED: ' + chunk);
      full_response = full_response + chunk;
      console.log('BODY RECEIVED TIL NOW: ' + full_response);
    });

    response.on('end', () => {
      // Nothing more is coming from the developper.
      console.log('BODY RECEIVED COMPLETE: ' + full_response);
      var final_response = JSON.parse(full_response);
      console.log('FINAL RESPONSE:');
      console.log(final_response);
      callback(null, final_response, event);
    });

    response.on('close', (err) => {
      // Connection closed abruptly.
      console.log('GOT CLOSED: ' + err.message);

      var full_response = {
        statusCode: 200,
        body: JSON.stringify({
          message: 'DebugProxy: GOT CLOSED: ' + err.message,
          input: event,
        }),
      };
      callback(null, full_response);
    });
  });

  // Send the payload to be processed on the dev machine.
  console.log('DEBUGPROXY: req.write(payload)');
  request.write(payload);

  // Start the show!
  console.log('DEBUGPROXY: req.end()');
  request.end();
  console.log('DEBUGPROXY: after req.end()');

  request.on("error", (err) => {
    console.log("DEBUGPROXY Request got error: " + err.message);
  });

  console.log('DEBUGPROXY: finished!');
  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  // callback(null, { message: 'Go Serverless v1.0! Your function executed successfully!', event });
};
