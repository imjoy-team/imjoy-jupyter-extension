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

export default function setupImJoyJupyterExtension(baseUrl) {
  if (window.self !== window.top) {
    throw new Error('Jupyter extension cannot run in an iframe.');
  }
  if (!window.document.getElementById('snackbar-container')) {
    const snackbarElm = window.document.createElement('div');
    snackbarElm.id = 'snackbar-container';
    window.document.body.appendChild(snackbarElm);
  }
  const elem = window.document.createElement('div');
  // (panelNode.parentElement || panelNode).appendChild(elem);
  document.body.appendChild(elem);
  elem.style.display = 'block';
  // document.head.insertAdjacentHTML("beforeend", CSStyle)
  const vapp = new Vue({
    el: elem,
    data: {
      baseUrl,
    },
    template: `<app ref="app" :base-url="baseUrl"></app>`,
  });
  return vapp.$refs.app.setupNotebook;
}
