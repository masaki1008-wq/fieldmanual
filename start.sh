#!/bin/bash
# FieldManual セットアップスクリプト (Mac / Linux)
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo ""
echo "========================================"
echo "  FieldManual セットアップ"
echo "========================================"

# Node.js チェック
if ! command -v node &>/dev/null; then
  echo ""
  echo "❌ Node.js が見つかりません。"
  echo "   https://nodejs.org からインストールしてください。"
  exit 1
fi

NODE_VER=$(node -e "process.stdout.write(process.version)")
echo "  ✅ Node.js $NODE_VER を検出"

# 証明書が既にあればスキップ
if [ -f "cert.pem" ] && [ -f "key.pem" ]; then
  echo "  ✅ SSL証明書は既に存在します (スキップ)"
else
  echo "  🔐 SSL証明書を生成しています..."
  openssl req -x509 -newkey rsa:2048 \
    -keyout key.pem -out cert.pem \
    -days 825 -nodes \
    -subj "/C=JP/ST=Tokyo/O=FieldManual/CN=localhost" \
    -addext "subjectAltName=IP:127.0.0.1,IP:0.0.0.0,DNS:localhost" \
    2>/dev/null
  echo "  ✅ SSL証明書を生成しました"
fi

echo ""
echo "  🚀 HTTPSサーバーを起動します..."
echo ""
node server.js 8443
