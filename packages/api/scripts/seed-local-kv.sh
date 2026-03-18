#!/bin/bash
# 初始化本地 KV 中的用户数据
# 使用方法: ./scripts/seed-local-kv.sh

set -e

echo "正在初始化本地 KV 用户数据..."

# 创建默认管理员用户 (admin/admin123)
# 注意: wrangler dev 默认使用 preview namespace，所以这里使用 --preview true
pnpm wrangler kv key put --binding KV --preview true --local "users:admin" '{"password_hash":"admin123","created_at":"2024-01-01T00:00:00Z"}'

echo ""
echo "✅ 用户数据初始化完成!"
echo "默认凭据: admin / admin123"
echo ""
echo "⚠️  如果 wrangler dev 正在运行，请重启它以加载最新的 .dev.vars 配置"
