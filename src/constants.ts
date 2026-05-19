export const WORKFLOWY_VIEW_TYPE = 'workflowy-view';

export const WORKFLOWY_SHORTCUTS = {
    // 基础操作
    'Enter': 'createNewBlock',
    //'Shift+Enter': 'insertLineBreak',  // 在节点内换行
    'Backspace': 'handleBackspace',
    'Delete': 'handleDelete',
    'Ctrl+Shift+Backspace': 'clearBlockContent',  // 清空当前节点内容
    'Ctrl+Enter': 'toggleTodo',  // 切换待办状态

    // 缩进操作
    'Tab': 'indentBlock',
    'Shift+Tab': 'outdentBlock',

    // 移动操作
    'Ctrl+Shift+ArrowUp': 'moveBlockUp',
    'Ctrl+Shift+ArrowDown': 'moveBlockDown',

    // 折叠操作
    'Alt+Enter': 'toggleCollapse',

    // 导航操作
    'ArrowUp': 'navigateUp',
    'ArrowDown': 'navigateDown',
    // 'ArrowLeft': 'navigateLeft',    // 移除：让 ←/→ 保持默认的光标移动行为
    // 'ArrowRight': 'navigateRight',  // 如需块级导航，可使用 Alt+← 和 Alt+→
    
    // Zoom 导航
    'Alt+ArrowUp': 'zoomOut',      // 往上一层级 zoom（退出当前 zoom）
    'Alt+ArrowDown': 'zoomIn',     // 往下一层级 zoom（zoom 到当前聚焦的块）

    // 撤销重做
    'Ctrl+Z': 'undo',
    'Ctrl+Y': 'redo',
    'Ctrl+Shift+Z': 'redo'
} as const;

export const UI_CONFIG = {
    indentSize: 30,
    bulletSize: 6,
    bulletColor: '#666666',
    hoverColor: '#3498db',
    focusBackground: 'rgba(74, 144, 226, 0.1)',
    lineHeight: 1.6,
    fontSize: 14
} as const;