/**
 * 构建期常量，由 vite.xhs.config.ts 的 define 注入。
 * FX=off 打包时 FX_OFF 为 true，用来出一版完全没有场景特效的包做对比。
 */
declare const FX_OFF: boolean
