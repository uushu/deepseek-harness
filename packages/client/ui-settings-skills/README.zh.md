# @deepseek-ai/dsh-client-ui-settings-skills

[English](README.md) | 中文

**技能**设置入口的浏览器半边：Web 设置中复刻「插件」分区结构的一个分区——导航行、简介文字与两个功能持有的标签页。**技能列表**标签页展示当前项目可由用户调用的技能目录（名称、描述、可选适用场景，以及模型/用户调用徽标），可展开查看提供方与来源；**技能配置**标签页把同一目录按提供方与来源分组，让用户看清每个技能来自哪里（项目根、用户根、内置、自定义等）以及谁可以调用它。

两个标签页都通过共享 connection client 读取按会话寻址的 `skill.list` RPC：当前会话的项目 cwd 在 host 侧解析目录；没有打开会话时，界面会明确报告这一点，而不是虚构一个项目。该分区声明 `settings.skills.tab` 根级列表 slot；两个标签页由本包自身注册进去，因此外壳（ui-settings-general）与设置域底座无需改动。该界面刻意只读：技能发现根位于部署与 agent preset 中，编辑属于单独的写路径里程碑。

## Model Experience

None, as this browser-only settings surface registers no prompt, tool, message, or provider request.

#### KV Cache effect

None; this package never assembles model input.

## Known Limitations and Deferred Work

- **只读** — 分区展示解析后的项目目录；安装、移除或编辑技能暂缓。
- **当前会话作用域** — 目录按当前会话的项目寻址；还没有跨项目或提供方级的管理视图。
