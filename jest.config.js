module.exports = {
  // 測試環境
  testEnvironment: 'jsdom',
  
  // 測試檔案的模式
  testMatch: [
    '**/tests/**/*.test.js'
  ],
  
  // 在每個測試檔案之前運行的設置文件
  setupFiles: ['./tests/setup.js'],
  
  // 忽略的目錄
  testPathIgnorePatterns: [
    '/node_modules/'
  ],
  
  // 顯示每個測試的詳細信息
  verbose: true
};
