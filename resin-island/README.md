# Resin Island · 树脂块微缩岛屿

全屏网页交互场景：一块圆角透明树脂里装着一座微缩岛屿 —— 陡崖、一弯沙滩、青绿色海水。
整块像果冻一样跟着指针晃，水面随指针起涟漪。

**技术栈**：Vite + React 19 + TypeScript · three · @react-three/fiber v9 · @react-three/drei ·
@react-three/postprocessing · leva。

**所有 3D 内容程序化生成，不加载任何模型文件。** 环境光使用 drei `Environment` 预设。

```bash
npm install
npm run dev     # http://localhost:5173
npm run build   # tsc --noEmit + vite build
```

## 目录

```
src/
├── App.tsx                      Canvas + 质量/参数 Provider + HUD
├── config/scene.ts              全部尺寸常量（块体、水位、海床、岛心、支点）
├── context/ParamsContext.tsx    leva 调参 → 响应式 params + 每帧可读 paramsRef
├── hooks/
│   ├── useWaterHeightfield.ts   ★ GPU 高度场（ping-pong FBO 波动方程），独立 hook
│   ├── useJellyWobble.ts        果冻弹簧：绕低支点旋转 + 体积守恒挤压
│   ├── useQuality.tsx           高/低画质档 + 自动降级
│   └── useFps.ts                HUD 用 FPS / 计时
├── materials/
│   ├── waterMaterial.ts         水面：顶点位移 + 梯度法线 + 深浅混色 + 泡沫
│   └── seabedMaterial.ts        海床：沙色 PBR + 程序化焦散
├── utils/
│   ├── noise.ts                 值噪声 / fbm / ridged（CPU 侧）
│   └── island.ts                岛屿高度场 + 坡度 + 分层配色
└── components/
    ├── Scene.tsx                场景装配
    ├── CameraRig.tsx            长焦俯视机位 + 指针视差
    ├── Lighting.tsx             studio 环境 + 可调太阳主光 + 补光
    ├── JellyGroup.tsx           果冻舞台（支点嵌套）
    ├── ResinBlock.tsx           树脂块（MeshTransmissionMaterial）+ 内部内容
    ├── WaterSurface.tsx         水面网格 + 指针涟漪注入
    ├── Seabed.tsx               沙色海床 + 焦散
    ├── Island.tsx               程序化地形 + 实例化植被
    ├── Rocks.tsx                散布岩石
    ├── PostFX.tsx               景深 / 泛光 / 暗角
    └── Hud.tsx                  DOM 覆盖层
```

## 关键实现说明

**水面高度场**（`useWaterHeightfield`）：两张 `HalfFloat` RenderTarget 乒乓渲染，
状态纹理 `R = 当前高度`、`G = 上一帧高度`（leapfrog 积分），fragment shader 里做
`h' = h + (h - h_prev)·damping + c²·∇²h`，再叠加鼠标高斯脉冲与空闲正弦扰动。
水面材质在顶点着色器采样该纹理做位移、用中心差分求梯度得到法线；uv 与指针命中 uv 完全一致。

**果冻**：`<group squash> → <group pivot @ y=-0.85> → <group -pivot 偏移> → 内容`。
旋转发生在块体下方支点，因此顶部摆幅天然大于底部；角速度驱动 y 方向挤压、
x/z 做 `1/√y` 补偿保持体积。

**渲染次序（重要）**：drei 的 `MeshTransmissionMaterial` 会把**整个场景**（含半透明水面）
渲进自己的 FBO 再采样，因此内部的海床 / 岛 / 岩石 / 水面都是通过「折射」看到的。
块体正常写深度即可，不需要额外 renderOrder 处理；水面保持 `transparent` 才能与沙底正确混合。

**性能与降级**：`useQuality` 按指针类型 / 视口尺寸 / 核数判断初始档位；
drei `PerformanceMonitor` 掉帧时降档（透射采样 6→3、透射缓冲 1024→768、水面网格 160→72、关景深）。
手机默认低档：关 DoF、降 DPR，目标 30fps 以上。

## leva 可调项

水色（深/浅）、浪高、涟漪强度、岸边泡沫、潮位、太阳方位/高度/强度、果冻软硬、摆动幅度、
焦平面 / 景深范围 / 景深强度。

## 两个易踩的坑（已处理，改代码前务必留意）

1. **leva 必须 ≥ 0.10**。0.9.x 内部调用已被 React 19 移除的 `ReactDOM.render`，会让
   `<ParamsProvider>` 整棵子树抛错、Canvas 完全不挂载。表现为页面空白、控制台报
   `import_react_dom.default.render is not a function`。
2. **`useControls` 返回的是扁平的叶子键对象**：`folder()` 只影响面板分组，不产生嵌套；
   而**普通嵌套对象会被静默忽略**（`normalizeInput` 返回 false → 该组控件全部丢失）。
   所以 `ParamsContext` 用 `folder()` 组织面板，但读取时按叶子名取值，再组装成
   `params.water.deepColor` 这种嵌套结构给全场景消费。

## 已知取舍

- 纯程序化 ⇒ 高级风格化渲染，非照片级；岩石纹理、植被种类为噪声近似。
- 焦散是 shader 里模拟的亮斑，非物理焦散，运动时与真实折射不完全一致。
- 内部细节分辨率受透射缓冲限制（见 `useQuality.transResolution`），这是刻意的「树脂内朦胧」。
- 玻璃质感依赖 `Environment` 预设，需要联网拉取 HDR。
