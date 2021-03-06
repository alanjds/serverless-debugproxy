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
              'tunnelize',
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
    };
  }

  tunnelize() {
    var proxy_url = '';   // Provided by ngrok tunnel service
    var proxy_port = 443; // Encrypted tunnel

    return new BbPromise((resolve, reject) => {
      ngrok.connect(this.options.port);
      ngrok.once('connect', url => {
        proxy_url = url;
        console.log('ngrok connected: ['+ proxy_url + ':' + proxy_port + ' => localhost:' + this.options.port + ']');
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
      this.options.port = proxy_port;
      this.options.host = proxy_url;
      // Ready to rock!
    });
  }

  injectEnvs() {
    var provider = this.serverless.service.provider;
    if (!provider.environment){
      provider.environment = {};
    }

    provider.timeout = 5 * 60;  // 5 min should do, right?

    this.options.host = this.options.host || 'localhost';
    provider.environment['DEBUGPROXY_HOST'] = this.options.host
    this.options.port = this.options.port || 5000;
    provider.environment['DEBUGPROXY_PORT'] = this.options.port
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

  informUsage() {
    console.log('Debug Proxy is running NGROK. Please keep this terminal process open.');
    console.log('When finished debugging, press Ctrl+C to kill NGROK and exit.');
  }
}

module.exports = DebugproxyPlugin;

// Godspeed!
