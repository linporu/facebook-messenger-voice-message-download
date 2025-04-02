/**
 * logger.js
 * 提供擴充功能的統一日誌記錄系統
 */

// 日誌級別定義
const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4,
};

// 預設配置
let config = {
  // 當前日誌級別，可透過設置調整
  level: LogLevel.DEBUG,

  // 是否顯示時間戳
  showTimestamp: false,

  // 是否顯示日誌級別
  showLevel: true,

  // 是否顯示日誌模組
  showModule: true,

  // 是否顯示在開發人員控制台
  consoleOutput: true,

  // 模組級別的日誌控制
  moduleConfig: {
    // 為特定模組設置不同的日誌級別
    // 'MODULE_NAME': LogLevel.XXX
  },
};

/**
 * 格式化日誌訊息
 *
 * @param {string} level - 日誌級別
 * @param {string} module - 模組名稱
 * @param {string} message - 日誌訊息
 * @param {Object} [data] - 相關數據
 * @returns {string} - 格式化後的日誌訊息
 */
function formatLogMessage(level, module, message, data) {
  const parts = [];

  // 添加時間戳
  if (config.showTimestamp) {
    const now = new Date();
    const timeStr = now.toISOString().slice(11, 23); // 格式：HH:MM:SS.sss
    parts.push(`[${timeStr}]`);
  }

  // 添加日誌級別
  if (config.showLevel) {
    parts.push(`[${level}]`);
  }

  // 添加模組名稱
  if (config.showModule && module) {
    parts.push(`[${module}]`);
  }

  // 組合基本訊息
  let result = parts.join(" ") + " " + message;

  return result;
}

/**
 * 獲取模組的日誌級別
 *
 * @param {string} module - 模組名稱
 * @returns {number} - 該模組的日誌級別
 */
function getModuleLogLevel(module) {
  if (module && config.moduleConfig[module] !== undefined) {
    return config.moduleConfig[module];
  }
  return config.level;
}

/**
 * 輸出日誌
 *
 * @param {string} level - 日誌級別名稱
 * @param {number} levelValue - 日誌級別值
 * @param {string} module - 模組名稱
 * @param {string} message - 日誌訊息
 * @param {Object} [data] - 相關數據
 */
function log(level, levelValue, module, message, data) {
  // 檢查是否應該記錄此日誌
  const moduleLevel = getModuleLogLevel(module);
  if (levelValue < moduleLevel) {
    return;
  }

  // 格式化日誌訊息
  const formattedMessage = formatLogMessage(level, module, message, data);

  // 輸出到控制台
  if (config.consoleOutput) {
    switch (levelValue) {
      case LogLevel.DEBUG:
        if (data !== undefined) {
          console.debug(formattedMessage, data);
        } else {
          console.debug(formattedMessage);
        }
        break;
      case LogLevel.INFO:
        if (data !== undefined) {
          console.info(formattedMessage, data);
        } else {
          console.info(formattedMessage);
        }
        break;
      case LogLevel.WARN:
        if (data !== undefined) {
          console.warn(formattedMessage, data);
        } else {
          console.warn(formattedMessage);
        }
        break;
      case LogLevel.ERROR:
        if (data !== undefined) {
          console.error(formattedMessage, data);
        } else {
          console.error(formattedMessage);
        }
        break;
    }
  }
}

/**
 * 創建模組特定的日誌記錄器
 *
 * @param {string} module - 模組名稱
 * @returns {Object} - 該模組的日誌記錄器
 */
function createModuleLogger(module) {
  return {
    /**
     * 記錄調試級別日誌
     *
     * @param {string} message - 日誌訊息
     * @param {Object} [data] - 相關數據
     */
    debug: (message, data) => {
      log("DEBUG", LogLevel.DEBUG, module, message, data);
    },

    /**
     * 記錄信息級別日誌
     *
     * @param {string} message - 日誌訊息
     * @param {Object} [data] - 相關數據
     */
    info: (message, data) => {
      log("INFO", LogLevel.INFO, module, message, data);
    },

    /**
     * 記錄警告級別日誌
     *
     * @param {string} message - 日誌訊息
     * @param {Object} [data] - 相關數據
     */
    warn: (message, data) => {
      log("WARN", LogLevel.WARN, module, message, data);
    },

    /**
     * 記錄錯誤級別日誌
     *
     * @param {string} message - 日誌訊息
     * @param {Object} [data] - 相關數據
     */
    error: (message, data) => {
      log("ERROR", LogLevel.ERROR, module, message, data);
    },
  };
}

/**
 * 配置日誌系統
 *
 * @param {Object} newConfig - 新的配置
 */
function configure(newConfig) {
  config = { ...config, ...newConfig };

  // 如果用戶只提供了部分moduleConfig，則合併而不是替換
  if (newConfig.moduleConfig) {
    config.moduleConfig = { ...config.moduleConfig, ...newConfig.moduleConfig };
  }
}

/**
 * 設置全局日誌級別
 *
 * @param {number} level - 日誌級別
 */
function setLevel(level) {
  config.level = level;
}

/**
 * 設置特定模組的日誌級別
 *
 * @param {string} module - 模組名稱
 * @param {number} level - 日誌級別
 */
function setModuleLevel(module, level) {
  if (!config.moduleConfig) {
    config.moduleConfig = {};
  }
  config.moduleConfig[module] = level;
}

// 導出日誌系統
export const Logger = {
  LogLevel,
  createModuleLogger,
  configure,
  setLevel,
  setModuleLevel,

  // 全局日誌方法
  debug: (message, data) => log("DEBUG", LogLevel.DEBUG, null, message, data),
  info: (message, data) => log("INFO", LogLevel.INFO, null, message, data),
  warn: (message, data) => log("WARN", LogLevel.WARN, null, message, data),
  error: (message, data) => log("ERROR", LogLevel.ERROR, null, message, data),
};

// 為了方便使用，提供預設導出
export default Logger;
