# 大白课堂 - Classroom 课件分发系统

> 与 OpenMAIC 配合使用的课件上传、管理和学生自动导入系统。

## 🎯 适用场景

- 老师在 OpenMAIC 生成 AI 互动课程
- 导出 `.maic.zip` 上传到 Classroom
- 学生点击课程即可自动导入到本地 OpenMAIC 学习

## 📦 前置条件

1. **已部署 OpenMAIC**（用于生成课件和学生导入）
   - 需要包含 `/open` 自动导入插件
   - 访问地址如：`http://你的IP:3000`

2. **Docker + Docker Compose**（推荐）
   - 或 Node.js 20+（手动部署）

## 🚀 快速开始

### 方式一：Docker Compose（推荐）

```bash
# 1. 克隆仓库
git clone https://github.com/yourname/classroom-distribution.git
cd classroom-distribution

# 2. 配置（唯一需要修改的文件）
vim frontend/config.js
# 修改 OPENMAIC_URL 为你的 OpenMAIC 地址

# 3. 一键启动
docker compose up -d

# 4. 访问 http://你的服务器IP/classroom/
```

### 方式二：手动部署

```bash
# 1. 后端
cd backend
npm install  # 如需额外依赖

# 2. 配置数据目录
mkdir -p /your/data/dir

# 3. 启动 API
PORT=5000 \
UPLOAD_FOLDER=/your/data/dir/courses \
DATA_FILE=/your/data/dir/courses.json \
node server.js

# 4. 配置 Nginx 代理 /classroom/api/ 到后端
# 参考 nginx/nginx.conf

# 5. 将 frontend/ 目录放到 web 服务器
```

## ⚙️ 配置说明

### `frontend/config.js`（必需修改）

```javascript
const config = {
  // OpenMAIC 地址（学生自动导入用）
  OPENMAIC_URL: 'http://192.168.1.100:3000',
  
  // API 地址（一般不用改）
  API_BASE: '',  // 空字符串 = 使用相对路径
};
```

### 后端环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | 5000 | API 端口 |
| `UPLOAD_FOLDER` | `/home/lf/docker-data/classroom/courses` | 课件存储 |
| `DATA_FILE` | `/home/lf/docker-data/classroom/data/courses.json` | 课件索引 |
| `TEMP_DIR` | `/tmp/classroom-upload` | 临时目录 |

## 📁 目录结构

```
classroom-distribution/
├── frontend/
│   ├── config.js       # ⚠️ 配置文件
│   ├── index.html      # 课程列表
│   ├── upload.html     # 上传页面
│   └── viewer.html     # 播放页面（可选）
├── backend/
│   ├── server.js       # API 服务端
│   └── start.sh        # 启动脚本
├── nginx/
│   └── nginx.conf      # 反向代理配置
├── docker-compose.yml  # Docker 部署
└── README.md           # 本文件
```

## 🔐 安全建议

- 生产环境使用 HTTPS
- Nginx 已限制上传 200MB
- 定期备份 `UPLOAD_FOLDER` 目录和 `DATA_FILE`

## 🤝 与 OpenMAIC 的关系

```
老师端: OpenMAIC → 生成课程 → 导出 .maic.zip
                ↓
         Classroom 上传页面
                ↓
学生端: Classroom 列表页 → 点击课程
                ↓
         跳转 OpenMAIC /open 自动导入
                ↓
         下载 → 导入 IndexedDB → 打开课程
```

## 📄 License

MIT

---

*大白盒子出品* 🎓
