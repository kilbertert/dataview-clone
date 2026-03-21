// ========== 数据服务层 ==========
const DataService = {
    /**
     * 获取所有数据(包括统计信息和股票列表)
     */
    async fetchAllData() {
        // 使用全局配置中的 BASE_API_URL
        const response = await fetch(`${BASE_API_URL}/dataApi/getAllData`);
        if (!response.ok) {
            throw new Error(`HTTP错误: ${response.status}`);
        }
        return await response.json();
    },
};

// ========== 数据格式化层 ==========
const DataFormatter = {
    /**
     * 格式化百分比
     */
    formatPercent(value) {
        return CommonFormatter.formatPercent(value);
    },

    /**
     * 格式化布尔值
     */
    formatBoolean(value) {
        return CommonFormatter.formatBooleanPercent(value);
    },

    /**
     * 格式化时间
     */
    formatTime(timeStr) {
        return CommonFormatter.formatTime(timeStr);
    },

    /**
     * 格式化买卖信号 - 将后端的 BUY/SELL 映射为中文
     */
    formatBuySellSignal(signal) {
        return CommonFormatter.formatBuySellSignal(signal);
    },
};

// ========== 样式类生成器 ==========
const StyleClassGenerator = {
    /**
     * 获取百分比样式类
     */
    getPercentClass(value) {
        return CommonStyleClass.getPercentClass(value);
    },

    /**
     * 获取布尔值样式类
     */
    getBooleanClass(value) {
        return CommonStyleClass.getBooleanClass(value);
    },

    /**
     * 获取信号样式类
     */
    getSignalClass(signal) {
        // 这里传入中文"买/卖"，买=红色背景，卖=绿色背景
        if (!signal) return "";
        return signal === "买" ? "signal-buy" : "signal-sell";
    },

    /**
     * 根据总分计算买卖信号
     */
    calculateBuySellSignal(totalScore) {
        if (totalScore === null || totalScore === undefined) return "卖";
        // 0, 1, 2 = 卖，其余 = 买
        return totalScore <= 2 ? "卖" : "买";
    },

    /**
     * 获取总分样式类
     */
    getScoreClass(score, marketTrend) {
        if (score === null || score === undefined) return "";
        const threshold = 3;
        // 总分 >= 3 始终显示红色
        return score >= threshold ? "score-high" : "score-low";
    },
};

// ========== 数据处理层 ==========
const DataProcessor = {
    /**
     * 排序数据
     */
    sortData(data, column, direction, dataType) {
        return [...data].sort((a, b) => {
            let aVal = a[column];
            let bVal = b[column];

            // 处理 null/undefined
            if (aVal === null || aVal === undefined) {
                aVal =
                    dataType === "number" || dataType === "percent"
                        ? -Infinity
                        : "";
            }
            if (bVal === null || bVal === undefined) {
                bVal =
                    dataType === "number" || dataType === "percent"
                        ? -Infinity
                        : "";
            }

            // 根据数据类型比较
            let comparison = 0;
            if (dataType === "number" || dataType === "percent") {
                comparison = aVal - bVal;
            } else if (dataType === "boolean") {
                comparison = aVal === bVal ? 0 : aVal ? 1 : -1;
            } else {
                comparison = String(aVal).localeCompare(String(bVal));
            }

            return direction === "asc" ? comparison : -comparison;
        });
    },

    /**
     * 检查数据变更类型
     */
    getDataChangeType(code, newData, previousData, isFirstLoad) {
        // 如果是第一次加载,不显示动画
        if (isFirstLoad) return null;

        const oldData = previousData.find((d) => d.etfCode === code);

        // 新数据
        if (!oldData) return "new";

        // 排除特定字段进行比较
        const strippedNewData = { ...newData };
        delete strippedNewData.holdStatus;
        delete strippedNewData.greaterThanM0Price;

        const strippedOldData = { ...oldData };
        delete strippedOldData.holdStatus;
        delete strippedOldData.greaterThanM0Price;

        // 数据有更新
        if (
            JSON.stringify(strippedOldData) !== JSON.stringify(strippedNewData)
        ) {
            return "updated";
        }

        return null;
    },

    /**
     * 检测统计数据变化
     */
    detectStatChanges(currentStats, previousStats, isFirstLoad) {
        const changedStats = new Set();

        if (!previousStats || isFirstLoad) {
            return changedStats;
        }

        const fields = [
            "marketTrend",
            "m5Percent",
            "m10Percent",
            "m20Percent",
            "maMeanPercent",
            "growthStockCount",
            "totalStockCount",
        ];

        fields.forEach((field) => {
            if (previousStats[field] !== currentStats[field]) {
                changedStats.add(field);
            }
        });

        return changedStats;
    },
};

