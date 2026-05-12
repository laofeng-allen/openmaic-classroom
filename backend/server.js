const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { exec } = require('child_process');

// 配置（支持环境变量）
const PORT = process.env.PORT || 5000;
const UPLOAD_FOLDER = process.env.UPLOAD_FOLDER || './courses';
const DATA_FILE = process.env.DATA_FILE || './data/courses.json';
const TEMP_DIR = process.env.TEMP_DIR || '/tmp/classroom-upload';

// 确保目录存在
if (!fs.existsSync(UPLOAD_FOLDER)) fs.mkdirSync(UPLOAD_FOLDER, { recursive: true });
if (!fs.existsSync(path.dirname(DATA_FILE))) fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

// 加载课件列表
function loadCourses() {
    if (fs.existsSync(DATA_FILE)) {
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
    return [];
}

// 保存课件列表
function saveCourses(courses) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(courses, null, 2), 'utf8');
}

// 生成唯一 ID
function generateId() {
    return Math.random().toString(36).substring(2, 10);
}

// 解析 multipart form data
function parseMultipart(req, callback) {
    const contentType = req.headers['content-type'];
    if (!contentType || !contentType.includes('multipart/form-data')) {
        callback(new Error('Invalid content type'));
        return;
    }

    const boundary = contentType.split('boundary=')[1];
    if (!boundary) {
        callback(new Error('No boundary'));
        return;
    }

    let body = Buffer.alloc(0);
    req.on('data', chunk => {
        body = Buffer.concat([body, chunk]);
    });

    req.on('end', () => {
        const parts = [];
        const boundaryBuffer = Buffer.from(`--${boundary}`);
        let start = body.indexOf(boundaryBuffer);
        
        while (start !== -1) {
            let end = body.indexOf(boundaryBuffer, start + boundaryBuffer.length);
            if (end === -1) break;
            
            const part = body.slice(start + boundaryBuffer.length, end);
            const headerEnd = part.indexOf('\r\n\r\n');
            
            if (headerEnd !== -1) {
                const header = part.slice(0, headerEnd).toString();
                const data = part.slice(headerEnd + 4, part.length - 2); // -2 for \r\n
                
                const nameMatch = header.match(/name="([^"]+)"/);
                const filenameMatch = header.match(/filename="([^"]+)"/);
                
                if (nameMatch) {
                    parts.push({
                        name: nameMatch[1],
                        filename: filenameMatch ? filenameMatch[1] : null,
                        data: data
                    });
                }
            }
            
            start = end;
        }
        
        callback(null, parts);
    });
}

// 解压 ZIP
function extractZip(zipPath, targetDir, callback) {
    exec(`unzip -o "${zipPath}" -d "${targetDir}"`, (err, stdout, stderr) => {
        if (err) {
            callback(err);
            return;
        }
        callback(null);
    });
}

