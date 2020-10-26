<template>
  <modal
    :name="dialogId"
    height="500px"
    style="max-height: 100%; max-width: 100%"
    :fullscreen="fullscreen"
    :resizable="true"
    draggable=".drag-handle"
    :scrollable="true"
  >
    <div
      v-if="selected_dialog_window"
      @dblclick="maximizeWindow()"
      class="navbar-collapse collapse drag-handle"
      style="
        cursor: move;
        background-color: #448aff;
        color: white;
        text-align: center;
      "
    >
      <span class="noselect">{{ selected_dialog_window.name }}</span>
      <button
        @click="closeWindow(selected_dialog_window)"
        class="noselect dialog-control"
        style="background: #ff0000c4; left: 1px"
      >
        X
      </button>
      <button
        @click="minimizeWindow()"
        class="noselect dialog-control"
        style="background: #00cdff61; left: 25px"
      >
        -
      </button>
      <button
        @click="maximizeWindow()"
        class="noselect dialog-control"
        style="background: #00cdff61; left: 45px"
      >
        {{ fullscreen ? '=' : '+' }}
      </button>
    </div>
    <template v-for="wdialog in dialogWindows">
      <div
        :key="wdialog.window_id"
        v-show="wdialog === selected_dialog_window"
        style="height: calc(100% - 18px)"
      >
        <div
          :id="wdialog.window_id"
          style="width: 100%; height: 100%"
        ></div>
      </div>
    </template>
  </modal>
</template>
<script>
import * as imjoyCore from 'imjoy-core';
import $ from 'jquery';
import { Connection } from './comm-connection.js';

async function startImJoy(app, imjoy) {
  await imjoy.start();
  imjoy.event_bus.on('show_message', msg => {
    $.snackbar({
      content: msg,
      timeout: 5000,
    });
  });
  imjoy.event_bus.on('close_window', w => {
    const idx = app.dialogWindows.indexOf(w);
    if (idx >= 0) app.dialogWindows.splice(idx, 1);
    app.$forceUpdate();
  });
}

