// Entry point for the notebook bundle containing custom model definitions.

// Export widget models and views, and the npm package version number.

import { DisposableDelegate
} from '@lumino/disposable';

import {
  ToolbarButton
} from '@jupyterlab/apputils';

import {
  NotebookActions
} from '@jupyterlab/notebook';


import {setupImJoyJupyterExtension} from "./imjoy-jupyter-app.js";
// const { INotebookTracker } = require('@jupyterlab/notebook');

export { version } from '../package.json';

export class ImjoyExtension {
  constructor(jupyterBaseUrl){
    this.baseUrl = jupyterBaseUrl;
  }
  /**
   * Create a new extension object.
   */
  createNew(panel, context) {
    let callback = () => {
      NotebookActions.runAll(panel.content, context.sessionContext);
    };
    let button = new ToolbarButton({
      className: 'myButton',
      iconClass: 'fa fa-fast-forward',
      onClick: callback,
      tooltip: 'Run ImJoy'
    });
    panel.toolbar.insertItem(0, 'runAll', button);

    context.sessionContext.ready.then(() => {
      return context.sessionContext.session.kernel.ready;
    }).then(() => {
      const kernel = context.sessionContext.session.kernel;
      setupImJoyJupyterExtension(kernel, panel.node, button.node, this.baseUrl)
    })

    return new DisposableDelegate(() => {
      button.dispose();
    });
  }
}
