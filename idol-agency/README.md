# 从新人到顶流，经营偶像公司

一款离线运行的艺人经纪模拟游戏。

## 发布信息

- 简介：签约新人，打造闪耀舞台
- 小红书发布包：`release/zao-xing-plan-xhs.zip`
- 图标源码：`public/app-icon.jpg`
- 构建后图标：`app-icon.jpg`

## 运行

```bash
npm install
npm run dev
```

## 小红书适配

在小红书容器中会自动预留顶部导航安全区，并将 Day、时段和距评级信息缩小后居中显示，避开左上角返回和右上角分享按钮。

`public/portraits` 是源资源目录；`dist/portraits` 是构建时自动生成的发布目录。最终 ZIP 只包含 `dist` 内容，入口 `index.html` 位于 ZIP 根目录。
