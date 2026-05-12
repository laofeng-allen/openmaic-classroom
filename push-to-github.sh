#!/bin/bash
# GitHub 推送脚本 - OpenMAIC Classroom

REPO_NAME="openmaic-classroom"

echo "================================"
echo "  OpenMAIC Classroom 推送脚本"
echo "================================"
echo ""

# 检查是否已配置 remote
if git remote | grep -q "origin"; then
    echo "[1/4] 移除旧的 remote..."
    git remote remove origin
fi

echo ""
echo "[2/4] 请输入您的 GitHub 用户名:"
read -p "> " GITHUB_USER

echo ""
echo "[3/4] 配置 remote..."
git remote add origin "https://github.com/${GITHUB_USER}/${REPO_NAME}.git"

echo ""
echo "[4/4] 推送到 GitHub..."
git branch -M main
git push -u origin main

echo ""
echo "================================"
if [ $? -eq 0 ]; then
    echo "✅ 推送成功！"
    echo ""
    echo "仓库地址: https://github.com/${GITHUB_USER}/${REPO_NAME}"
    echo ""
    echo "如果失败，请检查:"
    echo "  1. 仓库是否已在 GitHub 创建?"
    echo "  2. 是否需要输入 GitHub Token 作为密码?"
    echo "     (去 https://github.com/settings/tokens 生成)"
else
    echo "❌ 推送失败，请检查错误信息"
fi
echo "================================"
