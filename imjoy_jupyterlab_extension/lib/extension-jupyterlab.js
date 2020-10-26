import {
  ICommandPalette,
  MainAreaWidget,
} from '@jupyterlab/apputils';
import { Widget } from '@lumino/widgets';
import { ImjoyExtension } from './index';

async function getService(app, serviceName) {
  // eslint-disable-next-line no-restricted-syntax
  for (const tk of app._serviceMap.keys()) {
    if (tk.name === `@jupyterlab/apputils:${serviceName}`) {
      return app.resolveRequiredService(tk);
    }
  }
  return null;
}
/**
 * Register the widget.
 */
module.exports = {
  id: 'imjoy-jupyter-extension',
  async activate(app) {
    const palette = await getService(app, 'ICommandPalette');
    // Create a blank content widget inside of a MainAreaWidget
    const content = new Widget();
    const widget = new MainAreaWidget({ content });
    widget.id = 'apod-jupyterlab';
    widget.title.label = 'Astronomy Picture';
    widget.title.closable = true;
    // Add an application command
    const command = 'apod:open';
    app.commands.addCommand(command, {
      label: 'Random Astronomy Picture',
      execute: () => {
        if (!widget.isAttached) {
          // Attach the widget to the main work area if it's not there
          app.shell.add(widget, 'main');
        }
        // Activate the widget
        app.shell.activateById(widget.id);
      },
    });

    // Add the command to the palette.
    palette.addItem({ command, category: 'ImJoy' });

    const jupyterBaseUrl =
      app.serviceManager.settings.serverSettings.baseUrl;
    app.docRegistry.addWidgetExtension(
      'Notebook',
      new ImjoyExtension(jupyterBaseUrl),
    );
  },
  autoStart: true,
};
