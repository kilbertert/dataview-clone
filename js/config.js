// 全局前端配置（后端/前端约定的基础 API 前缀）
// 本文件应在所有依赖接口请求的脚本之前加载。

/**
 * 后端 API 基础地址
 * - 本地开发：直接访问 localhost:8000
 * - 线上环境：通过 Nginx 或网关转发到 /api
 */
const BASE_API_URL = `${window.location.origin}/api`;
