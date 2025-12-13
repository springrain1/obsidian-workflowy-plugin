# Obsidian Workflowy 插件

一个强大的 Obsidian 插件，将 Markdown 笔记转换为 Workflowy 风格的大纲编辑器，提供流畅的块级编辑体验。

[English](README.md)

## ✨ 功能特性

### 🎯 核心功能
- **双模式切换**：在传统 Markdown 编辑和 Workflowy 风格大纲编辑之间无缝切换
- **块级编辑**：类似 Workflowy 的层级结构和块操作体验
- **实时同步**：保持 Obsidian 原生 Markdown 格式，完全兼容现有笔记
- **零干扰设计**：采用功能隔离架构，不影响 Obsidian 原生 Markdown 编辑体验

### ⌨️ 快捷键操作
| 快捷键 | 功能 |
|--------|------|
| `Enter` | 创建新块 |
| `Backspace` | 删除空块/合并块 |
| `Tab` / `Shift+Tab` | 增加/减少缩进 |
| `Ctrl+Shift+↑/↓` | 上下移动块 |
| `Alt+Enter` | 折叠/展开块 |
| `Ctrl+Enter` | 切换待办状态 |
| `Ctrl+Z` / `Ctrl+Y` | 撤销/重做 |
| `Ctrl+Backspace` | 清空块内容 |
| `Ctrl+Shift+Backspace` | 删除当前块 |
| `Alt+↑/↓` | 缩放导航（上一层/下一层） |
| `↑/↓` | 块间导航 |

### 🎨 界面特性
- **Workflowy 风格界面**：简洁的圆点标记和层级缩进线
- **折叠展开**：支持块的折叠和展开，聚焦重要内容
- **缩放功能**：点击圆点可缩放到特定块，专注编辑子内容
- **实时搜索**：快速查找和高亮匹配内容（支持高亮和过滤模式）
- **拖拽重排序**：直观的拖拽操作重新排列块
- **多选操作**：支持多选块进行批量操作
- **主题切换**：内置多种主题，支持明暗模式
- **响应式设计**：完美适配桌面和移动设备

### 📝 编辑模式
- **源码模式**：直接编辑 Markdown 文本
- **Live Preview 模式**：实时渲染 Markdown，所见即所得
  - 完整的 Markdown 格式支持（加粗、斜体、链接等）
  - 内部链接预览和导航
  - 嵌入支持（图片、笔记、块引用）
  - 代码语法高亮

### 🔗 链接支持
- 内部链接（`[[笔记]]`）点击跳转
- 标题链接（`[[笔记#标题]]`）滚动并高亮
- 块引用（`[[笔记#^blockid]]`）精确导航
- 嵌入链接（`![[笔记]]`）点击跳转
- Ctrl+悬停显示预览弹窗
- Ctrl+Alt+点击或Shift+点击分屏打开

## 📖 使用方法

### 切换视图
**切换到 Workflowy 视图：**
1. 打开任意 Markdown 文件
2. 使用命令面板（`Ctrl/Cmd+P`）搜索"切换大纲/Markdown视图"
3. 或右键文件选择"打开为大纲笔记"

**切换回 Markdown 视图：**
1. 在 Workflowy 视图中，使用命令面板搜索"切换大纲/Markdown视图"
2. 或右键选择"打开为Markdown"

### 基础操作
- **创建块**：按 `Enter` 在当前块后创建新块
- **缩进管理**：使用 `Tab` 和 `Shift+Tab` 调整层级
- **移动块**：使用 `Ctrl+Shift+↑/↓` 或拖拽移动
- **折叠/展开**：点击三角形图标或按 `Alt+Enter`
- **缩放聚焦**：点击圆点可缩放到该块，专注编辑其子内容
- **多选操作**：按住 `Ctrl` 点击多个块，可批量操作

### 搜索功能
- 点击搜索图标或使用顶部搜索栏
- **高亮模式**：高亮匹配内容，显示所有块
- **过滤模式**：仅显示包含搜索词的块
- 支持区分大小写选项

## 📦 安装方法

### 从 Obsidian 社区插件安装（推荐）
1. 打开 Obsidian 设置
2. 进入"第三方插件"
3. 关闭"安全模式"
4. 点击"浏览"搜索"Workflowy Outline"
5. 点击"安装"并启用插件

