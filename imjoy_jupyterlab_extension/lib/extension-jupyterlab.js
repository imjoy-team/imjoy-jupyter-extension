var extension = require('./index');
/**
 * Register the widget.
 */
module.exports = {
  id: 'imjoy-jupyter-extension',
  // requires: [INotebookTracker],
  activate: function(app) {
      const jupyterBaseUrl = app.serviceManager.settings.serverSettings.baseUrl;
      app.docRegistry.addWidgetExtension('Notebook', new extension.ImjoyExtension(jupyterBaseUrl));
  },
  autoStart: true
};
