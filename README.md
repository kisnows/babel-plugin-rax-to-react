# babel-plugin-rax2react
支持转换 rax 代码为 react 代码。
# How To Use

添加此插件到 bebel 配置中

```js
module.exports = function(api) {
  api.cache(false);
  const presets = [
    [
      "@babel/preset-env",
      {
        useBuiltIns: "false",
        corejs: 3,
        modules: false,
        debug: false,
      },
    ],
    "@babel/preset-react",
  ];
  const plugins = [
    require.resolve('babel-plugin-rax-to-react'),
    require.resolve("@babel/plugin-proposal-export-default-from"),

    // Stage 2
    [require.resolve("@babel/plugin-proposal-decorators"), { legacy: true }],
    require.resolve("@babel/plugin-proposal-function-sent"),
    require.resolve("@babel/plugin-proposal-export-namespace-from"),
    require.resolve("@babel/plugin-proposal-numeric-separator"),
    require.resolve("@babel/plugin-proposal-throw-expressions"),

    // // Stage 3
    require.resolve("@babel/plugin-syntax-dynamic-import"),
    require.resolve("@babel/plugin-syntax-import-meta"),
    [
      require.resolve("@babel/plugin-proposal-class-properties"),
      { loose: true },
    ],
    require.resolve("@babel/plugin-proposal-json-strings"),
    require.resolve("@babel/plugin-proposal-object-rest-spread"),
  ];

  return {
    presets,
    plugins,
  };
};

```
如果模块中使用了外部 css 文件来做样式布局，那么需要结合 webpack 以及 css-loader ，参考 css-loader 配置:
```js
{
  loader: require.resolve('css-loader'),
  options: {
    importLoaders: 2,
    modules: {
      mode: 'local',
      localIdentName: '[path][name]__[local]--[hash:base64:5]',
    },
    // sourceMap: !!DEV,
  },
}
```