### 手动安装
1. 从 [Releases](https://github.com/user/obsidian-workflowy-plugin/releases) 下载最新版本
2. 解压到 Obsidian 插件目录：`{vault}/.obsidian/plugins/obsidian-workflowy-plugin/`
3. 在 Obsidian 设置中启用插件

### 开发者安装
```bash
# 克隆仓库
git clone https://github.com/user/obsidian-workflowy-plugin.git
cd obsidian-workflowy-plugin

# 安装依赖
npm install

# 开发模式（监听文件变化）
npm run dev

# 生产构建
npm run build
```

## ⚙️ 配置选项

### UI 设置
- **缩进大小**：自定义层级缩进距离（默认：30px）
- **主题选择**：多种内置主题可选
- **显示圆点**：切换圆点标记显示
- **显示折叠指示器**：切换折叠箭头显示
- **动画效果**：启用/禁用界面动画

### 编辑器设置
- **渲染模式**：选择源码模式或 Live Preview 模式
- **自动保存**：启用自动保存，可配置延迟时间
- **占位符文本**：自定义空块占位符

### 搜索设置
- **搜索模式**：高亮模式或过滤模式
- **区分大小写**：切换大小写敏感搜索
- **自动展开匹配**：自动展开包含匹配内容的折叠块

### 拖拽设置
- **启用拖拽**：切换拖拽功能
- **显示放置指示器**：拖拽时显示视觉反馈
- **允许嵌套放置**：允许将块作为子块放置

### 折叠状态记忆
- **启用**：在文档中记住折叠状态
- **标记符**：自定义折叠状态标记（以 HTML 注释形式存储）

## 🏗️ 技术架构

### 核心组件
- **BlockEditor**：块级编辑逻辑和状态管理
- **OutlineParser**：Markdown 与大纲结构的双向转换
- **WorkflowyView**：自定义视图组件
- **IsolationLayer**：功能隔离系统，确保不干扰原生 Obsidian

### 数据流
```
Markdown 文件 ↔ OutlineParser ↔ BlockEditor ↔ WorkflowyView ↔ 用户界面
```

### 隔离架构
插件采用 5 层隔离架构设计：
1. **ViewStateManager**：视图状态追踪
2. **IsolationLayer**：边界强制执行
3. **CommandProxy**：命令拦截
4. **EventDelegator**：事件隔离
5. **RuntimeValidator**：运行时验证

这确保了插件功能完全独立，不会影响 Obsidian 原生 Markdown 编辑体验。

## 🔧 兼容性

- **Obsidian 版本**：0.15.0+
- **平台支持**：
  - ✅ Windows / macOS / Linux 桌面端
  - ✅ iOS / Android 移动端
  - ✅ 平板设备（iPad / Android Tablet）
- **主题兼容**：完美支持所有 Obsidian 主题，自动适配明暗模式

### 📱 移动端优化
- **触摸交互优化**：所有交互元素符合 44px 最小触摸目标标准
- **响应式布局**：自动适配不同屏幕尺寸
- **优化字体大小**：移动端使用 16px 字体，防止自动缩放
- **简化缩进**：移动端使用更小的缩进间距，节省屏幕空间
- **触摸拖拽**：支持触摸拖拽重排序
- **平台自动检测**：自动识别设备类型并应用相应优化

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

### 开发环境设置
1. Fork 本仓库
2. 创建功能分支：`git checkout -b feature/your-feature`
3. 提交更改：`git commit -am 'Add some feature'`
4. 推送分支：`git push origin feature/your-feature`
5. 创建 Pull Request

### 开发规范
- 遵循 TypeScript 严格模式
- 保持功能隔离架构
- 添加适当的注释和文档
- 确保代码通过 ESLint 检查

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🙏 致谢

- 感谢 [Obsidian](https://obsidian.md/) 提供强大的插件 API
- 灵感来源于 [Workflowy](https://workflowy.com/) 的优秀设计
- 参考了 [Obsidian Outliner](https://github.com/vslinko/obsidian-outliner) 的部分实现
- 感谢社区的反馈和贡献

## 💬 反馈与支持

- **问题反馈**：[GitHub Issues](https://github.com/user/obsidian-workflowy-plugin/issues)
- **功能建议**：[GitHub Discussions](https://github.com/user/obsidian-workflowy-plugin/discussions)
- **作者**：SpringRain | 公众号：及时春雨
