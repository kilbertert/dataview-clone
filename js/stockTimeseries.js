// ========== 时间序列数据服务层 ==========
const TimeSeriesDataService = {
    /**
     * 获取时间序列数据
     */
    async fetchTimeSeriesData(startTime, endTime, page, size) {
        const params = new URLSearchParams();
        if (startTime) params.append("startTime", startTime);
        if (endTime) params.append("endTime", endTime);
        params.append("page", page);
        params.append("size", size);

        const response = await fetch(
            `${BASE_API_URL}/dataApi/getTimeSeriesData?${params.toString()}`
        );
        if (!response.ok) {
            throw new Error(`HTTP错误: ${response.status}`);
        }
        return await response.json();
    },
};

// ========== 时间序列格式化层 ==========
const TimeSeriesFormatter = {
    formatPercent(value) {
        return CommonFormatter.formatPercent(value);
    },

    formatTime(timeStr) {
        return CommonFormatter.formatTime(timeStr);
    },

    formatBuySellSignal(signal) {
        return CommonFormatter.formatBuySellSignal(signal);
    },

    formatBoolean(value) {
        return CommonFormatter.formatBooleanPercent(value);
    },

    /**
     * 根据总分计算买卖信号
     */
    calculateBuySellSignal(totalScore) {
        if (totalScore === null || totalScore === undefined) return "卖";
        return totalScore <= 2 ? "卖" : "买";
    },

    /**
     * 买卖信号样式类
     */
    getSignalClass(signal) {
        if (!signal) return "";
        return signal === "买" ? "signal-buy" : "signal-sell";
    },

    /**
     * 百分比样式类
     */
    getPercentClass(value) {
        if (value === null || value === undefined) return "";
        return value >= 0.5 ? "percent-high" : "percent-low";
    },

    /**
     * 布尔值样式类
     */
    getBooleanClass(value) {
        if (value === null || value === undefined) return "";
        return value ? "boolean-true" : "boolean-false";
    },

    /**
     * 总分样式类
     */
    getScoreClass(score) {
        if (score === null || score === undefined) return "";
        return score >= 3 ? "score-high" : "score-low";
    },
};

