module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: [
      // Reanimated 4 ships its Babel plugin via react-native-worklets.
      // Must be listed last.
      'react-native-worklets/plugin',
    ],
  };
};
