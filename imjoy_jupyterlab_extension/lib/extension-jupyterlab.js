import { ImjoyExtension } from './index';

/**
 * Register the widget.
 */
module.exports = {
  id: 'imjoy-jupyter-extension',
  // requires: [INotebookTracker],
  activate(app) {
    const jupyterBaseUrl =
      app.serviceManager.settings.serverSettings.baseUrl;
    app.docRegistry.addWidgetExtension(
      'Notebook',
      new ImjoyExtension(jupyterBaseUrl),
    );
  },
  autoStart: true,
};