// ========== UI渲染层 ==========
const UIRenderer = {
    /**
     * 更新网络状态显示
     */
    updateNetworkStatus(status) {
        const statusElement = document.getElementById("networkStatus");
        if (statusElement) {
            statusElement.className = `network-status ${status}`;
        }
    },

    /**
     * 更新最后更新时间
     */
    updateLastUpdateTime(timeStr) {
        const element = document.getElementById("lastUpdate");
        if (element) {
            element.textContent = `最后更新: ${DataFormatter.formatTime(
                timeStr
            )}`;
        }
    },

    /**
     * 更新数据计数
     */
    updateDataCount(count) {
        const element = document.getElementById("dataCount");
        if (element) {
            element.textContent = count;
        }
    },

    /**
     * 更新统计信息卡片
     */
    updateStatsGrid(statistics, changedStats) {
        const statsGrid = document.getElementById("statsGrid");
        if (!statsGrid) return;

        const m5Percent = (statistics.m5Percent * 100).toFixed(2);
        const m10Percent = (statistics.m10Percent * 100).toFixed(2);
        const m20Percent = (statistics.m20Percent * 100).toFixed(2);
        const maMeanPercent = (statistics.maMeanPercent * 100).toFixed(2);
        // 格式化大盘趋势,将 BUY/SELL 映射为 买/卖
        const marketTrend = DataFormatter.formatBuySellSignal(
            statistics.marketTrend
        );
        const marketTrendClass =
            StyleClassGenerator.getSignalClass(marketTrend);

        statsGrid.innerHTML = `
      <div class="stat-card ${
          changedStats.has("marketTrend") ? "highlight-stat" : ""
      }">
        <div class="stat-label">大盘趋势</div>
        <div class="stat-value">
          <span style="padding: 3px 10px;border-radius: 8px;" class="${marketTrendClass}">
            ${marketTrend}
          </span>
        </div>
      </div>
      <div class="stat-card ${
          changedStats.has("m5Percent") ? "highlight-stat" : ""
      }">
        <div class="stat-label">大盘指数占比</div>
        <div class="stat-value">${m5Percent}%</div>
      </div>
      <div class="stat-card ${
          changedStats.has("m10Percent") ? "highlight-stat" : ""
      }">
        <div class="stat-label">M10占比</div>
        <div class="stat-value">${m10Percent}%</div>
      </div>
      <div class="stat-card ${
          changedStats.has("m20Percent") ? "highlight-stat" : ""
      }">
        <div class="stat-label">M20占比</div>
        <div class="stat-value">${m20Percent}%</div>
      </div>
      <div class="stat-card ${
          changedStats.has("maMeanPercent") ? "highlight-stat" : ""
      }">
        <div class="stat-label">Ma均值占比</div>
        <div class="stat-value">${maMeanPercent}%</div>
      </div>
      <div class="stat-card ${
          changedStats.has("growthStockCount") ? "highlight-stat" : ""
      }">
        <div class="stat-label">增长股数</div>
        <div class="stat-value">${statistics.growthStockCount}</div>
      </div>
      <div class="stat-card ${
          changedStats.has("totalStockCount") ? "highlight-stat" : ""
      }">
        <div class="stat-label">总股数</div>
        <div class="stat-value">${statistics.totalStockCount}</div>
      </div>
    `;
    },

    /**
     * 渲染表格行
     */
    renderTableRow(item, marketTrend, previousData, isFirstLoad) {
        const changeType = DataProcessor.getDataChangeType(
            item.etfCode,
            item,
            previousData,
            isFirstLoad
        );
        const rowClass = changeType ? `highlight-${changeType}` : "";
        const scoreClass = StyleClassGenerator.getScoreClass(
            item.totalScore,
            marketTrend
        );
        // 根据总分计算买卖信号: 0,1,2=卖，其余=买
        const buySellSignal = StyleClassGenerator.calculateBuySellSignal(
            item.totalScore
        );
        const buySellSignalClass =
            StyleClassGenerator.getSignalClass(buySellSignal);

        return `
      <tr class="${rowClass}">
        <td class="time-cell">${DataFormatter.formatTime(item.createTime)}</td>
        <td class="code-cell">${item.etfCode || "-"}</td>
        <td>${item.industry || "-"}</td>
        <td>${item.etfName || "-"}</td>
        <td class="${scoreClass}">${item.totalScore || "0"}</td>
        <td class="${buySellSignalClass}">${buySellSignal}</td>
        <td class="${StyleClassGenerator.getBooleanClass(
            item.greaterThanM5Price
        )}">
          ${DataFormatter.formatBoolean(item.greaterThanM5Price)}
        </td>
        <td class="${StyleClassGenerator.getBooleanClass(
            item.greaterThanM10Price
        )}">
          ${DataFormatter.formatBoolean(item.greaterThanM10Price)}
        </td>
        <td class="${StyleClassGenerator.getBooleanClass(
            item.greaterThanM20Price
        )}">
          ${DataFormatter.formatBoolean(item.greaterThanM20Price)}
        </td>
        <td class="percent-value ${StyleClassGenerator.getPercentClass(
            item.m0Percent
        )}">
          ${DataFormatter.formatPercent(item.m0Percent)}
        </td>
        <td class="percent-value ${StyleClassGenerator.getPercentClass(
            item.m5Percent
        )}">
          ${DataFormatter.formatPercent(item.m5Percent)}
        </td>
        <td class="percent-value ${StyleClassGenerator.getPercentClass(
            item.m10Percent
        )}">
          ${DataFormatter.formatPercent(item.m10Percent)}
        </td>
        <td class="percent-value ${StyleClassGenerator.getPercentClass(
            item.m20Percent
        )}">
          ${DataFormatter.formatPercent(item.m20Percent)}
        </td>
        <td class="percent-value ${StyleClassGenerator.getPercentClass(
            item.maMeanRatio
        )}">
          ${DataFormatter.formatPercent(item.maMeanRatio)}
        </td>
        <td>${item.growthStockCount || "-"}</td>
        <td>${item.totalStockCount || "-"}</td>
      </tr>
    `;
    },

    /**
     * 渲染数据表格
     */
    renderTable(
        data,
        sortColumn,
        sortDirection,
        marketTrend,
        previousData,
        isFirstLoad
    ) {
        const tableBody = document.getElementById("tableBody");
        const loadingDiv = document.getElementById("loadingDiv");
        const errorDiv = document.getElementById("errorDiv");
        const table = document.getElementById("dataTable");
        const noDataDiv = document.getElementById("noDataDiv");
        const tableContainer = document.querySelector(".table-container");

        // 保存当前滚动位置
        const scrollTop = tableContainer ? tableContainer.scrollTop : 0;

        // 隐藏加载和错误提示
        if (loadingDiv) loadingDiv.style.display = "none";
        if (errorDiv) errorDiv.style.display = "none";

        // 无数据处理
        if (!data || data.length === 0) {
            if (table) table.style.display = "none";
            if (noDataDiv) noDataDiv.style.display = "block";
            return;
        }

        // 显示表格
        if (table) table.style.display = "table";
        if (noDataDiv) noDataDiv.style.display = "none";

        // 应用排序
        let sortedData = data;
        if (sortColumn) {
            const th = document.querySelector(
                `th[data-column="${sortColumn}"]`
            );
            const dataType = th ? th.dataset.type : "string";
            sortedData = DataProcessor.sortData(
                data,
                sortColumn,
                sortDirection,
                dataType
            );
        }

        // 渲染表格行
        if (tableBody) {
            tableBody.innerHTML = sortedData
                .map((item) =>
                    this.renderTableRow(
                        item,
                        marketTrend,
                        previousData,
                        isFirstLoad
                    )
                )
                .join("");
        }

        // 恢复滚动位置
        if (scrollTop > 0 && tableContainer) {
            requestAnimationFrame(() => {
                tableContainer.scrollTop = scrollTop;
            });
        }
    },

    /**
     * 显示错误信息
     */
    showError(message) {
        const errorDiv = document.getElementById("errorDiv");
        const loadingDiv = document.getElementById("loadingDiv");
        const table = document.getElementById("dataTable");

        if (errorDiv) {
            errorDiv.textContent = `获取数据失败: ${message}`;
            errorDiv.style.display = "block";
        }
        if (loadingDiv) loadingDiv.style.display = "none";
        if (table) table.style.display = "none";
    },

    /**
     * 更新排序指示器
     */
    updateSortIndicators(sortColumn, sortDirection) {
        document.querySelectorAll("th.sortable").forEach((th) => {
            th.classList.remove("sort-asc", "sort-desc");
            if (th.dataset.column === sortColumn) {
                th.classList.add(
                    sortDirection === "asc" ? "sort-asc" : "sort-desc"
                );
            }
        });
    },
};

