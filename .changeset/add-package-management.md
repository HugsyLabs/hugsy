---
"@hugsylabs/hugsy": minor
---

添加包管理功能

- `hugsy init` 现在会自动运行 `install`（除非使用 `--no-install` 标志）
- `hugsy install` 支持安装包：`hugsy install @hugsy-plugins/xxx` 
- `hugsy uninstall` 支持双重功能：
  - 不带参数：卸载整个 Hugsy
  - 带参数：从配置中移除指定的包
- 添加智能包类型检测（插件 vs 预设）
- 支持 `--plugin` 和 `--preset` 标志来明确指定包类型