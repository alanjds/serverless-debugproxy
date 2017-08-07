'use strict';

/**
 * Serverless Plugin Boilerplate
 * - Useful example/starter code for writing a plugin for the Serverless Framework.
 * - In a plugin, you can:
 *    - Create a Custom Action that can be called via the CLI or programmatically via a function handler.
 *    - Overwrite a Core Action that is included by default in the Serverless Framework.
 *    - Add a hook that fires before or after a Core Action or a Custom Action
 *    - All of the above at the same time :)
 *
 * - Setup:
 *    - Make a Serverless Project dedicated for plugin development, or use an existing Serverless Project
 *    - Make a ".serverless_plugins" folder in the root of your Project and copy this codebase into it. Title it your custom plugin name with the suffix "-dev", like "myplugin-dev"
 *    - Add the plugin name to the serverless.yml of your Project, on the [plugins] section
 *    - Start developing!
 *
 * - Good luck, serverless.com :)
 */

const BbPromise = require('bluebird');
const http = require('http');
const fse = require('fs-extra');
const path = require('path');
const ngrok = require('ngrok');

BbPromise.promisifyAll(fse);


class DebugproxyPlugin {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.options._debugproxy_should_inject = false;

    this.commands = {
      debug: {
        usage: 'deploy a function that proxies tru your machine, instead of the real function',
        options: {
          host: {
            usage: 'The function-acessible hostname on this dev machine. Defaults to "spawn and grab from Ngrok".',
            shortcut: 'h',
          },
          port: {
            usage: 'The local server port, defaults to 5000.',
          },
        },
        lifecycleEvents: [
          'injectenvs', // To be used by tunnelize
          'tunnelize',
          'injectenvs', // To be fixed for debugfunction
          'markinjectdebugfunction',
          'deploy',
          'listen',
        ],
        commands: {
          serve: {
            usage: 'Serve the functions locally, to be accessed from the debug function deployed',

            options: {
              host: {
                usage: 'The function-acessible hostname for this dev machine, defaults to "spawn and grab from Ngrok".',
                shortcut: 'h',
              },
              port: {
                usage: 'The local server port, defaults to 5000.',
                shortcut: 'p',
              },
            },
          },

          tunnelize: {
            usage: 'Create a tunnel to allow the Function to access your dev machine',
            lifecycleEvents: [
              'injectenvs', // To be used by tunnelize
              'tunnelize',
              'listen',
            ],
            options: {
              port: {
                usage: 'The local server port, defaults to 5000.',
                shortcut: 'p',
              },
            },
          },
        },
      },
    };
    this.hooks = {
      // I would like to use just one hook, but am still newbie here.
      'debug:tunnelize': () => BbPromise.bind(this).then(this.tunnelize),
      'debug:tunnelize:tunnelize': () => BbPromise.bind(this).then(this.tunnelize),

      'debug:injectenvs': () => BbPromise.bind(this).then(this.injectEnvs),
      'debug:tunnelize:injectenvs': () => BbPromise.bind(this).then(this.injectEnvs),

      // Hook the package injector on the SLS deployment
      'package:createDeploymentArtifacts': () => BbPromise.bind(this).then(this.injectDebugFunction),
      'deploy:function:packageFunction': () => BbPromise.bind(this).then(this.injectDebugFunction),

      'debug:markinjectdebugfunction': () => BbPromise.bind(this).then(this.markInjectDebugFunction),
      'debug:deploy': () => BbPromise.bind(this).then(this.debugDeploy),

      'after:package:createDeploymentArtifacts': () => BbPromise.bind(this).then(this.informUsage),
      'after:deploy:functions': () => BbPromise.bind(this).then(this.informUsage),

      'debug:listen': () => BbPromise.bind(this).then(this.listenAndInvoke),
      'debug:tunnelize:listen': () => BbPromise.bind(this).then(this.listenAndInvoke),
    };
  }

  tunnelize() {
    var proxy_url = '';   // Provided by ngrok tunnel service
    var proxy_port = 443; // Encrypted tunnel

    return new BbPromise((resolve, reject) => {
      ngrok.connect(this.options.internal_port);
      ngrok.once('connect', url => {
        proxy_url = url;
        console.log('ngrok connected: ['+ proxy_url + ':' + proxy_port + ' => localhost:' + this.options.internal_port + ']');
        resolve();
      });
      ngrok.once('disconnect', url => {
        console.log('ngrok disconnected: ' + url);
      });
      ngrok.once('error', (err, url) => {
        console.log('ngrok error: ' + err + ' on url: ' + url);
        reject(err);
      });
      return (resolve, reject)
    }).then(() => {
      // Localhost port passed to ngrok. Replace with external tunnel one.
      // The ngrok entrypoint will be passed to the remote function.
      this.options.external_port = proxy_port;
      this.options.external_host = proxy_url;
      // Ready to rock!
    });
  }

  injectEnvs() {
    var provider = this.serverless.service.provider;
    if (!provider.environment){
      provider.environment = {};
    }

    provider.timeout = 5 * 60;  // 5 min should do, right?

    this.options.internal_host = this.options.host || '0.0.0.0';
    this.options.internal_port = this.options.port || 5000;

    this.options.external_host = this.options.external_host || 'localhost';
    provider.environment['DEBUGPROXY_HOST'] = this.options.external_host;
    this.options.external_port = this.options.external_port || 5000;
    provider.environment['DEBUGPROXY_PORT'] = this.options.external_port;
  }

  markInjectDebugFunction() {
    this.options._debugproxy_should_inject = true;
  }

  injectDebugFunction() {
    if (this.options._debugproxy_should_inject == false){
      return
    }

    this.serverless.cli.log('/!\\ WARNING /!\\: Replacing zip pack with Debug Proxy one...');

    // The proxy is made on nodejs
    this.serverless.service.provider.runtime = 'nodejs6.10';
    for (let func of Object.values(this.serverless.service.functions)){
      func.handler = 'debughandler.debugfunction'
    }

    // Inject (copy) the baked proxy code into the zip.
    return BbPromise.all([
      fse.copyAsync(
        path.resolve(__dirname, 'debughandler.js'),
        path.join(this.serverless.config.servicePath, 'debughandler.js'),
      ),
    ]);
  }

  debugDeploy() {
    return this.serverless.pluginManager.spawn('deploy');
  }

  _invokeLocalFunction(event, context) {
    this.options.data = JSON.stringify(event);
    console.log('INVOKING w/: ');
    console.log(this.options.data);
    return this.serverless.pluginManager.spawn('invoke:local');
  }

  listenAndInvoke() {
    return new BbPromise((resolve, reject) => {
      var server = http.createServer();
      server.on('request', (request, response) => {
        console.log('MOTHERSHIP CONNECTED...');
        var body = [];

        request.on('data', (chunk) => {
          console.log('BODY CHUNK RECEIVED BY DEV: ' + chunk);
          body.push(chunk);
          console.log('BODY RECEIVED BY DEV TIL NOW: ' + body);
        });

        request.on('end', () => {
          // Nothing more is coming from the mothership.
          console.log('BODY RECEIVED BY DEV COMPLETE: ' + body);
          body = Buffer.concat(body).toString();
          // at this point, `body` has the entire request body stored in it as a string

          try {
            var parsed_body = JSON.parse(body); // Should have "event" and "context"
          }catch(err) {
            response.statusCode = 400;
            response.end('JSON payload expected.');
            return
          }

          console.log('FINAL RECEIVED:');
          console.log(parsed_body);

          // (re)call it locally.
          var event = parsed_body['event'];
          var context = parsed_body['context'];
          var local_answer = this._invokeLocalFunction(event, context); // Is a Promise.
          local_answer.then(function(answer){
            console.log('LOCALLY COMPUTED:');
            console.log(answer);

            // Prepare to send the local answer back to mothership
            response.statusCode = 200;
            response.setHeader('Content-Type', 'application/json');
            //response.write('{"DEAD":"BEEF"}');
            response.end(answer || '');
          }).catch(function(err){
            console.error('LOCALLY BROKEN:');
            console.error(err);
          });
        });

        request.on('error', (err) => {
          // This prints the error message and stack trace to `stderr`.
          console.error(err.stack);
          reject(err);
        });
      });

      // Start the show!
      server.listen(this.options.internal_port, this.options.internal_host, () => {
        console.log('listening the mothership on: ['+ this.options.internal_host + ':' + this.options.internal_port +']');
        resolve();
      })

      return (resolve, reject);
    });
  }

  informUsage() {
    console.log('Debug Proxy is running NGROK. Please keep this terminal process open.');
    console.log('When finished debugging, press Ctrl+C to kill NGROK and exit.');
  }
}

module.exports = DebugproxyPlugin;

// Godspeed!
