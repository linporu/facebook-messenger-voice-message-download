const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'development', // 開發模式，可以改為 'production' 用於生產環境
  devtool: 'source-map', // 生成 source maps 以便於調試
  
  entry: {
    // 背景腳本
    background: './extension/scripts/background.js',
    
    // 內容腳本
    content: './extension/scripts/content.js',
    
    // 主模組腳本 (由內容腳本動態載入)
    'main-module': './extension/scripts/main-module.js',
  },
  
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'scripts/[name].js',
    clean: true, // 在每次構建前清理 dist 文件夾
  },
  
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      }
    ]
  },
  
  plugins: [
    new CopyPlugin({
      patterns: [
        { 
          from: 'extension', 
          to: '.', 
          globOptions: {
            ignore: [
              '**/scripts/**/*.js', // 忽略所有 JS 文件，因為它們會被 Webpack 處理
              '**/.DS_Store', // 忽略 macOS 系統文件
            ],
          }
        },
        // 複製 manifest.json 並更新內容腳本路徑
        {
          from: 'extension/manifest.json',
          to: 'manifest.json',
          transform(content) {
            const manifest = JSON.parse(content.toString());
            
            // 更新內容腳本路徑
            if (manifest.content_scripts && manifest.content_scripts.length > 0) {
              manifest.content_scripts.forEach(script => {
                if (script.js && script.js.length > 0) {
                  // 將所有內容腳本替換為打包後的版本
                  script.js = ['scripts/content.js'];
                }
              });
            }
            
            return JSON.stringify(manifest, null, 2);
          },
        },
      ],
    }),
  ],
  
  // 解析模組的選項
  resolve: {
    extensions: ['.js'], // 自動解析的擴展名
  },
};
