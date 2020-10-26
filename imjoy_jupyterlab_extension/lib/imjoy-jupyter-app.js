import 'snackbarjs';
import vmodal from 'vue-js-modal';
import Vue from 'vue';
import App from './App.vue';
import 'snackbarjs/dist/snackbar.min.css';
import 'snackbarjs/themes-css/material.css';
import 'vue-js-modal/dist/styles.css';

Vue.use(vmodal);

export default function setupImJoyJupyterExtension(baseUrl) {
  if (window.self !== window.top) {
    throw new Error('Jupyter extension cannot run in an iframe.');
  }
  if (!window.document.getElementById('snackbar-container')) {
    const snackbarElm = window.document.createElement('div');
    snackbarElm.id = 'snackbar-container';
    window.document.body.appendChild(snackbarElm);
  }
  // document.head.insertAdjacentHTML("beforeend", CSStyle)
  const ComponentClass = Vue.extend(App);
  const appInstance = new ComponentClass({
    propsData: { baseUrl },
  });
  appInstance.$mount();
  document.body.appendChild(appInstance.$el);

  return (kernel, panelNode, buttonNode) => {
    appInstance.setupNotebook(kernel, buttonNode);
  };
}
