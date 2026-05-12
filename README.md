# OpenMAIC Classroom - 课件分发插件

本项目是 [OpenMAIC](https://github.com/THU-MAIC/OpenMAIC) 的配套课件分发插件，由作者独立开发，遵循 MIT 协议开源分发。OpenMAIC 版权归其原作者所有。

> **用途**：在 OpenMAIC 本地部署后，解决教师生成的课程无法分发、学生无法浏览的问题。

**作者声明**：本项目为自制开发，已在本地环境跑通。由于不同用户的服务器环境差异较大，部署过程中可能需要根据实际情况微调配置。如有问题，欢迎联系作者。

---

## 前置条件（请务必先阅读）

### 1. 已本地部署 OpenMAIC

- OpenMAIC 源码：https://github.com/THU-MAIC/OpenMAIC
- **必须包含 `/open` 自动导入插件**（OpenMAIC 自带的插件，用于学生端自动导入课程）
- **确认方式**：访问 `http://你的服务器IP:3000/open` 能看到导入页面即表示已包含

**关于部署位置的关系**：

本插件和 OpenMAIC **可以部署在同一台服务器，也可以在不同服务器**。它们通过 HTTP 协议通信，只要网络互通即可。

| 场景 | OpenMAIC 地址 | 本插件地址 | 说明 |
|------|---------------|-----------|------|
| **同一台服务器**（推荐） | `http://192.168.1.100:3000` | `http://192.168.1.100:80/classroom/` | 共用 Nginx，通过不同路径区分 |
| **不同服务器** | `http://192.168.1.100:3000` | `http://192.168.1.101:80/classroom/` | 插件服务器需要能访问 OpenMAIC 的 `/open` 接口 |

**注意**：以下所有示例假设 OpenMAIC 和本插件部署在**同一台服务器**，IP 为 `192.168.1.100`，请替换为你的实际 IP。

---

### 2. Docker + Docker Compose（推荐部署方式）

远程服务器强烈建议使用 Docker 部署，原因：
- 环境隔离，避免和宿主机的 Node.js/PHP 等版本冲突
- 便于迁移和备份
- 学生使用时稳定性更高

**如果不用 Docker**：
- 需要服务器已安装 Node.js 20+ 和 Nginx
- 后端直接运行 `node server.js`
- 前端文件放到 Nginx 的 web 目录下
- 详细步骤见下方"方式二：手动部署"

---

## 快速开始

### 方式一：Docker Compose 部署（强烈推荐，特别是远程服务器）

#### 第 1 步：准备 Docker 镜像（无外网环境必读）

如果你的服务器**无法访问 Docker Hub**（无外网或下载慢），需要提前准备镜像：

**在一台有外网的机器上执行：**

```bash
# 拉取 Classroom 需要的镜像
docker pull nginx:alpine
docker pull node:20-alpine

# 保存为 tar 文件（传到你服务器的 docker-data/ 目录）
docker save nginx:alpine | gzip > nginx-image.tar.gz
docker save node:20-alpine | gzip > node-image.tar.gz
```

**在目标服务器上加载：**

```bash
cd docker-data/
zcat nginx-image.tar.gz | docker load
zcat node-image.tar.gz | docker load
```

#### 第 2 步：克隆仓库

```bash
git clone https://github.com/laofeng-allen/openmaic-classroom.git
cd openmaic-classroom
```

#### 第 3 步：修改配置（唯一必须修改的文件）

```bash
vim frontend/config.js
```

**修改内容示例**（假设你的服务器 IP 是 192.168.1.100）：

```javascript
const config = {
  // OpenMAIC 地址（学生点击"进入课程"时，会跳转到这个地址的 /open 页面自动导入）
  // ⚠️ 必须修改！改成你的 OpenMAIC 实际访问地址
  OPENMAIC_URL: 'http://192.168.1.100:3000',
  
  // API 地址（前端调用后端接口用）
  // 空字符串 = 使用相对路径（推荐，配合 Nginx 代理）
  API_BASE: '',
};
```

**常见问题**：
- Q: OpenMAIC 也在 Docker 里，怎么填地址？
- A: 填宿主机的 IP + 映射端口。例如 OpenMAIC 容器映射了 `3000:3000`，就填 `http://宿主机IP:3000`

#### 第 4 步：启动服务

```bash
docker compose up -d
```

#### 第 5 步：配置 Nginx 反向代理（重点！）

Docker 启动后，插件的后端 API 运行在容器的 5000 端口，前端是静态文件。需要通过 Nginx 统一暴露到 80 端口。

**Nginx 配置示例**（`nginx/nginx.conf`，这是本项目的核心配置）：

```nginx
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    server {
        listen 80;
        server_name _;
        
        # 上传文件大小限制（课件可能很大）
        client_max_body_size 200M;

        # 1. 主页（学习平台入口）
        location / {
            root /usr/share/nginx/html;
            index index.html;
        }

        # 2. 课件分发插件 API（必须在 /classroom/ 之前）
        location /classroom/api/ {
            proxy_pass http://172.17.0.1:5000/api/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }

        # 3. 课件分发插件前端页面
        location /classroom/ {
            alias /usr/share/nginx/html/classroom/;
            try_files $uri $uri/ =404;
            index index.html;
        }
    }
}
```

**如果你在同一台服务器上还部署了 Moodle**（可选），在上述配置基础上增加：

```nginx
        # Moodle 学习管理系统（可选，如已部署 Moodle 则添加）
        location /moodle/ {
            proxy_pass http://172.17.0.1:8080/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
```

**关键说明**：
- `172.17.0.1` 是 Docker 默认网桥的宿主机 IP（如果你的 Docker 网络不同，用 `docker network inspect bridge` 查看 Gateway）
- `/classroom/api/` 必须排在 `/classroom/` **前面**，否则 Nginx 会把 API 请求也当成静态文件处理
- `client_max_body_size 200M` 允许上传大课件

#### 第 6 步：访问

假设你的服务器 IP 是 `192.168.1.100`：

| 页面 | 访问地址 | 用途 |
|------|---------|------|
| 教师上传页 | `http://192.168.1.100/classroom/upload.html` | 教师上传课件 |
| 学生浏览页 | `http://192.168.1.100/classroom/` | 学生浏览课程列表 |
| OpenMAIC | `http://192.168.1.100:3000` | 生成课件、导入学习 |

---

### 方式二：手动部署（不用 Docker）

适合：已有 Node.js 和 Nginx 环境，或想直接调试代码。

```bash
# 1. 进入后端目录
cd backend

# 2. 启动 API 服务（后端没有额外 npm 依赖，直接运行即可）
PORT=5000 \
UPLOAD_FOLDER=./courses \
DATA_FILE=./data/courses.json \
node server.js

# 3. 在另一个终端，将 frontend/ 目录放到 Nginx 的 web 根目录
# 例如：sudo cp -r frontend/* /var/www/html/classroom/

# 4. 配置 Nginx（参考上面的 nginx.conf）
# 注意 proxy_pass 要指向 node server.js 运行的地址，例如 http://localhost:5000
```

---

## 配置说明

### `frontend/config.js`（必需修改）

```javascript
const config = {
  // OpenMAIC 地址（学生自动导入用）
  // ⚠️ 请替换为你的实际 OpenMAIC 服务器地址
  // 示例1：同一台服务器 -> 'http://192.168.1.100:3000'
  // 示例2：不同服务器   -> 'http://10.0.0.5:3000'
  OPENMAIC_URL: 'http://localhost:3000',
  
  // API 地址（一般不用改，配合 Nginx 相对路径即可）
  API_BASE: '',
};
```

### 后端环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `5000` | API 端口 |
| `UPLOAD_FOLDER` | `./courses` | 课件存储路径 |
| `DATA_FILE` | `./data/courses.json` | 课件索引数据库 |
| `TEMP_DIR` | `/tmp/classroom-upload` | 上传临时目录 |

---

## 目录结构

```
openmaic-classroom/
├── frontend/           # 前端页面（教师上传 + 学生浏览）
│   ├── config.js       # ⚠️ 必须修改的配置文件
│   ├── index.html      # 课程列表页（学生入口）
│   ├── upload.html     # 上传页面（教师入口）
│   └── viewer.html     # 备用播放页（可选）
├── backend/            # 后端 API
│   ├── server.js       # API 服务端
│   └── start.sh        # 启动脚本
├── nginx/
│   └── nginx.conf      # Nginx 反向代理配置示例
├── docker-compose.yml  # Docker 部署配置
├── LICENSE             # MIT 协议
└── README.md           # 本文件
```

---

## 使用流程（举例说明）

### 场景：王老师要给学生分发《蚕的一生》课件

**Step 1 - 教师生成课件（在 OpenMAIC 中）**
1. 王老师打开 `http://192.168.1.100:3000`（OpenMAIC）
2. 使用 OpenMAIC 的 AI 功能生成《蚕的一生》课件
3. 点击"导出"，下载两个文件：
   - `蚕的一生.maic.zip`（课件资源包）
   - `蚕的一生_course.zip`（课程配置文件）

**Step 2 - 教师上传课件（在 Classroom 插件中）**
1. 王老师打开 `http://192.168.1.100/classroom/upload.html`
2. 填写课程信息：
   - 课程名称：蚕的一生
   - 学科：小学科学
   - 年级：三年级
   - 场景数：8
3. 上传刚才下载的两个 zip 文件
4. 点击"发布课程"

**Step 3 - 学生浏览课程（在 Classroom 插件中）**
1. 学生打开 `http://192.168.1.100/classroom/`
2. 看到课程列表中有《蚕的一生》
3. 点击进入，自动跳转到 OpenMAIC 的 `/open` 导入页面
4. 学生下载课件到本地，导入浏览器 IndexedDB
5. 打开课程开始学习

---

## 安全建议

- **生产环境强烈建议使用 HTTPS**
- Nginx 已限制上传 200MB，如需更大请修改 `client_max_body_size`
- 定期备份 `UPLOAD_FOLDER` 目录和 `DATA_FILE`
- 远程服务器建议配置防火墙，仅开放必要端口（80/443/3000）

---

## 故障排查

| 问题 | 可能原因 | 解决方法 |
|------|---------|---------|
| 访问 `/classroom/` 404 | Nginx 未配置或路径错误 | 检查 nginx.conf 中的 `alias` 路径 |
| 上传失败 | 文件太大或 API 未启动 | 检查 `client_max_body_size`，确认后端容器运行中 |
| 点击课程后无法导入 | `config.js` 中 `OPENMAIC_URL` 填错 | 确认填的是 OpenMAIC 的**宿主机 IP+端口**，不是 `localhost` |
| Docker 拉取镜像失败 | 服务器无外网 | 参考上方"准备 Docker 镜像"，在有外网的机器下载后传输 |
| Moodle 安装缓慢 | 机械硬盘 I/O 瓶颈 | 正常现象，首次安装需创建数百张表，耐心等待 10-30 分钟 |

---

## 📄 License

MIT License

Copyright (c) 2026 老风的大白盒子

本项目是 [OpenMAIC](https://github.com/THU-MAIC/OpenMAIC) 的配套课件分发插件。
OpenMAIC 版权归其原作者所有。

---

## 📧 联系作者

如有问题或建议，欢迎联系：

**邮箱**：[2036146@qq.com](mailto:2036146@qq.com)

**GitHub Issues**：https://github.com/laofeng-allen/openmaic-classroom/issues

> 本项目为个人自制开发，已在本地环境验证。由于服务器环境差异，部署过程中如有问题，请联系作者或提交 Issue，会尽力协助解决。

---

*开源不易，如有帮助请点个 ⭐ Star，谢谢！* 🎓