export default {
  name: 'app',
  props: {
    baseUrl: String,
  },
  data: function() {
    return {
      dialogWindows: [],
      selected_dialog_window: null,
      plugins: {},
      fullscreen: false,
      imjoy: null,
      dialogId: 'window-modal-dialog',
      kernelInfo: {},
    };
  },
  mounted() {
    window.dispatchEvent(new Event('resize'));
    console.log(`ImJoy Core (v${imjoyCore.VERSION}) loaded.`);
    const app = this;
    function add_window(_plugin, w) {
      if (!document.getElementById(w.window_id)) {
        if (!w.dialog) {
          if (document.getElementById(_plugin.id)) {
            const elem = document.createElement('div');
            elem.id = w.window_id;
            elem.classList.add('imjoy-inline-window');
            document.getElementById(_plugin.id).appendChild(elem);
          }
        } else {
          app.dialogWindows.push(w);
          app.selected_dialog_window = w;
          if (w.fullscreen || w.standalone) app.fullscreen = true;
          else app.fullscreen = false;
          app.$modal.show(app.dialogId);
          app.$forceUpdate();
          w.show = () => {
            app.selected_dialog_window = w;
            app.$modal.show(app.dialogId);
            imjoy.wm.selectWindow(w);
            w.api.emit('show');
          };

          w.hide = () => {
            if (app.selected_dialog_window === w) {
              app.$modal.hide(app.dialogId);
            }
            w.api.emit('hide');
          };

          setTimeout(() => {
            try {
              w.show();
            } catch (e) {
              console.error(e);
            }
          }, 500);
        }
      }
    }
    const imjoy = new imjoyCore.ImJoy({
      imjoy_api: {
        async showMessage(_plugin, msg, duration) {
          duration = duration || 5;
          $.snackbar({
            content: msg,
            timeout: duration * 1000,
          });
        },
        async showDialog(_plugin, config) {
          config.dialog = true;
          add_window(_plugin, config);
          return await imjoy.pm.createWindow(_plugin, config);
        },
        async createWindow(_plugin, config) {
          add_window(_plugin, config);
          return await imjoy.pm.createWindow(_plugin, config);
        },
      },
    });
    this.imjoy = imjoy;
    startImJoy(this, this.imjoy).then(() => {
      const base_url = new URL(this.baseUrl, document.baseURI).href;
      if (!base_url.endsWith('/')) base_url = base_url + '/';
      this.imjoy.pm
        .reloadPluginRecursively({
          uri: base_url + 'elfinder/',
        })
        .then(async plugin => {
          this.plugins[plugin.name] = plugin;
          this.showMessage(
            `Plugin ${plugin.name} successfully loaded into the workspace.`,
          );
          this.$forceUpdate();
        })
        .catch(e => {
          console.error(e);
          this.showMessage(
            `Failed to load the ImJoy elFinder plugin, error: ${e}`,
          );
        });
    });
    window.connectPlugin = async kernel_id => {
      if (!kernel_id) {
        console.warn(
          'Please upgrade imjoy-rpc(>=0.2.31) by running `pip install -U imjoy-rpc`',
        );
        return;
      }
      await this.connectPlugin(kernel_id);
      await this.runNotebookPlugin(kernel_id);
    };
    window._connectPlugin = async kernel_id => {
      await this.connectPlugin(kernel_id);
    };
    window._runPluginOnly = async kernel_id => {
      await this.runNotebookPlugin(kernel_id);
    };
  },
  methods: {
    loadImJoyApp() {
      this.imjoy.pm.imjoy_api.showDialog(null, {
        src: 'https://imjoy.io/#/app',
        fullscreen: true,
        passive: true,
      });
    },
    aboutImJoy() {
      this.imjoy.pm.imjoy_api.showDialog(null, {
        src: 'https://imjoy.io/#/about',
        passive: true,
      });
    },
    showAPIDocs() {
      this.imjoy.pm.imjoy_api.showDialog(null, {
        src: 'https://imjoy.io/docs/#/api',
        passive: true,
      });
    },
    async setupNotebook(kernel, buttonNode) {
      this.kernelInfo[kernel._id] = { kernel };
      buttonNode.firstChild.innerHTML = `<img src="https://imjoy.io/static/img/imjoy-logo-black.svg" style="height: 17px;">`;
      buttonNode.firstChild.onclick = () => {
        this.runNotebookPlugin(kernel._id);
      };
    },
    async connectPlugin(kernel_id) {
      if (!this.kernelInfo[kernel_id]) {
        console.warn('Kernel is not ready: ' + kernel_id);
        return;
      }
      const kernel = this.kernelInfo[kernel_id].kernel;
      await kernel.ready;
      const plugin = await this.imjoy.pm.connectPlugin(
        new Connection({ kernel }),
      );
      this.plugins[plugin.name] = plugin;
      this.kernelInfo[kernel_id].plugin = plugin;
      this.$forceUpdate();
    },
    async runNotebookPlugin(kernel_id) {
      if (!this.kernelInfo[kernel_id]) {
        console.warn('Kernel is not ready: ' + kernel_id);
        return;
      }
      try {
        const plugin = this.kernelInfo[kernel_id].plugin;
        if (plugin && plugin.api.run) {
          let config = {};
          if (
            plugin.config.ui &&
            plugin.config.ui.indexOf('{') > -1
          ) {
            config = await this.imjoy.pm.imjoy_api.showDialog(
              plugin,
              plugin.config,
            );
          }
          await plugin.api.run({
            config: config,
            data: {},
          });
        }
      } catch (e) {
        console.error(e);
        this.showMessage(`Failed to load the plugin, error: ${e}`);
      }
    },
    async run(plugin) {
      let config = {};
      if (plugin.config.ui && plugin.config.ui.indexOf('{') > -1) {
        config = await this.imjoy.pm.imjoy_api.showDialog(
          plugin,
          plugin.config,
        );
      }
      await plugin.api.run({
        config: config,
        data: {},
      });
    },
    showMessage(msg, duration) {
      duration = duration || 5;
      $.snackbar({
        content: msg,
        timeout: duration * 1000,
      });
    },
    loadPlugin() {
      const p = prompt(
        `Please type a ImJoy plugin URL`,
        'https://github.com/imjoy-team/imjoy-plugins/blob/master/repository/ImageAnnotator.imjoy.html',
      );
      this.imjoy.pm
        .reloadPluginRecursively({
          uri: p,
        })
        .then(async plugin => {
          this.plugins[plugin.name] = plugin;
          this.showMessage(
            `Plugin ${plugin.name} successfully loaded into the workspace.`,
          );
          this.$forceUpdate();
        })
        .catch(e => {
          console.error(e);
          this.showMessage(`Failed to load the plugin, error: ${e}`);
        });
    },
    showWindow(w) {
      if (w.fullscreen || w.standalone) this.fullscreen = true;
      else this.fullscreen = false;
      if (w) this.selected_dialog_window = w;
      this.$modal.show(this.dialogId);
    },
    closeWindow(w) {
      this.selected_dialog_window = null;
      this.$modal.hide(this.dialogId);
      const idx = this.dialogWindows.indexOf(w);
      if (idx >= 0) this.dialogWindows.splice(idx, 1);
    },
    minimizeWindow() {
      this.$modal.hide(this.dialogId);
    },
    maximizeWindow() {
      this.fullscreen = !this.fullscreen;
    },
  },
};
</script>

<style>
.vm--modal {
  max-height: 100% !important;
  max-width: 100% !important;
}
.imjoy-inline-window {
  width: 100%;
  height: 600px;
}
.noselect {
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  -khtml-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
}
.dialog-control {
  height: 16px;
  border: 0px;
  font-size: 1rem;
  position: absolute;
  color: white;
  top: 1px;
}
.dialog-control:focus {
  outline: none;
}
</style>