// ========== 时间序列UI渲染层 ==========
const TimeSeriesUIRenderer = {
    /**
     * 更新网络状态
     */
    updateNetworkStatus(status) {
        const el = document.getElementById("networkStatus");
        if (el) el.className = `network-status ${status}`;
    },

    /**
     * 更新最后更新时间
     */
    updateLastUpdateTime(timeStr) {
        const el = document.getElementById("lastUpdate");
        if (el) el.textContent = `最后更新: ${TimeSeriesFormatter.formatTime(timeStr)}`;
    },

    /**
     * 渲染时间序列表格
     * 列 = 时间点, 行 = 产品(ETF)
     */
    renderTable(data) {
        const tableHead = document.getElementById("tableHead");
        const tableBody = document.getElementById("tableBody");
        const loadingDiv = document.getElementById("loadingDiv");
        const errorDiv = document.getElementById("errorDiv");
        const noDataDiv = document.getElementById("noDataDiv");
        const table = document.getElementById("timeseriesTable");

        if (loadingDiv) loadingDiv.style.display = "none";
        if (errorDiv) errorDiv.style.display = "none";

        if (!data || !data.timePoints || data.timePoints.length === 0 ||
            !data.products || data.products.length === 0) {
            if (table) table.style.display = "none";
            if (noDataDiv) noDataDiv.style.display = "block";
            document.getElementById("timeColumnCount").textContent = "0";
            document.getElementById("productRowCount").textContent = "0";
            return;
        }

        if (table) table.style.display = "table";
        if (noDataDiv) noDataDiv.style.display = "none";

        // Update counters
        document.getElementById("timeColumnCount").textContent = data.timePoints.length;
        document.getElementById("productRowCount").textContent = data.products.length;

        // Build header: fixed col + time columns
        const headerRow = document.createElement("tr");
        headerRow.innerHTML = `<th class="fixed-col">产品</th>` +
            data.timePoints.map(tp => `<th class="time-col">${TimeSeriesFormatter.formatTime(tp)}</th>`).join("");
        tableHead.innerHTML = "";
        tableHead.appendChild(headerRow);

        // Build body: one row per product
        tableBody.innerHTML = data.products.map(product => {
            const cells = data.timePoints.map(tp => {
                const record = (data.records || []).find(
                    r => r.etfCode === product.etfCode && r.createTime === tp
                );
                if (!record) return `<td class="data-cell"><div class="data-cell-compact"><span style="color:#ccc">-</span></div></td>`;

                const signal = TimeSeriesFormatter.calculateBuySellSignal(record.totalScore);
                const signalClass = TimeSeriesFormatter.getSignalClass(signal);
                const scoreClass = TimeSeriesFormatter.getScoreClass(record.totalScore);

                return `<td class="data-cell">
                  <div class="data-cell-compact">
                    <div class="data-line">
                      <span class="data-label">总分</span>
                      <span class="data-value ${scoreClass}">${record.totalScore ?? "-"}</span>
                      <span class="data-value ${signalClass}">${signal}</span>
                    </div>
                    <div class="data-line">
                      <span class="data-label">M0</span>
                      <span class="data-value ${TimeSeriesFormatter.getPercentClass(record.m0Percent)}">${TimeSeriesFormatter.formatPercent(record.m0Percent)}</span>
                    </div>
                    <div class="data-line">
                      <span class="data-label">M5</span>
                      <span class="data-value ${TimeSeriesFormatter.getPercentClass(record.m5Percent)}">${TimeSeriesFormatter.formatPercent(record.m5Percent)}</span>
                    </div>
                    <div class="data-line">
                      <span class="data-label">M10</span>
                      <span class="data-value ${TimeSeriesFormatter.getPercentClass(record.m10Percent)}">${TimeSeriesFormatter.formatPercent(record.m10Percent)}</span>
                    </div>
                    <div class="data-line">
                      <span class="data-label">M20</span>
                      <span class="data-value ${TimeSeriesFormatter.getPercentClass(record.m20Percent)}">${TimeSeriesFormatter.formatPercent(record.m20Percent)}</span>
                    </div>
                    <div class="data-line">
                      <span class="data-label">Ma均</span>
                      <span class="data-value ${TimeSeriesFormatter.getPercentClass(record.maMeanRatio)}">${TimeSeriesFormatter.formatPercent(record.maMeanRatio)}</span>
                    </div>
                    <div class="data-line">
                      <span class="data-label">5日</span>
                      <span class="data-value ${TimeSeriesFormatter.getBooleanClass(record.greaterThanM5Price)}">${TimeSeriesFormatter.formatBoolean(record.greaterThanM5Price)}</span>
                      <span class="data-label">10日</span>
                      <span class="data-value ${TimeSeriesFormatter.getBooleanClass(record.greaterThanM10Price)}">${TimeSeriesFormatter.formatBoolean(record.greaterThanM10Price)}</span>
                      <span class="data-label">20日</span>
                      <span class="data-value ${TimeSeriesFormatter.getBooleanClass(record.greaterThanM20Price)}">${TimeSeriesFormatter.formatBoolean(record.greaterThanM20Price)}</span>
                    </div>
                  </div>
                </td>`;
            }).join("");

            return `<tr>
              <td class="fixed-col">
                <div class="product-info">
                  <div class="product-code">${product.etfCode}</div>
                  <div class="product-name">${product.etfName || "-"}</div>
                  <div class="product-industry">${product.industry || "-"}</div>
                </div>
              </td>
              ${cells}
            </tr>`;
        }).join("");
    },

    /**
     * 渲染分页控件
     */
    renderPagination(pagination, onPageChange, onSizeChange) {
        const paginationDiv = document.getElementById("paginationDiv");
        if (!paginationDiv) return;

        const { page, size, total, totalPages } = pagination;
        const start = total === 0 ? 0 : (page - 1) * size + 1;
        const end = Math.min(page * size, total);

        paginationDiv.style.display = "flex";
        paginationDiv.innerHTML = `
          <div class="pagination-info">共 ${total} 条记录，显示 ${start}-${end} 条</div>
          <div class="pagination-controls">
            <button class="pagination-btn" onclick="(${onPageChange.toString()})(1)" ${page <= 1 ? "disabled" : ""}>首页</button>
            <button class="pagination-btn" onclick="(${onPageChange.toString()})(${page - 1})" ${page <= 1 ? "disabled" : ""}>上一页</button>
            <span class="pagination-page-info">第 ${page} / ${totalPages} 页</span>
            <button class="pagination-btn" onclick="(${onPageChange.toString()})(${page + 1})" ${page >= totalPages ? "disabled" : ""}>下一页</button>
            <button class="pagination-btn" onclick="(${onPageChange.toString()})(${totalPages})" ${page >= totalPages ? "disabled" : ""}>末页</button>
            <div class="pagination-size">
              <label>每页显示:</label>
              <select class="page-size-select" onchange="(${onSizeChange.toString()})(parseInt(this.value))">
                ${[10, 20, 50, 100].map(s => `<option value="${s}" ${s === size ? "selected" : ""}>${s}</option>`).join("")}
              </select>
            </div>
          </div>
        `;
    },

    /**
     * 显示错误信息
     */
    showError(message) {
        const errorDiv = document.getElementById("errorDiv");
        const loadingDiv = document.getElementById("loadingDiv");
        const table = document.getElementById("timeseriesTable");

        if (errorDiv) {
            errorDiv.textContent = `获取数据失败: ${message}`;
            errorDiv.style.display = "block";
        }
        if (loadingDiv) loadingDiv.style.display = "none";
        if (table) table.style.display = "none";
    },

    showLoading() {
        const loadingDiv = document.getElementById("loadingDiv");
        const errorDiv = document.getElementById("errorDiv");
        const table = document.getElementById("timeseriesTable");
        const noDataDiv = document.getElementById("noDataDiv");

        if (loadingDiv) loadingDiv.style.display = "block";
        if (errorDiv) errorDiv.style.display = "none";
        if (table) table.style.display = "none";
        if (noDataDiv) noDataDiv.style.display = "none";
    },
};