// 处理上传
function handleUpload(req, res) {
    parseMultipart(req, (err, parts) => {
        if (err) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
            return;
        }

        // 提取表单字段
        const title = parts.find(p => p.name === 'title')?.data.toString().trim() || '';
        const description = parts.find(p => p.name === 'description')?.data.toString().trim() || '';
        
        if (!title) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: '请填写课件标题' }));
            return;
        }

        // 查找 ZIP 文件
        const maicZip = parts.find(p => p.name === 'maicZip' && p.filename);
        const resourceZip = parts.find(p => p.name === 'resourceZip' && p.filename);

        if (!maicZip) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: '请上传 .maic.zip 文件' }));
            return;
        }

        const courseId = generateId();
        const courseDir = path.join(UPLOAD_FOLDER, courseId);
        fs.mkdirSync(courseDir, { recursive: true });

        // 保存 .maic.zip
        const maicPath = path.join(courseDir, '_maic.zip');
        fs.writeFileSync(maicPath, maicZip.data);

        // 解压 .maic.zip
        extractZip(maicPath, courseDir, (err) => {
            if (err) {
                // 清理
                exec(`rm -rf "${courseDir}"`);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: '解压 .maic.zip 失败: ' + err.message }));
                return;
            }

            // 保留原始 ZIP 文件（用于自动导入）
            // fs.unlinkSync(maicPath);

            // 读取 manifest
            const manifestPath = path.join(courseDir, 'manifest.json');
            if (!fs.existsSync(manifestPath)) {
                exec(`rm -rf "${courseDir}"`);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: '无效的 .maic.zip 文件' }));
                return;
            }

            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            const scenes = manifest.scenes || [];

            // 统计
            const slideCount = scenes.filter(s => s.type === 'slide').length;
            const interactiveCount = scenes.filter(s => s.type === 'interactive').length;
            const quizCount = scenes.filter(s => s.type === 'quiz').length;
            
            const audioDir = path.join(courseDir, 'audio');
            const audioCount = fs.existsSync(audioDir) ? 
                fs.readdirSync(audioDir).filter(f => f.endsWith('.wav')).length : 0;

            // 处理教学资源包
            if (resourceZip) {
                const resourcePath = path.join(courseDir, '_resource.zip');
                fs.writeFileSync(resourcePath, resourceZip.data);
                
                const tempResourceDir = path.join(courseDir, '_temp_resource');
                fs.mkdirSync(tempResourceDir, { recursive: true });
                
                extractZip(resourcePath, tempResourceDir, (err) => {
                    if (!err) {
                        const interactiveSource = path.join(tempResourceDir, 'interactive');
                        if (fs.existsSync(interactiveSource)) {
                            const interactiveTarget = path.join(courseDir, 'interactive');
                            if (!fs.existsSync(interactiveTarget)) {
                                fs.mkdirSync(interactiveTarget, { recursive: true });
                            }
                            
                            // 复制互动页面
                            fs.readdirSync(interactiveSource).forEach(item => {
                                const src = path.join(interactiveSource, item);
                                const tgt = path.join(interactiveTarget, item);
                                if (!fs.existsSync(tgt)) {
                                    fs.copyFileSync(src, tgt);
                                }
                            });
                        }
                    }
                    
                    // 清理
                    if (fs.existsSync(resourcePath)) fs.unlinkSync(resourcePath);
                    exec(`rm -rf "${tempResourceDir}"`);
                });
            }

            // 创建课程信息
            const courseInfo = {
                id: courseId,
                title: title,
                description: description,
                manifest_title: manifest.stage?.name || title,
                slide_count: slideCount,
                interactive_count: interactiveCount,
                quiz_count: quizCount,
                audio_count: audioCount,
                scene_count: scenes.length,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            // 保存到列表
            const courses = loadCourses();
            courses.push(courseInfo);
            saveCourses(courses);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                course: courseInfo,
                message: '课件上传成功！'
            }));
        });
    });
}

// 创建服务器
const server = http.createServer((req, res) => {
    // 设置 CORS 头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    
    // 调试日志
    console.log(`[${new Date().toISOString()}] ${req.method} ${pathname}`);

    // 路由
    if (pathname === '/api/courses' && req.method === 'GET') {
        // 获取课件列表
        const courses = loadCourses();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, courses: courses }));
        
    } else if (pathname === '/api/upload' && req.method === 'POST') {
        // 上传课件
        handleUpload(req, res);
        
    } else if (pathname.startsWith('/api/courses/') && req.method === 'DELETE') {
        // 删除课件
        const courseId = pathname.split('/')[3];
        const courseDir = path.join(UPLOAD_FOLDER, courseId);
        
        if (fs.existsSync(courseDir)) {
            exec(`rm -rf "${courseDir}"`);
        }
        
        const courses = loadCourses().filter(c => c.id !== courseId);
        saveCourses(courses);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: '课件已删除' }));
        
    } else if (pathname.startsWith('/api/courses/') && pathname.endsWith('/download') && req.method === 'GET') {
        // 下载课件 ZIP
        const parts = pathname.split('/');
        const courseId = parts[3];
        const courseDir = path.join(UPLOAD_FOLDER, courseId);
        const zipPath = path.join(courseDir, '_maic.zip');
        
        if (!fs.existsSync(zipPath)) {
            // 尝试从解压的文件重新打包
            const manifestPath = path.join(courseDir, 'manifest.json');
            if (!fs.existsSync(manifestPath)) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: '课件不存在' }));
                return;
            }
            
            // 重新打包
            const { execSync } = require('child_process');
            try {
                execSync(`cd "${courseDir}" && zip -r _maic.zip manifest.json audio/ media/`, { stdio: 'pipe' });
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: '打包失败' }));
                return;
            }
        }
        
        const stat = fs.statSync(zipPath);
        res.writeHead(200, {
            'Content-Type': 'application/zip',
            'Content-Length': stat.size,
            'Content-Disposition': `attachment; filename="${courseId}.maic.zip"`
        });
        fs.createReadStream(zipPath).pipe(res);
        return;
        
    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Not found: ' + pathname }));
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Classroom API server running on port ${PORT}`);
    console.log(`Upload folder: ${UPLOAD_FOLDER}`);
    console.log(`Data file: ${DATA_FILE}`);
});
