// Entry point for the notebook bundle containing custom model definitions.

// Export widget models and views, and the npm package version number.

import { DisposableDelegate } from '@lumino/disposable';

import { ToolbarButton } from '@jupyterlab/apputils';

import setupImJoyJupyterExtension from './imjoy-jupyter-app';
// const { INotebookTracker } = require('@jupyterlab/notebook');

export { version } from '../package.json';

export class ImjoyExtension {
  constructor(jupyterBaseUrl) {
    this.baseUrl = jupyterBaseUrl;
    this.notebookHandler = setupImJoyJupyterExtension(this.baseUrl);
  }

  /**
   * Create a new extension object.
   */
  createNew(panel, context) {
    const button = new ToolbarButton({
      tooltip: 'Run ImJoy Plugin',
    });
    panel.toolbar.insertItem(0, 'runAll', button);

    context.sessionContext.ready.then(() => {
      const { kernel } = context.sessionContext.session;
      this.notebookHandler(kernel, panel.node, button.node);
    });

    return new DisposableDelegate(() => {
      button.dispose();
    });
  }
}
