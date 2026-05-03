#!/bin/bash
# Classroom 后端启动脚本
# 用法: ./start.sh [数据目录]
# 默认数据目录: /home/lf/docker-data/classroom

DATA_DIR="${1:-/home/lf/docker-data/classroom}"
export UPLOAD_FOLDER="$DATA_DIR/courses"
export DATA_FILE="$DATA_DIR/data/courses.json"
export TEMP_DIR="/tmp/classroom-upload"
export PORT="${PORT:-5000}"

cd "$(dirname "$0")"
exec node server.js
