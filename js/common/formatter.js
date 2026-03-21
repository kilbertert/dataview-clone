// =========================================================
// 通用格式化与样式工具
//
// 说明：
// - 提供给多个页面（如指数总览、时间序列）复用的展示层工具
// - 不依赖具体 DOM，仅做纯函数处理，方便测试与迁移到 TypeScript
// =========================================================

/**
 * 通用数据格式化工具
 */
const CommonFormatter = {
  /**
   * 格式化百分比（0~1 的小数 -> 带百分号的字符串）
   * @param {number|null|undefined} value
   * @returns {string}
   */
  formatPercent(value) {
    if (value === null || value === undefined) {
      return "-";
    }
    return (value * 100).toFixed(2) + "%";
  },

  /**
   * 格式化布尔值为 "100%" / "0%"，用于原指数总览页
   * @param {boolean|null|undefined} value
   * @returns {string}
   */
  formatBooleanPercent(value) {
    if (value === null || value === undefined) {
      return "-";
    }
    return value ? "100%" : "0%";
  },

  /**
   * 时间格式化：后端 LocalDateTime -> yyyy-MM-dd HH:mm:ss
   * @param {string|null|undefined} timeStr
   * @returns {string}
   */
  formatTime(timeStr) {
    if (!timeStr) return "-";
    if (timeStr.includes("T")) {
      return timeStr.replace("T", " ").substring(0, 19);
    }
    return timeStr.substring(0, 19);
  },

  /**
   * 买卖信号（英文枚举 -> 中文文案）
   * @param {string|null|undefined} signal
   * @returns {string}
   */
  formatBuySellSignal(signal) {
    if (!signal) return "-";
    const signalMap = {
      BUY: "买",
      SELL: "卖",
    };
    return signalMap[signal] || signal;
  },
};

/**
 * 通用样式类生成工具
 */
const CommonStyleClass = {
  /**
   * 百分比高低样式
   * @param {number|null|undefined} value 0~1 之间的小数
   * @returns {string}
   */
  getPercentClass(value) {
    if (value === null || value === undefined) return "";
    return value >= 0.5 ? "percent-high" : "percent-low";
  },

  /**
   * 布尔值样式
   * @param {boolean|null|undefined} value
   * @returns {string}
   */
  getBooleanClass(value) {
    if (value === null || value === undefined) return "";
    return value ? "boolean-true" : "boolean-false";
  },

  /**
   * 买卖信号样式（前端一般以 BUY/SELL 为判断参考）
   * @param {string|null|undefined} signal
   * @returns {string}
   */
  getSignalClass(signal) {
    if (!signal) return "";
    return signal === "BUY" ? "signal-buy" : "signal-sell";
  },

  /**
   * 总分样式（>=3 视为偏高）
   * @param {number|null|undefined} score
   * @returns {string}
   */
  getScoreClass(score) {
    if (score === null || score === undefined) return "";
    return score >= 3 ? "score-high" : "score-low";
  },
};
