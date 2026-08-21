# @deepseek-ai/dsh-client-ui-harness

[English](README.md) | 中文

Web 客户端的可选 Aqua 视觉皮肤。该包覆盖当前主题的 token 栈，为玻璃表面写入包自有 DOM 属性，并挂载流体、壁纸、海洋生物、网格、聚光、按压和粒子鲸鱼效果，无需修改共享 UI 包。关闭插件总开关会释放这些效果并恢复原生界面。

客户端贡献会在 Plugins 设置区注册 Aqua 卡片，并注册包含原生浅色、深色、跟随系统选项及 Aqua 控件的主题区。启用状态、材质模式、模糊、磨砂、流体配色、背景、装饰和壁纸调节均保存在浏览器本地。大型视频壁纸使用 IndexedDB；支持的 Chromium 浏览器也可在用户授权后保留 File System Access 文件句柄。

Host 端贡献有意保持为空。该包依赖客户端 runtime、locale、theme、settings、slots 和 primitives 服务，由客户端组合通过动态插件清单加载。

## 模型体验

无，因为该包只改变浏览器呈现与浏览器本地设置，不增加提示词、工具、会话事件或模型提供方请求。

#### KV Cache 影响

无；该包不会组装模型输入。

## 已知限制与延期工作

- 壁纸持久化受浏览器存储配额限制；记住文件句柄还要求浏览器支持 File System Access API，并由用户授权。
- 视觉缝线标记依赖共享 UI 当前的 DOM 结构；这些组件缝线变化时必须同步更新本包测试。
- Aqua 设置只保存在浏览器本地，不通过 Host 设置服务同步。
