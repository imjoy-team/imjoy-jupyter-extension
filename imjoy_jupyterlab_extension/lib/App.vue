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
  imjoy.event_bus.on('add_window', w => {
    if (document.getElementById(w.window_id)) return;
    if (!w.dialog) {
      if (document.getElementById(app.active_plugin.id)) {
        const elem = document.createElement('div');
        elem.id = w.window_id;
        elem.classList.add('imjoy-inline-window');
        document
          .getElementById(app.active_plugin.id)
          .appendChild(elem);
        return;
      }
    }
    app.dialogWindows.push(w);
    app.selected_dialog_window = w;
    if (w.fullscreen || w.standalone) app.fullscreen = true;
    else app.fullscreen = false;
    app.$modal.show(app.dialogId);
    app.$forceUpdate();
    w.api.show = w.show = () => {
      app.selected_dialog_window = w;
      app.$modal.show(app.dialogId);
      imjoy.wm.selectWindow(w);
      w.api.emit('show');
    };

    w.api.hide = w.hide = () => {
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
  });
}

export default {
  name: 'app',
  props: {
    kernel: Object,
    baseUrl: String,
  },
  data: function() {
    return {
      dialogWindows: [],
      selected_dialog_window: null,
      plugins: {},
      fullscreen: false,
      imjoy: null,
      active_plugin: null,
      dialogId: 'window-modal-dialog',
    };
  },
  mounted() {
    (this.dialogId = 'window-modal-dialog-' + this.kernel._id),
      window.dispatchEvent(new Event('resize'));
    console.log(`ImJoy Core (v${imjoyCore.VERSION}) loaded.`);
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
    window.imjoy_apps = window.imjoy_apps || {};
    window.imjoy_apps[this.kernel._id] = this;
    window.connectPlugin = async function(kernel_id) {
      if (!kernel_id) {
        alert(
          'Please upgrade imjoy-rpc(>=0.2.31) by running `pip install -U imjoy-rpc`',
        );
        return;
      }
      const app = window.imjoy_apps[kernel_id];
      await app.connectPlugin();
      await app.runNotebookPlugin();
    };
    window._connectPlugin = async function(kernel_id) {
      const app = window.imjoy_apps[kernel_id];
      await app.connectPlugin();
    };
    window._runPluginOnly = async function(kernel_id) {
      const app = window.imjoy_apps[kernel_id];
      await app.runNotebookPlugin();
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
    async connectPlugin() {
      const plugin = await this.imjoy.pm.connectPlugin(
        new Connection({ kernel: this.kernel }),
      );
      this.plugins[plugin.name] = plugin;
      this.active_plugin = plugin;
      this.$forceUpdate();
    },
    async runNotebookPlugin() {
      try {
        const plugin = this.active_plugin;
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