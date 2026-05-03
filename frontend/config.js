// 大白课堂配置
// 使用前请修改此文件中的地址为你的实际服务器地址

const config = {
  // OpenMAIC 地址（用于自动导入）
  // 示例: 'http://192.168.1.100:3000' 或 'https://openmaic.example.com'
  OPENMAIC_URL: 'http://localhost:3000',

  // Classroom API 地址
  // 如果前端和后端在同一服务器，用当前域名即可
  API_BASE: '',  // 空字符串表示使用相对路径（推荐）

  // 课件上传大小限制（MB）
  MAX_UPLOAD_SIZE: 200,
};

// 兼容前端直接引用（无需模块系统）
if (typeof window !== 'undefined') {
  window.config = config;
}
