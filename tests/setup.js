// 模擬 Chrome API
global.chrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    }
  },
  contextMenus: {
    create: jest.fn(),
    update: jest.fn(),
    onClicked: {
      addListener: jest.fn()
    },
    onHidden: {
      addListener: jest.fn()
    }
  },
  downloads: {
    download: jest.fn()
  },
  tabs: {
    sendMessage: jest.fn()
  }
};

// 模擬 DOM 環境
global.document = {
  addEventListener: jest.fn(),
  querySelectorAll: jest.fn(() => [])
};

// 清除所有模擬函數的調用記錄
beforeEach(() => {
  jest.clearAllMocks();
});