// ========== 应用状态 ==========
const TimeSeriesState = {
    currentPage: 1,
    pageSize: 10,
    startTime: null,
    endTime: null,
};

// ========== 主逻辑函数（供 HTML onclick 调用） ==========

/**
 * 查询数据
 */
async function fetchData() {
    const startInput = document.getElementById("startTime").value;
    const endInput = document.getElementById("endTime").value;

    TimeSeriesState.startTime = startInput
        ? startInput.replace("T", " ") + ":00"
        : null;
    TimeSeriesState.endTime = endInput
        ? endInput.replace("T", " ") + ":00"
        : null;
    TimeSeriesState.currentPage = 1;

    await loadData();
}

/**
 * 重置时间范围并重新加载
 */
function resetTimeRange() {
    document.getElementById("startTime").value = "";
    document.getElementById("endTime").value = "";
    TimeSeriesState.startTime = null;
    TimeSeriesState.endTime = null;
    TimeSeriesState.currentPage = 1;
    loadData();
}

/**
 * 导出 Excel（简单 CSV 下载实现）
 */
async function exportExcel() {
    try {
        const result = await TimeSeriesDataService.fetchTimeSeriesData(
            TimeSeriesState.startTime,
            TimeSeriesState.endTime,
            1,
            10000
        );
        const { timePoints, products, records } = result.data;

        // Build CSV header
        const headers = ["ETF代码", "名称", "行业", ...timePoints.map(tp =>
            TimeSeriesFormatter.formatTime(tp) + "_总分"
        )];
        const rows = [headers.join(",")];

        products.forEach(product => {
            const row = [product.etfCode, product.etfName || "", product.industry || ""];
            timePoints.forEach(tp => {
                const record = (records || []).find(
                    r => r.etfCode === product.etfCode && r.createTime === tp
                );
                row.push(record ? (record.totalScore ?? "") : "");
            });
            rows.push(row.map(v => `"${v}"`).join(","));
        });

        const blob = new Blob(["\uFEFF" + rows.join("\n")], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `时间序列数据_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    } catch (error) {
        alert("导出失败: " + error.message);
    }
}

/**
 * 加载并渲染时间序列数据
 */
async function loadData() {
    TimeSeriesUIRenderer.showLoading();
    try {
        const result = await TimeSeriesDataService.fetchTimeSeriesData(
            TimeSeriesState.startTime,
            TimeSeriesState.endTime,
            TimeSeriesState.currentPage,
            TimeSeriesState.pageSize
        );
        const { data, pagination, lastUpdateTime } = result;

        TimeSeriesUIRenderer.updateNetworkStatus("online");
        if (lastUpdateTime) {
            TimeSeriesUIRenderer.updateLastUpdateTime(lastUpdateTime);
        }

        TimeSeriesUIRenderer.renderTable(data);
        if (pagination) {
            TimeSeriesUIRenderer.renderPagination(
                pagination,
                (page) => {
                    TimeSeriesState.currentPage = page;
                    loadData();
                },
                (size) => {
                    TimeSeriesState.pageSize = size;
                    TimeSeriesState.currentPage = 1;
                    loadData();
                }
            );
        }
    } catch (error) {
        console.error("获取时间序列数据失败:", error);
        TimeSeriesUIRenderer.updateNetworkStatus("offline");
        TimeSeriesUIRenderer.showError(error.message);
    }
}

// ========== 页面初始化 ==========
document.addEventListener("DOMContentLoaded", () => {
    // 默认加载最近7天数据
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const toLocal = (d) => {
        const pad = (n) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    document.getElementById("startTime").value = toLocal(weekAgo);
    document.getElementById("endTime").value = toLocal(now);

    TimeSeriesState.startTime = weekAgo.toISOString().slice(0, 19).replace("T", " ");
    TimeSeriesState.endTime = now.toISOString().slice(0, 19).replace("T", " ");

    loadData();
});
