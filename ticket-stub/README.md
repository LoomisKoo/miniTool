# 电子票根生成器

纯 HTML + CSS + JavaScript 的多风格票根小工具：本地上传图片、自定义文案、CSS 3D 悬停预览，并用 `html-to-image` 导出高清 PNG。

## 启动

```bash
npx serve ticket-stub
```

打开浏览器访问提示的本地地址即可（需能访问 CDN：Lucide / html-to-image / Google Fonts）。

## 分类与风格

| 分类 | 风格 |
| --- | --- |
| 电影票 | 双联撕裂、拍立得卡 |
| 旅行通票 | 登机牌、风景明信片 |
| 演唱会票 | 霓虹暗色、音乐节票 |
| 漫游 | 报刊风、胶囊卡片 |
| 邮票 | 经典邮票等 |

## 文件

- `index.html` — 页面结构
- `src/templates.js` — 分类 / 字段 / 票面 HTML
- `src/style.css` — 视觉与 3D / mask 咬口
- `src/app.js` — 表单、上传、倾斜、导出
