# Obsidian Workflowy Plugin

A powerful Obsidian plugin that transforms your Markdown notes into a Workflowy-style outline editor with seamless block-level editing capabilities.

[中文文档](README-zh_cn.md)

## ✨ Features

### 🎯 Core Features
- **Dual-Mode Editing**: Seamlessly switch between traditional Markdown editing and Workflowy-style outline editing
- **Block-Level Operations**: Workflowy-like hierarchical structure with intuitive block manipulation
- **Real-Time Sync**: Maintains native Obsidian Markdown format while providing enhanced editing experience
- **Zero Interference**: Complete functional isolation ensures no impact on native Obsidian Markdown experience

### ⌨️ Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| `Enter` | Create new block |
| `Backspace` | Delete empty block / Merge blocks |
| `Tab` / `Shift+Tab` | Indent / Outdent |
| `Ctrl+Shift+↑/↓` | Move block up/down |
| `Alt+Enter` | Toggle collapse/expand |
| `Ctrl+Enter` | Toggle todo status |
| `Ctrl+Z` / `Ctrl+Y` | Undo / Redo |
| `Ctrl+Backspace` | Clear block content |
| `Ctrl+Shift+Backspace` | Delete current block |
| `Alt+↑/↓` | Zoom out / Zoom in |
| `↑/↓` | Navigate between blocks |

### 🎨 UI Features
- **Workflowy-Style Interface**: Clean bullet points with hierarchical indentation lines
- **Collapse/Expand**: Focus on important content by collapsing blocks
- **Zoom Focus**: Click bullet to zoom into a specific block for focused editing
- **Real-Time Search**: Quick search with highlighting (highlight or filter mode)
- **Drag & Drop**: Intuitive block reordering via drag and drop
- **Multi-Selection**: Select multiple blocks for batch operations
- **Theme Support**: Multiple built-in themes with light/dark mode support
- **Responsive Design**: Works perfectly on desktop and mobile devices

### 📝 Editing Modes
- **Source Mode**: Direct text editing with Markdown syntax
- **Live Preview Mode**: Real-time Markdown rendering with WYSIWYG editing
  - Full Markdown formatting support (bold, italic, links, etc.)
  - Internal link preview and navigation
  - Embed support (images, notes, blocks)
  - Code syntax highlighting

### 🔗 Link Support
- Internal links (`[[note]]`) with click navigation
- Heading links (`[[note#heading]]`) with scroll and highlight
- Block references (`[[note#^blockid]]`) with precise navigation
- Embed links (`![[note]]`) with click-to-navigate
- Ctrl+hover for preview popup
- Ctrl+Alt+click or Shift+click for split view

## 📖 Usage

### Switching Views
**Switch to Workflowy View:**
1. Open any Markdown file
2. Use Command Palette (`Ctrl/Cmd+P`) and search "Toggle Outline/Markdown View"
3. Or right-click the file and select "Open as Outline Note"

**Switch back to Markdown View:**
1. In Workflowy view, use Command Palette and search "Toggle Outline/Markdown View"
2. Or right-click and select "Open as Markdown"

### Basic Operations
- **Create Block**: Press `Enter` to create a new block after current one
- **Indent Management**: Use `Tab` and `Shift+Tab` to adjust hierarchy
- **Move Blocks**: Use `Ctrl+Shift+↑/↓` or drag and drop
- **Collapse/Expand**: Click the triangle icon or press `Alt+Enter`
- **Zoom Focus**: Click the bullet point to zoom into that block
- **Multi-Select**: Hold `Ctrl` and click multiple blocks for batch operations

### Search
- Click the search icon or use the search bar at the top
- **Highlight Mode**: Highlights matching content while showing all blocks
- **Filter Mode**: Shows only blocks containing the search term
- Case-sensitive search option available

## 📦 Installation

### From Obsidian Community Plugins (Recommended)
1. Open Obsidian Settings
2. Go to "Community Plugins"
3. Disable "Safe Mode"
4. Click "Browse" and search for "Workflowy Outline"
5. Click "Install" and enable the plugin

