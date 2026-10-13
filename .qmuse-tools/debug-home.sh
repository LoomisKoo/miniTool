#!/usr/bin/env bash
# 在家调试 QMuse：预发 (pre) 多在办公网，公网连不上时用本脚本走线上 (prod) + 本地 dev。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
QMUSE="$ROOT/.qmuse-tools/node_modules/.bin/qmuse"
CHROME_OPEN="$ROOT/.qmuse-tools/chrome-open/open-chrome.mjs"
CLI_JS="$ROOT/.qmuse-tools/node_modules/@qmuse/qmuse-cli/dist/cli.js"
REGISTER="$ROOT/.qmuse-tools/chrome-open/register.mjs"

pre_reachable() {
  curl -sS -o /dev/null --connect-timeout 5 -I https://qmuse-pre.qmuse.cn/ >/dev/null 2>&1
}

login_with_chrome() {
  local env="${1:-prod}"
  node "$ROOT/.qmuse-tools/chrome-open/qmuse-login-chrome.mjs" --env "$env"
}

cmd="${1:-help}"
case "$cmd" in
  check)
    if pre_reachable; then
      echo "预发可访问：可用 login-pre 或 qmuse --env pre"
    else
      echo "预发不可达（需蚂蚁/办公 VPN）。请用：$0 login  然后  $0 dev <项目目录>"
    fi
    ;;
  login-competition)
    "$QMUSE" logout 2>/dev/null || true
    echo "1) 在 Chrome 用大赛入口登录 → 2) 在 qmuse.cn 退出个人号并确认已是大赛账号 → 3) 终端确认码"
    node "$CHROME_OPEN" "https://render.alipay.com/p/yuyan/180020010001297052/studio-awards"
    node "$CHROME_OPEN" "https://qmuse.cn"
    login_with_chrome prod
    ;;
  login)
    if pre_reachable; then
      echo "检测到预发可访问，仍默认走线上 prod（大赛导入用 prod）。若要预发：$0 login-pre"
    else
      echo "预发不可达，使用线上 https://qmuse.cn 登录…"
    fi
    node "$CHROME_OPEN" "https://qmuse.cn"
    login_with_chrome prod
    ;;
  login-pre)
    if ! pre_reachable; then
      echo "预发仍不可达。请连接办公 VPN 后重试：$0 check"
      exit 1
    fi
    node "$CHROME_OPEN" "https://qmuse-pre.qmuse.cn"
    login_with_chrome pre
    ;;
  dev)
    proj="${2:-}"
    if [[ -z "$proj" ]]; then
      echo "用法: $0 dev <工具>/qmuse 目录"
      exit 1
    fi
    cd "$proj"
    "$QMUSE" dev . --port 5173
    ;;
  whoami)
    "$QMUSE" whoami --json
    ;;
  web)
    # login 只保存 CLI 凭证，不会打开妙思后台；用这个进网页工作台
    node "$CHROME_OPEN" "https://qmuse.cn"
    ;;
  app)
    proj="${2:-}"
    if [[ -z "$proj" ]]; then
      echo "用法: $0 app <工具>/qmuse 目录  （读取 .qmuse/project.json 里的 appId）"
      exit 1
    fi
    app_id="$(node -e "
      const fs=require('fs'),p=require('path');
      const root=process.argv[1];
      const j=JSON.parse(fs.readFileSync(p.join(root,'.qmuse/project.json'),'utf8'));
      const t=j.targets?.prod||j.targets?.pre;
      if(!t?.appId) process.exit(2);
      console.log(t.appId);
    " "$proj")"
    node "$CHROME_OPEN" "https://qmuse.cn/app/${app_id}"
    ;;
  help|*)
    cat <<EOF
用法:
  $0 check          检测预发是否可达
  $0 login-competition  大赛账号：登大赛入口 + qmuse.cn + CLI 授权
  $0 login          Chrome 打开线上并 qmuse login (prod，在家调试用这个)
  $0 login-pre      仅当 check 通过时用预发登录
  $0 web            登录后打开妙思网页工作台（login 不会自动开后台）
  $0 app <目录>     打开该项目已导入应用在网页上的编辑/预览页
  $0 dev <目录>     本地改代码联调云端（Vite + 开发云资源）
  $0 whoami         查看登录与空间
EOF
    ;;
esac
