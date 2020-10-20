var extension = require('./index');

/**
 * Register the widget.
 */
module.exports = {
  id: 'imjoy-jupyter-extension',
  // requires: [INotebookTracker],
  activate: function(app, notebooks) {
      app.docRegistry.addWidgetExtension('Notebook', new extension.ButtonExtension());
  },
  autoStart: true
};