### Manual Installation
1. Download the latest release from [Releases](https://github.com/user/obsidian-workflowy-plugin/releases)
2. Extract to your Obsidian plugins folder: `{vault}/.obsidian/plugins/obsidian-workflowy-plugin/`
3. Enable the plugin in Obsidian settings

### Developer Installation
```bash
# Clone the repository
git clone https://github.com/user/obsidian-workflowy-plugin.git
cd obsidian-workflowy-plugin

# Install dependencies
npm install

# Development mode (watch for changes)
npm run dev

# Production build
npm run build
```

## ⚙️ Settings

### UI Settings
- **Indent Size**: Customize indentation distance (default: 30px)
- **Theme**: Choose from multiple built-in themes
- **Show Bullets**: Toggle bullet point visibility
- **Show Collapse Indicators**: Toggle collapse arrow visibility
- **Animations**: Enable/disable UI animations

### Editor Settings
- **Render Mode**: Choose between Source mode and Live Preview mode
- **Auto Save**: Enable automatic saving with configurable delay
- **Placeholder Text**: Customize empty block placeholder

### Search Settings
- **Search Mode**: Highlight or Filter mode
- **Case Sensitive**: Toggle case-sensitive search
- **Auto Expand Matches**: Automatically expand collapsed blocks containing matches

### Drag & Drop Settings
- **Enable Drag & Drop**: Toggle drag and drop functionality
- **Show Drop Indicators**: Visual feedback during drag operations
- **Allow Nested Drop**: Allow dropping blocks as children

### Collapse State Memory
- **Enable**: Remember collapse states in the document
- **Marker**: Custom marker for collapse state (stored as HTML comments)

## 🏗️ Architecture

### Core Components
- **BlockEditor**: Block-level editing logic and state management
- **OutlineParser**: Bidirectional conversion between Markdown and outline structure
- **WorkflowyView**: Custom view component
- **IsolationLayer**: Functional isolation system ensuring no interference with native Obsidian

### Data Flow
```
Markdown File ↔ OutlineParser ↔ BlockEditor ↔ WorkflowyView ↔ User Interface
```

### Isolation Architecture
The plugin employs a 5-layer isolation architecture:
1. **ViewStateManager**: Centralized view state tracking
2. **IsolationLayer**: Boundary enforcement and validation
3. **CommandProxy**: Command interception and context validation
4. **EventDelegator**: Event isolation and delegation
5. **RuntimeValidator**: Runtime assertions and health checks

This ensures complete separation between Workflowy functionality and native Obsidian experience.

## 🔧 Compatibility

- **Obsidian Version**: 0.15.0+
- **Platform Support**:
  - ✅ Windows / macOS / Linux Desktop
  - ✅ iOS / Android Mobile
  - ✅ Tablets (iPad / Android Tablet)
- **Theme Compatibility**: Works with all Obsidian themes, auto-adapts to light/dark mode

### � Mobile Optimization
- **Touch Interaction**: All interactive elements meet 44px minimum touch target
- **Responsive Layout**: Automatically adapts to different screen sizes
- **Optimized Font Size**: 16px font on mobile to prevent auto-zoom
- **Reduced Indentation**: Smaller indent spacing on mobile to save screen space
- **Touch Drag & Drop**: Full support for touch-based reordering
- **Platform Detection**: Automatic device detection with appropriate optimizations

## 🤝 Contributing

Contributions are welcome! Please feel free to submit Issues and Pull Requests.

### Development Setup
1. Fork this repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Create a Pull Request

### Development Guidelines
- Follow TypeScript strict mode
- Maintain functional isolation architecture
- Add appropriate comments and documentation
- Ensure code passes ESLint checks

## 📄 License

MIT License - See [LICENSE](LICENSE) file for details

## 🙏 Acknowledgments

- Thanks to [Obsidian](https://obsidian.md/) for the powerful plugin API
- Inspired by [Workflowy](https://workflowy.com/)'s excellent design
- Referenced [Obsidian Outliner](https://github.com/vslinko/obsidian-outliner) for some implementations
- Thanks to the community for feedback and contributions

## 💬 Feedback & Support

- **Bug Reports**: [GitHub Issues](https://github.com/user/obsidian-workflowy-plugin/issues)
- **Feature Requests**: [GitHub Discussions](https://github.com/user/obsidian-workflowy-plugin/discussions)
- **Author**: SpringRain | 公众号: 及时春雨
