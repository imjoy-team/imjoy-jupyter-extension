import 'snackbarjs';
import vmodal from 'vue-js-modal';
import Vue from 'vue';
import $ from 'jquery';
import App from './App.vue';
import { putBuffers, removeBuffers } from './comm-connection';
import 'snackbarjs/dist/snackbar.min.css';
import 'snackbarjs/themes-css/material.css';
import 'vue-js-modal/dist/styles.css';

Vue.use(vmodal);
Vue.component('app', App);

$.getStylesheet = href => {
  const $d = $.Deferred();
  const $link = $('<link/>', {
    rel: 'stylesheet',
    type: 'text/css',
    href,
  }).appendTo('head');
  $d.resolve($link);
  return $d.promise();
};

function randId() {
  return Math.random()
    .toString(36)
    .substr(2, 10);
}

function initPlugin(config) {
  config = config || {};
  const targetOrigin = config.target_origin || '*';
  const peerId = randId();
  const pluginConfig = {
    allow_execution: false,
    version: '0.1.1',
    api_version: '0.2.3',
    dedicated_thread: true,
    description: 'Jupyter notebook',
    id: `jupyter_${randId()}`,
    lang: 'python',
    name: 'Jupyter Notebook',
    type: 'rpc-window',
    origin: window.location.origin,
    defaults: {
      fullscreen: true,
    },
  };
  window.parent.postMessage(
    {
      type: 'initialized',
      config: pluginConfig,
      peer_id: peerId,
    },
    targetOrigin,
  );
}

function setupComm(targetOrigin, kernel) {
  const comm = kernel.createComm('imjoy_rpc');
  comm.open({});
  comm.onMsg = msg => {
    const { data } = msg.content;
    const bufferPaths = data.__buffer_paths__ || [];
    delete data.__buffer_paths__;
    putBuffers(data, bufferPaths, msg.buffers || []);

    if (data.type === 'log' || data.type === 'info') {
      console.log(data.message);
    } else if (data.type === 'error') {
      console.error(data.message);
    } else {
      window.parent.postMessage(data, targetOrigin);
    }
  };
  return comm;
}

function setupMessageHandler(targetOrigin, comm) {
  // event listener for the plugin message
  window.addEventListener('message', e => {
    if (targetOrigin === '*' || e.origin === targetOrigin) {
      const { data } = e;
      const split = removeBuffers(data);
      split.state.__buffer_paths__ = split.buffer_paths;
      comm.send(split.state, {}, {}, split.buffers);
    }
  });
}

export default function setupImJoyJupyterExtension(
  kernel,
  panelNode,
  buttonNode,
  baseUrl,
) {
  // support syntax highlighting for imjoy plugins
  //   require(['notebook/js/codecell', "codemirror/mode/htmlmixed/htmlmixed", "codemirror/mode/css/css", "codemirror/mode/javascript/javascript"], function (codecell) {
  //     codecell.CodeCell.options_default.highlight_modes['magic_html'] = {
  //       reg: [/^## ImJoy Plugin/]
  //     }
  //     Jupyter.notebook.events.one('kernel_ready.Kernel', function () {
  //       Jupyter.notebook.get_cells().map(function (cell) {
  //         if (cell.cell_type == 'code') {
  //           cell.auto_highlight();
  //         }
  //       });
  //     });
  //   });
  // check if it's inside an iframe
  // if yes, initialize the rpc connection
  if (window.self !== window.top) {
    initPlugin();
    window.connectPlugin = () => {
      const comm = setupComm('*', kernel);
      setupMessageHandler('*', comm);
      console.log('ImJoy RPC reloaded.');
    };
    const elem = window.document.createElement('div');
    elem.id = 'app';
    elem.innerHTML = `<button class="btn btn-default" onclick="connectPlugin()"><i class="fa-play fa"></i>&nbsp;<img src="https://imjoy.io/static/img/imjoy-logo-black.svg" style="height: 18px;"></button>`;
    window.document
      .getElementById('maintoolbar-container')
      .appendChild(elem);
    console.log('ImJoy RPC started.');

    // otherwise, load the imjoy core and run in standalone mode
  } else {
    buttonNode.firstChild.innerHTML = `<img src="https://imjoy.io/static/img/imjoy-logo-black.svg" style="height: 17px;">`;
    if (!window.document.getElementById('snackbar-container')) {
      const snackbarElm = window.document.createElement('div');
      snackbarElm.id = 'snackbar-container';
      window.document.body.appendChild(snackbarElm);
    }
    const elem = window.document.createElement('div');
    (panelNode.parentElement || panelNode).appendChild(elem);
    elem.style.display = 'block';
    // document.head.insertAdjacentHTML("beforeend", CSStyle)
    const vapp = new Vue({
      el: elem,
      data: {
        kernel,
        baseUrl,
      },
      template: `<app ref="app" :kernel="kernel" :base-url="baseUrl"></app>`,
    });
    buttonNode.firstChild.onclick = vapp.$refs.app.runNotebookPlugin;
  }
}
