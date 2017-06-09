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
      custom: {
        usage: 'A custom command from the boilerplate plugin',
        lifecycleEvents: [
          'resources',
          'functions'
        ],
        options: {
          option: {  // These must be specified in the CLI like this "-option true" or "-o true"
            shortcut:    'o',
            usage: 'test option 1',
          },
        },
      },
      debug: {
        usage: 'Allows functions to be proxied tru your machine, then debugged just-in-time',
        commands: {
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
      'before:deploy:resources': this.beforeDeployResources.bind(this),
      'deploy:resources': this.deployResources.bind(this),
      'after:deploy:resources': this.afterDeployResources.bind(this),
      'before:deploy:functions': this.beforeDeployFunctions.bind(this),
      'deploy:functions': this.deployFunctions.bind(this),
      'after:deploy:functions': this.afterDeployFunctions.bind(this),

      'debug:tunnelize:tunnelize': () => BbPromise.bind(this).then(this.tunnelize),
    };
  }
  beforeDeployResources() {
    console.log('Before Deploy Resources');
  }

  deployResources() {
    console.log('Deploy Resources');
  }

  afterDeployResources() {
    console.log('After Deploy Resources');
  }

  beforeDeployFunctions() {
    console.log('Before Deploy Functions');
  }

  deployFunctions() {
    console.log('Deploying function: ', this.options.function);
  }

  afterDeployFunctions() {
    console.log('After Deploy Functions');
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
