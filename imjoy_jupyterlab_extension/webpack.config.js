const path = require('path');
const fetchUrl = require('fetch').fetchUrl;
const WebPackBar = require('webpackbar');
const { version } = require("./package.json");
// Custom webpack rules are generally the same for all webpack bundles, hence
// stored in a separate local variable.
const rules = [
  {
    test: /\.svg$/,
    use: [{ loader: 'raw-loader' }],
  },
  {
    test: /\.(png|jpg)$/,
    use: 'url-loader?limit=81920'
  },
  {
    test: /\.js$/,
    use: {
      loader: 'babel-loader'
    },
  },
]

const devServer = {
  noInfo: true,
}

module.exports = [
  {
    // Bundle for JupyterLab
    //
    // This bundle externalizes dependencies so we can build with our webpack
    // rules.
    //
    node: {
      fs: 'empty',
    },
    entry: './lib/extension-jupyterlab.js',
    output: {
      filename: 'labextension.js',
      path: path.resolve(__dirname, 'dist'),
      libraryTarget: 'amd',
      publicPath: 'https://unpkg.com/imjoy-jupyter-extension@' + version + '/dist',
    },
    devtool: 'source-map',
    module: {
      rules: rules,
    },
    resolve: {
      modules: [path.resolve(__dirname, 'node_modules')],
      alias: {
        'vue$': 'vue/dist/vue.esm.js'
      }
    },
    plugins: [
      new WebPackBar(),
    ],
    devServer,
  },
];
