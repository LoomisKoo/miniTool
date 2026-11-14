# 手机背面 DIY（开盒铺）

小红书小工具：给手机背面贴贴纸 / 写字 / 手绘 / 上闪粉，三分钟生成一张能晒的「新机拆盒卡」。

## 功能

- **贴纸**：108 张离线 die-cut 贴纸，分角色 / 装饰 / 闪亮 / 镜头 / 背景
- **背景**：20 张满版壁纸（海洋、仲夏夜、樱花、银河、秘密花园，以及奶油、草莓牛奶、云朵蓝、蜜桃、抹茶格纹、柠檬汽水、薰衣草、奶油心心、薄荷波纹、焦糖布丁等治愈系）铺满整机背面
- **文字**：字体、描边、弧排、配色
- **手绘**：笔色 / 粗细，直接画在背面
- **特效**：9 种闪粉材质 + 9 种边框图案，一键甜美 / 潮酷主题
- **主题随机**：21 套主题联动机型颜色 / 壁纸 / 闪粉 / 边框 / 贴纸池
- **出图**：存相册、发笔记（`window.xhs.miniTool`）

## 本地预览

```bash
cd phone-back-diy
python3 -m http.server 8765
# http://127.0.0.1:8765
```

## 打包上传小红书

```bash
cd phone-back-diy
node build.mjs
# 产物：dist/xiaohongshu-phone-back-diy.zip（index.html 在包根）
```

`build.mjs` 会做外链 / 内联 script / module 脚本检查，再压缩 `index.html + assets + fonts + favicon.svg`。

## 壁纸生成

治愈系壁纸由脚本按调色板 + 柔和图案（波点 / 格纹 / 云朵 / 心心 / 波纹 / 气泡）生成，可复现：

```bash
python3 tools/gen_backdrops.py            # 全部重新生成
python3 tools/gen_backdrops.py wp-milk    # 只生成一张
```

## 技术

- 纯静态 HTML / CSS / JS，经典脚本（无 `type="module"`、无 `import`），无联网
- Canvas 2D 渲染机身、镜头模组、贴纸分层与闪粉
- 图片为 384px WebP 贴纸 + 640px WebP 壁纸，控制包体
- 进度存 `window.xhs.miniTool` Storage，`localStorage` 兜底（key `kaihe-phone-back-v1`）
- 发布配置见 [`platforms/xiaohongshu/config.json`](platforms/xiaohongshu/config.json)