// ========== 应用状态管理 ==========
const AppState = {
    previousData: [],
    isFirstLoad: true,
    networkStatus: "online",
    sortColumn: null,
    sortDirection: "asc",
    currentStatistics: null,
    previousStats: null,
};

// ========== 主应用控制器 ==========
const App = {
    /**
     * 初始化应用
     */
    init() {
        this.setupEventListeners();
        this.startDataPolling();
    },

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 添加表头点击排序事件
        document.querySelectorAll("th.sortable").forEach((th) => {
            th.addEventListener("click", () => {
                const column = th.dataset.column;
                const dataType = th.dataset.type;
                this.handleColumnSort(column, dataType);
            });
        });
    },

    /**
     * 处理列排序
     */
    handleColumnSort(column, dataType) {
        if (AppState.sortColumn === column) {
            // 同一列：切换排序方向
            AppState.sortDirection =
                AppState.sortDirection === "asc" ? "desc" : "asc";
        } else {
            // 新列：默认升序
            AppState.sortColumn = column;
            AppState.sortDirection = "asc";
        }

        UIRenderer.updateSortIndicators(
            AppState.sortColumn,
            AppState.sortDirection
        );

        // 重新渲染表格
        const marketTrend = AppState.currentStatistics
            ? AppState.currentStatistics.marketTrend
            : "卖";
        UIRenderer.renderTable(
            AppState.previousData,
            AppState.sortColumn,
            AppState.sortDirection,
            marketTrend,
            AppState.previousData,
            AppState.isFirstLoad
        );
    },

    /**
     * 开始数据轮询
     */
    startDataPolling() {
        // 立即获取一次数据
        this.fetchAndUpdateData();

        // 每10秒自动刷新
        setInterval(() => this.fetchAndUpdateData(), 10000);
    },

    /**
     * 获取并更新数据
     */
    async fetchAndUpdateData() {
        try {
            const responseData = await DataService.fetchAllData();
            const { dataStatistics, stockDataList } = responseData.data;

            // 保存统计数据
            AppState.currentStatistics = dataStatistics;

            // 更新UI
            this.updateUI(dataStatistics, stockDataList);

            // 更新网络状态
            AppState.networkStatus = "online";
            UIRenderer.updateNetworkStatus("online");

            // 保存数据供下次对比
            AppState.previousData = stockDataList || [];

            // 首次加载完成
            if (AppState.isFirstLoad) {
                AppState.isFirstLoad = false;
            }
        } catch (error) {
            console.error("获取数据失败:", error);

            // 更新网络状态
            AppState.networkStatus = "offline";
            UIRenderer.updateNetworkStatus("offline");

            // 只有在没有任何数据时才显示错误信息
            if (!AppState.previousData || AppState.previousData.length === 0) {
                UIRenderer.showError(error.message);
            }
        }
    },

    /**
     * 更新UI
     */
    updateUI(statistics, stockDataList) {
        // 更新最后更新时间
        UIRenderer.updateLastUpdateTime(statistics.lastUpdateTime);

        // 更新数据计数 - 使用实际的股票列表长度
        const dataCount = stockDataList ? stockDataList.length : 0;
        UIRenderer.updateDataCount(dataCount);

        // 准备当前统计数据
        const currentStats = {
            marketTrend: statistics.marketTrend,
            m5Percent: (statistics.m5Percent * 100).toFixed(2),
            m10Percent: (statistics.m10Percent * 100).toFixed(2),
            m20Percent: (statistics.m20Percent * 100).toFixed(2),
            maMeanPercent: (statistics.maMeanPercent * 100).toFixed(2),
            growthStockCount: statistics.growthStockCount,
            totalStockCount: statistics.totalStockCount,
        };

        // 检测统计数据变化
        const changedStats = DataProcessor.detectStatChanges(
            currentStats,
            AppState.previousStats,
            AppState.isFirstLoad
        );

        // 更新统计信息卡片
        UIRenderer.updateStatsGrid(statistics, changedStats);

        // 保存当前统计数据供下次对比
        AppState.previousStats = currentStats;

        // 渲染表格 - 格式化大盘趋势
        const marketTrend =
            DataFormatter.formatBuySellSignal(statistics.marketTrend) || "卖";
        UIRenderer.renderTable(
            stockDataList,
            AppState.sortColumn,
            AppState.sortDirection,
            marketTrend,
            AppState.previousData,
            AppState.isFirstLoad
        );
    },
};

// ========== 应用启动 ==========
document.addEventListener("DOMContentLoaded", () => {
    App.init();
});
