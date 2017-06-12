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


class DebugproxyPlugin {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;

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
          'tunnelize',
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
      'before:package:createDeploymentArtifacts': () => BbPromise.bind(this)
        .then(this.replacePackWithDebugproxy),

      // I would like to use just one hook, but am still newbie here.
      'debug:tunnelize:tunnelize': () => BbPromise.bind(this).then(this.tunnelize),
      'debug:tunnelize': () => BbPromise.bind(this).then(this.tunnelize),
      'debug:deploy': () => BbPromise.bind(this).then(this.debugDeploy),
    };
  }

  debugDeploy() {
    this.serverless.cli.log('WARN: debugDeploy ran.');


    return this.serverless.pluginManager.spawn('deploy');
  }

  replacePackWithDebugproxy() {
    this.serverless.cli.log('/!\ WARNING /!\: Replacing pack with Debug Proxy one...');

    //return BbPromise.all([
    //  fse.copyAsync(
    //    path.resolve(__dirname, 'wsgi.py'),
    //    path.join(this.serverless.config.servicePath, 'wsgi.py')),
    //  fse.writeFileAsync(
    //    path.join(this.serverless.config.servicePath, '.wsgi_app'),
    //    this.wsgiApp)
    //]);
  }

  tunnelize() {
    throw new this.serverless.classes.Error('Congrats. It tried to tunnelize');

    return new BbPromise((resolve, reject) => {
      var status = child_process.spawnSync('ngrok', [] /* cli options */, { stdio: 'inherit' });
      if (status.error) {
        reject(status.error);
      } else {
        resolve();
      }
    });
  }
}

module.exports = DebugproxyPlugin;

// Godspeed!
