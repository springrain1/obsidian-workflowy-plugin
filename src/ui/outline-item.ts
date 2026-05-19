import { OutlineBlock } from '../types';
import { UI_CONFIG, WORKFLOWY_SHORTCUTS } from '../constants';
import { getKeyCombo, getAllBlocks, findBlockById } from '../utils';
import { BlockEditor } from '../block-editor';
import { IsolationLayer } from '../isolation/isolation-layer';
import { ObsidianBlockRenderer } from './obsidian-block-renderer';
import { App, MarkdownRenderer, Component } from 'obsidian';
import { WorkflowyPluginSettings } from '../settings';
import { LivePreviewEditor } from '../features/live-preview-editor';

/**
 * 统一的 OutlineItem 实现
 * 整合了 OutlineItemSimple、OutlineItemEnhanced 和原 OutlineItem 的优点
 */
export class OutlineItem {
    private element: HTMLElement;
    private block: OutlineBlock;
    private editor: BlockEditor;
    private contentElement: HTMLElement;
    private bulletElement: HTMLElement;
    private collapseIndicator: HTMLElement | null = null;
    private checkboxElement: HTMLElement | null = null;
    private onUpdate: (blockId: string, content: string) => void;
    private onFocus: (blockId: string) => void;
    private onRender?: () => void;
    private getMultiSelectionManager?: () => any;
    private onBulletClick?: (blockId: string) => void;
    private getZoomedBlockId?: () => string | null;

    // Obsidian 集成
    private app: App | null = null;
    private sourcePath: string = '';
    private obsidianRenderer: ObsidianBlockRenderer | null = null;
    private renderPromise: Promise<void> | null = null;

    // 双层渲染相关（Live Preview 模式）
    private settings: WorkflowyPluginSettings | null = null;
    private isEditMode: boolean = false;
    private displayElement: HTMLElement | null = null;
    private editorElement: HTMLTextAreaElement | null = null;
    private contentWrapper: HTMLElement | null = null;
    private livePreviewEditor: LivePreviewEditor | null = null;

    // 拖拽相关状态
    // 全局记录当前拖拽中的块ID（解决部分环境 dragover 读取不到 dataTransfer 的问题）
    private static currentDraggedId: string | null = null;

    // 拖拽指示元素 - 复用 obsidian-outliner 的实现
    private static dropZone: HTMLElement | null = null;
    private static dropZonePadding: HTMLElement | null = null;

    private isDragging: boolean = false;
    private draggedBlock: OutlineBlock | null = null;

    constructor(
        block: OutlineBlock,
        editor: BlockEditor,
        onUpdate: (blockId: string, content: string) => void,
        onFocus: (blockId: string) => void,
        onRender?: () => void,
        getMultiSelectionManager?: () => any,
        onBulletClick?: (blockId: string) => void,
        getZoomedBlockId?: () => string | null,
        app?: App,
        sourcePath?: string,
        settings?: WorkflowyPluginSettings
    ) {
        this.block = block;
        this.editor = editor;
        this.onUpdate = onUpdate;
        this.onFocus = onFocus;
        this.onRender = onRender;
        this.getMultiSelectionManager = getMultiSelectionManager;
        this.onBulletClick = onBulletClick;
        this.getZoomedBlockId = getZoomedBlockId;
        this.app = app || null;
        this.sourcePath = sourcePath || '';
        this.settings = settings || null;

        // 创建全局拖拽指示元素（如果还没有创建）
        this.ensureDropZoneElements();

        // 直接在构造函数中创建元素，避免时序问题（借鉴 OutlineItemSimple）
        // 注意：对于非列表项，createElement 是异步的，但我们不在构造函数中等待
        // 而是在 createElement 内部处理异步逻辑
        this.createElement();
        
        // 只为列表项绑定事件（非列表项使用 Obsidian 渲染器，不需要 WorkFlowy 风格的事件）
        // 注意：Live Preview 模式有自己的事件绑定逻辑（bindLivePreviewEvents），不需要调用 bindEvents
        if ((this.block.type === 'list' || !this.block.useObsidianRenderer) && 
            this.settings?.editor.renderMode !== 'live-preview') {
            this.bindEvents();
        }
    }

    /**
     * 确保拖拽指示元素存在 - 复用 obsidian-outliner 的实现
     */
    private ensureDropZoneElements(): void {
        if (!OutlineItem.dropZone) {
            // 创建主指示线
            OutlineItem.dropZone = document.createElement('div');
            OutlineItem.dropZone.classList.add('workflowy-drop-zone');
            document.body.appendChild(OutlineItem.dropZone);

            // 创建缩进指示线
            OutlineItem.dropZonePadding = document.createElement('div');
            OutlineItem.dropZonePadding.classList.add('workflowy-drop-zone-padding');
            OutlineItem.dropZone.appendChild(OutlineItem.dropZonePadding);
        }
    }

    /**
     * 创建元素结构（借鉴 OutlineItemSimple 的直接创建方式）
     * 支持混合渲染：列表项使用 WorkFlowy 风格，其他使用 Obsidian 渲染器
     */
    private createElement(): void {
        // 主容器
        this.element = document.createElement('div');
        this.element.className = 'workflowy-item';
        this.element.setAttribute('data-block-id', this.block.id);
        this.element.setAttribute('data-block-type', this.block.type);
        this.element.setAttribute('data-level', this.block.level.toString());

        // 如果是非列表项且需要使用 Obsidian 渲染器
        if (this.block.type !== 'list' && this.block.useObsidianRenderer && this.app) {
            // 异步创建 Obsidian 渲染元素，保存 Promise 以便等待
            this.renderPromise = this.createObsidianRenderedElement().catch(err => {
                console.error('[OutlineItem] Error creating Obsidian rendered element:', err);
            });
            return;
        }

        // 列表项：使用 WorkFlowy 风格渲染
        // 如果是已完成的待办，添加特殊类名
        if (this.block.isTodo && this.block.todoCompleted) {
            this.element.classList.add('todo-completed');
        }

        this.element.style.paddingLeft = `${this.block.level * UI_CONFIG.indentSize}px`;
        // 不在这里设置draggable，而是通过bullet触发拖拽

        // 创建内容行
        const contentLine = document.createElement('div');
        contentLine.className = 'workflowy-content-line';

        // 折叠指示器（仅当有子项时显示）- 借鉴 OutlineItemEnhanced
        if (this.block.children.length > 0) {
            this.collapseIndicator = document.createElement('div');
            this.collapseIndicator.className = `workflowy-collapse ${this.editor.isCollapsed(this.block.id) ? 'collapsed' : ''}`;
            this.collapseIndicator.innerHTML = this.editor.isCollapsed(this.block.id) ? '▶' : '▼';
            contentLine.appendChild(this.collapseIndicator);
        } else {
            // 占位符，保持对齐
            const placeholder = document.createElement('div');
            placeholder.className = 'workflowy-collapse-placeholder';
            contentLine.appendChild(placeholder);
        }

        // 圆点标记（可拖拽，可点击缩放）
        this.bulletElement = document.createElement('div');
        this.bulletElement.className = 'workflowy-bullet';
        this.bulletElement.draggable = true;  // 只有 bullet 可拖拽
        this.bulletElement.title = 'Drag to move, Click to zoom'; // 提示文本
        contentLine.appendChild(this.bulletElement);

        // 如果是待办事项，在圆点后添加复选框
        if (this.block.isTodo) {
            this.checkboxElement = document.createElement('div');
            this.checkboxElement.className = 'workflowy-checkbox';
            if (this.block.todoCompleted) {
                this.checkboxElement.classList.add('completed');
                // 使用 SVG 勾号以获得更好的显示效果
                this.checkboxElement.innerHTML = '<svg viewBox="0 0 16 16" width="12" height="12"><path d="M13.5 3L6 10.5L2.5 7" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
            } else {
                this.checkboxElement.innerHTML = '';
            }
            contentLine.appendChild(this.checkboxElement);
        }

        // 垂直缩进线现在由 VerticalLinesManager 统一管理

        // Bullet点击事件（用于zoom功能）
        this.bulletElement.addEventListener('click', (e) => {
            // 只处理直接点击，不处理拖拽
            if (!this.isDragging && this.onBulletClick) {
                e.preventDefault();
                e.stopPropagation();
                this.onBulletClick(this.block.id);
            }
        });

        // 内容编辑区 - 根据渲染模式选择实现
        if (this.settings?.editor.renderMode === 'live-preview') {
            this.createLivePreviewContent(contentLine);
        } else {
            this.createSourceContent(contentLine);
        }

        this.element.appendChild(contentLine);
    }

    /**
     * 创建源码模式内容（保留原有实现）
     */
    private createSourceContent(contentLine: HTMLElement): void {
        this.contentElement = document.createElement('div');
        this.contentElement.className = 'workflowy-content';
        this.contentElement.contentEditable = 'true';
        this.contentElement.textContent = this.block.content;
        this.contentElement.setAttribute('data-block-id', this.block.id);

        // 设置占位符
        if (!this.block.content) {
            this.contentElement.setAttribute('data-placeholder', '输入内容...');
        }

        contentLine.appendChild(this.contentElement);
    }

    /**
     * 创建 Live Preview 模式内容（双层渲染）
     */
    private createLivePreviewContent(contentLine: HTMLElement): void {
        // 创建容器
        this.contentWrapper = document.createElement('div');
        this.contentWrapper.className = 'workflowy-content-wrapper';

        // 显示层（MarkdownRenderer）
        this.displayElement = document.createElement('div');
        this.displayElement.className = 'workflowy-content-display';
        this.contentWrapper.appendChild(this.displayElement);

        // 编辑层（textarea）
        this.editorElement = document.createElement('textarea');
        this.editorElement.className = 'workflowy-content-editor';
        this.editorElement.value = this.block.content;
        this.editorElement.style.display = 'none';  // 初始隐藏
        this.editorElement.setAttribute('data-block-id', this.block.id);
        this.editorElement.rows = 1;  // 初始单行
        this.editorElement.style.overflow = 'hidden';  // 隐藏滚动条
        this.editorElement.style.resize = 'none';  // 禁止手动调整大小
        this.contentWrapper.appendChild(this.editorElement);

        // 绑定自动扩展功能
        this.bindAutoResize();

        contentLine.appendChild(this.contentWrapper);

        // 绑定双层渲染事件
        this.bindLivePreviewEvents();

        // 初始渲染显示层
        this.renderDisplay();

        // 为了兼容现有代码，将 editorElement 也赋值给 contentElement
        // 这样现有的焦点管理等逻辑可以继续工作
        this.contentElement = this.editorElement;
    }

    /**
     * 绑定事件监听器（保留原有的错误处理）
     * 注意：此方法只应该在列表项上调用，非列表项使用 Obsidian 渲染器不需要这些事件
     */
    private bindEvents(): void {
        // 安全检查：确保 contentElement 存在
        if (!this.contentElement) {
            console.warn('[OutlineItem] bindEvents called but contentElement is undefined. Block type:', this.block.type);
            return;
        }

        // 折叠指示器点击事件
        if (this.collapseIndicator) {
            this.collapseIndicator.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleCollapse();
            });
        }

        // 复选框点击事件
        if (this.checkboxElement) {
            this.checkboxElement.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.handleCheckboxClick();
            });
        }

        // 垂直缩进线点击事件现在由 VerticalLinesManager 处理

        // 内容编辑事件
        this.contentElement.addEventListener('input', () => {
            this.handleContentChange();
        });

        this.contentElement.addEventListener('focus', () => {
            this.handleFocus();
        });

        this.contentElement.addEventListener('blur', () => {
            this.handleBlur();
        });

        // 键盘事件通过 EventDelegator 在 workflowy-view.ts 中统一处理
        // 避免双重事件绑定和竞态条件

        // 鼠标悬停效果
        this.element.addEventListener('mouseenter', () => {
            this.element.classList.add('hovered');
        });

        this.element.addEventListener('mouseleave', () => {
            this.element.classList.remove('hovered');
        });

        // Bullet 拖拽支持 - 让bullet区域可拖拽
        this.bulletElement.setAttribute('draggable', 'true');

        // Bullet拖拽事件
        this.bulletElement.addEventListener('dragstart', (e) => {
            this.handleDragStart(e);
        });

        // 容器拖拽事件（接收放置）- 使用捕获阶段，避免被子元素或第三方拦截
        this.element.addEventListener('dragover', (e) => this.handleDragOver(e), { capture: true });
        this.element.addEventListener('drop', (e) => this.handleDrop(e), { capture: true });
        this.element.addEventListener('dragend', (e) => this.handleDragEnd(e), { capture: true });
        this.element.addEventListener('dragleave', (e) => this.handleDragLeave(e), { capture: true });
    }

    /**
     * 键盘事件处理 - 使用 WORKFLOWY_SHORTCUTS 映射
     */
    private handleKeyDown(e: KeyboardEvent): void {
        // 确保只在 Workflowy 容器内处理快捷键
        if (!IsolationLayer.getInstance().isElementInWorkflowyContainer(e.target as HTMLElement)) {
            return;
        }

        // 检查焦点是否在搜索框
        const searchInput = document.querySelector('.workflowy-search');
        if (searchInput && document.activeElement === searchInput) {
            // 焦点在搜索框，不处理节点的键盘事件
            return;
        }

        const keyCombo = getKeyCombo(e);

        // 特殊处理 Tab 键：立即阻止默认行为，防止制表符插入
        if (keyCombo === 'Tab' || keyCombo === 'Shift+Tab') {
            e.preventDefault();
            e.stopPropagation();
        }

        const operation = WORKFLOWY_SHORTCUTS[keyCombo as keyof typeof WORKFLOWY_SHORTCUTS];

        if (operation) {
            // 先判断是否需要自定义处理，再决定是否阻止默认行为
            const shouldPrevent = this.shouldPreventDefault(operation, e);

            if (shouldPrevent) {
                // Tab 键和 Shift+Enter 已经在上面或方法内部阻止了，这里只处理其他键
                if (keyCombo !== 'Tab' && keyCombo !== 'Shift+Tab' && keyCombo !== 'Shift+Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                }
                this.executeOperation(operation, e);
            }
        }
    }

    /**
     * 判断是否需要阻止默认行为
     * 只有当确实需要自定义处理时才返回 true
     */
    private shouldPreventDefault(operation: string, _e: KeyboardEvent): boolean {
        switch (operation) {
            case 'handleBackspace':
                return this.shouldHandleBackspace();
            case 'handleDelete':
                return this.shouldHandleDelete();
            case 'createNewBlock':
                // Enter 键总是需要自定义处理（创建新块或分割内容）
                return true;
            case 'insertLineBreak':
                // Shift+Enter 插入换行符
                return true;
            // 以下操作都需要自定义处理，阻止默认行为
            case 'indentBlock':
            case 'outdentBlock':
            case 'moveBlockUp':
            case 'moveBlockDown':
            case 'toggleCollapse':
            case 'toggleTodo':  // 切换待办状态
            case 'navigateUp':
            case 'navigateDown':
            case 'undo':
            case 'redo':
            case 'clearBlockContent':  // 清空内容
            case 'zoomOut':  // Zoom 导航
            case 'zoomIn':   // Zoom 导航
                return true;
            default:
                // 未知操作，允许默认行为
                return false;
        }
    }

    /**
     * 判断 Backspace 是否需要自定义处理
     * 只有当光标在开头时才需要自定义处理（删除块、减少缩进、合并块）
     */
    private shouldHandleBackspace(): boolean {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            return false;
        }

        try {
            const range = selection.getRangeAt(0);
            const cursorPosition = range.startOffset;

            // 只有光标在开头时才需要自定义处理
            return cursorPosition === 0;
        } catch (error) {
            console.error('[OutlineItem] Error checking backspace position:', error);
            return false;
        }
    }

    /**
     * 判断 Delete 是否需要自定义处理
     * 只有当光标在末尾时才需要自定义处理（删除空块、合并下一个块）
     */
    private shouldHandleDelete(): boolean {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            return false;
        }

        try {
            const range = selection.getRangeAt(0);
            const cursorPosition = range.startOffset;
            const content = this.contentElement.textContent || '';

            // 只有光标在末尾时才需要自定义处理
            return cursorPosition === content.length;
        } catch (error) {
            console.error('[OutlineItem] Error checking delete position:', error);
            return false;
        }
    }

    /**
     * 执行快捷键操作（借鉴 OutlineItemEnhanced 的焦点恢复逻辑）
     */
    private executeOperation(operation: string, e: KeyboardEvent): void {
        const blockId = this.block.id;

        switch (operation) {
            case 'createNewBlock':
                this.handleEnter(e);
                break;
            case 'insertLineBreak':
                this.handleLineBreak(e);
                break;
            case 'handleBackspace':
                this.handleBackspace(e);
                break;
            case 'handleDelete':
                this.handleDelete(e);
                break;
            case 'indentBlock':

                // 检查并移除可能插入的制表符
                const contentBefore = this.contentElement.textContent || '';

                if (contentBefore.includes('\t')) {
                    const cleanContent = contentBefore.replace(/\t/g, '');
                    this.contentElement.textContent = cleanContent;
                    this.onUpdate(this.block.id, cleanContent);
                }

                if (this.editor.indentBlock(blockId)) {
                    this.triggerRenderAndRestoreFocus(blockId);
                }
                break;
            case 'outdentBlock':

                // 同样检查 Shift+Tab 的情况
                const contentBeforeOutdent = this.contentElement.textContent || '';
                if (contentBeforeOutdent.includes('\t')) {
                    const cleanContent = contentBeforeOutdent.replace(/\t/g, '');
                    this.contentElement.textContent = cleanContent;
                    this.onUpdate(this.block.id, cleanContent);
                }

                // 在 zoom 模式下，检查是否可以提升
                const zoomedBlockId = this.getZoomedBlockId?.();
                if (zoomedBlockId) {
                    // 获取当前块的父块
                    const allBlocks = getAllBlocks(this.editor.getState().blocks);
                    const parentBlock = this.findParentBlock(allBlocks, blockId);
                    
                    // 如果父块是 zoom 块，不允许提升（已经是最高层级）
                    if (parentBlock && parentBlock.id === zoomedBlockId) {
                        break;
                    }
                }

                if (this.editor.outdentBlock(blockId)) {
                    this.triggerRenderAndRestoreFocus(blockId);
                }
                break;
            case 'moveBlockUp':
                if (this.editor.moveBlockUp(blockId)) {
                    this.triggerRenderAndRestoreFocus(blockId);
                } else {
                }
                break;
            case 'moveBlockDown':
                if (this.editor.moveBlockDown(blockId)) {
                    this.triggerRenderAndRestoreFocus(blockId);
                } else {
                }
                break;
            case 'toggleCollapse':
                // 折叠/展开后恢复焦点
                if (this.toggleCollapse()) {
                    this.triggerRenderAndRestoreFocus(blockId);
                }
                break;
            case 'toggleTodo':
                // 切换待办状态
                if (this.editor.toggleTodo(blockId)) {
                    this.triggerRenderAndRestoreFocus(blockId);
                }
                break;
            case 'navigateUp':
                this.handleNavigateUp(e);
                break;
            case 'navigateDown':
                this.handleNavigateDown(e);
                break;
            // case 'navigateLeft':  // 已移除：让 ← 保持默认光标移动行为
            // case 'navigateRight': // 已移除：让 → 保持默认光标移动行为
            case 'undo':
                if (this.editor.undo()) {
                    // 撤销后恢复焦点到当前块
                    this.triggerRenderAndRestoreFocus(blockId);
                } else {
                }
                break;
            case 'redo':
                if (this.editor.redo()) {
                    // 重做后恢复焦点到当前块
                    this.triggerRenderAndRestoreFocus(blockId);
                } else {
                }
                break;
            case 'clearBlockContent':
                this.handleClearContent();
                break;
            case 'zoomOut':
                this.handleZoomOut();
                break;
            case 'zoomIn':
                this.handleZoomIn();
                break;
        }
    }

    /**
     * 触发重新渲染并恢复焦点（借鉴 OutlineItemEnhanced）
     */
    private triggerRenderAndRestoreFocus(blockId: string): void {
        if (this.onRender) {
            this.onRender();
            // 重渲染后恢复焦点
            setTimeout(() => {
                this.focusBlockById(blockId);
            }, 10);
        }
    }

    /**
     * 清空当前块内容（Ctrl+Shift+Backspace）
     * 清空后光标应该移动到上一个块的末尾
     */
    private handleClearContent(): void {

        // 清空内容
        this.contentElement.textContent = '';
        this.onUpdate(this.block.id, '');

        // 移动光标到上一个块的末尾
        const allBlocks = getAllBlocks(this.editor.getState().blocks);
        const currentIndex = allBlocks.findIndex(b => b.id === this.block.id);

        if (currentIndex > 0) {
            const prevBlock = allBlocks[currentIndex - 1];
            // 延迟聚焦，确保 DOM 更新完成
            setTimeout(() => {
                this.focusBlockById(prevBlock.id, 'end');
            }, 10);
        } else {
            // 如果是第一个块，保持焦点在当前块
            setTimeout(() => {
                this.contentElement.focus();
            }, 10);
        }
    }

    /**
     * Alt+↑ 处理 - Zoom Out（退出当前 zoom，回到上一层级 zoom 状态）
     */
    private handleZoomOut(): void {
        
        // 获取当前 zoom 的块 ID
        const zoomedBlockId = this.getZoomedBlockId?.();
        
        if (!zoomedBlockId) {
            return;
        }
        
        // 找到当前 zoom 块的父块
        const allBlocks = getAllBlocks(this.editor.getState().blocks);
        const parentBlock = this.findParentBlock(allBlocks, zoomedBlockId);
        
        if (parentBlock) {
            // Zoom 到父块
            if (this.onBulletClick) {
                this.onBulletClick(parentBlock.id);
            }
        } else {
            // 没有父块，完全退出 zoom
            if (this.onBulletClick) {
                this.onBulletClick(zoomedBlockId);
            }
        }
    }

    /**
     * Alt+↓ 处理 - Zoom In（zoom 到当前聚焦的块，或其第一个子节点）
     */
    private handleZoomIn(): void {
        
        const zoomedBlockId = this.getZoomedBlockId?.();
        
        // 如果当前块已经是 zoom 块
        if (zoomedBlockId === this.block.id) {
            // 尝试 zoom 到第一个子节点
            if (this.block.children.length > 0) {
                const firstChild = this.block.children[0];
                if (this.onBulletClick) {
                    this.onBulletClick(firstChild.id);
                }
            } else {
            }
        } else {
            // 否则，zoom 到当前聚焦的块（无论是否有子节点）
            if (this.onBulletClick) {
                this.onBulletClick(this.block.id);
            }
        }
    }

    /**
     * Enter 键处理 - 创建新块或分割内容
     */
    private handleEnter(_e: KeyboardEvent): void {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);

        // 获取完整内容
        const content = this.contentElement.textContent || '';

        // 创建一个临时范围来获取光标前的内容
        const beforeRange = document.createRange();
        beforeRange.setStart(this.contentElement, 0);
        beforeRange.setEnd(range.startContainer, range.startOffset);
        const beforeCursor = beforeRange.toString();

        // 光标后的内容
        const afterCursor = content.substring(beforeCursor.length);


        // 检查是否在zoom模式下，且当前块是zoom的目标块
        const isZoomedBlock = this.getZoomedBlockId && this.getZoomedBlockId() === this.block.id;

        if (afterCursor === '') {
            // 光标在末尾，创建新块
            let newBlock: OutlineBlock;

            if (isZoomedBlock) {
                // 如果是zoom块本身，创建子块
                newBlock = this.editor.createChildBlock(this.block.id);
            } else {
                // 否则创建兄弟块
                newBlock = this.editor.createNewBlock(this.block.id);
            }


            if (this.onRender) {
                this.onRender();
                // 延迟聚焦新块，给足够时间让DOM渲染
                setTimeout(() => {
                    this.focusBlockById(newBlock.id);
                }, 50); // 增加延迟时间
            }
        } else {
            // 光标在中间，分割内容

            // 更新当前块
            this.contentElement.textContent = beforeCursor;
            this.onUpdate(this.block.id, beforeCursor);

            // 创建新块
            let newBlock: OutlineBlock;

            if (isZoomedBlock) {
                // 如果是zoom块本身，创建子块
                newBlock = this.editor.createChildBlock(this.block.id);
            } else {
                // 否则创建兄弟块
                newBlock = this.editor.createNewBlock(this.block.id);
            }

            this.onUpdate(newBlock.id, afterCursor);


            // 重新渲染
            if (this.onRender) {
                this.onRender();
                // 延迟聚焦新块
                setTimeout(() => {
                    this.focusBlockById(newBlock.id);
                }, 50);
            }
        }
    }

    /**
     * Shift+Enter 键处理 - 插入换行符
     */
    private handleLineBreak(e: KeyboardEvent): void {
        e.preventDefault();
        e.stopPropagation();
        
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        
        // 删除选中的内容（如果有）
        range.deleteContents();
        
        // 插入换行符文本节点
        const textNode = document.createTextNode('\n');
        range.insertNode(textNode);
        
        // 将光标移动到换行符后面
        range.setStartAfter(textNode);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        
        // 更新内容（使用 textContent 保留换行符）
        const newContent = this.contentElement.textContent || '';
        this.onUpdate(this.block.id, newContent);
    }

    /**
     * Backspace 键处理 - 参考 HackFlowy 和 OutlineItemEnhanced
     * 注意：此方法只在光标位于开头时被调用（由 shouldHandleBackspace 判断）
     * preventDefault 已在 handleKeyDown 中统一处理
     */
    private handleBackspace(e: KeyboardEvent): void {
        const selection = window.getSelection();
        if (!selection) {
            return;
        }

        const range = selection.getRangeAt(0);
        const cursorPosition = range.startOffset;
        const content = this.contentElement.textContent || '';

        // 光标应该在开头（由 shouldHandleBackspace 保证）
        if (cursorPosition === 0) {
            if (content === '' && this.block.children.length === 0) {
                // 空块且无子项，删除块
                this.deleteBlock();
            } else if (content === '' && this.block.level > 0) {
                // 空块且有缩进，减少缩进
                if (this.editor.outdentBlock(this.block.id)) {
                    this.triggerRenderAndRestoreFocus(this.block.id);
                }
            } else if (content !== '') {
                // 非空块，光标在开头，尝试与上一个块合并
                const allBlocks = getAllBlocks(this.editor.getState().blocks);
                const currentIndex = allBlocks.findIndex(b => b.id === this.block.id);

                if (currentIndex > 0) {
                    const prevBlock = allBlocks[currentIndex - 1];
                    const prevContentLength = (prevBlock.content || '').length;
                    // 合并到上一个块
                    const mergedContent = (prevBlock.content || '') + content;
                    this.onUpdate(prevBlock.id, mergedContent);
                    // 删除当前块
                    this.editor.deleteBlock(this.block.id);
                    // 触发渲染并聚焦到上一个块的原内容末尾（合并点）
                    if (this.onRender) {
                        this.onRender();
                        setTimeout(() => {
                            this.focusBlockAtPosition(prevBlock.id, prevContentLength);
                        }, 10);
                    }
                }
            }
        } else {
            // 理论上不应该到达这里，因为 shouldHandleBackspace 已经检查过了
            console.warn('[OutlineItem] Unexpected: handleBackspace called but cursor not at start');
        }
    }

    /**
     * Delete 键处理
     * 注意：此方法只在光标位于末尾时被调用（由 shouldHandleDelete 判断）
     * preventDefault 已在 handleKeyDown 中统一处理
     */
    private handleDelete(e: KeyboardEvent): void {
        const selection = window.getSelection();
        if (!selection) {
            return;
        }

        const range = selection.getRangeAt(0);
        const cursorPosition = range.startOffset;
        const content = this.contentElement.textContent || '';

        // 光标应该在末尾（由 shouldHandleDelete 保证）
        if (cursorPosition === content.length) {
            if (content === '' && this.block.children.length === 0) {
                // 光标在末尾且内容为空，删除块
                this.deleteBlock();
            } else if (content !== '') {
                // 光标在末尾，尝试合并下一个块
                const allBlocks = getAllBlocks(this.editor.getState().blocks);
                const currentIndex = allBlocks.findIndex(b => b.id === this.block.id);

                if (currentIndex < allBlocks.length - 1) {
                    const nextBlock = allBlocks[currentIndex + 1];
                    // 合并内容
                    const mergedContent = content + (nextBlock.content || '');
                    this.onUpdate(this.block.id, mergedContent);
                    // 删除下一个块
                    this.editor.deleteBlock(nextBlock.id);
                    // 触发渲染
                    if (this.onRender) {
                        this.onRender();
                        // 恢复焦点到当前块
                        setTimeout(() => {
                            this.focusBlockById(this.block.id);
                        }, 10);
                    }
                } else {
                }
            }
        } else {
            // 理论上不应该到达这里，因为 shouldHandleDelete 已经检查过了
            console.warn('[OutlineItem] Unexpected: handleDelete called but cursor not at end');
        }
    }

    /**
     * 导航键处理 - 借鉴 OutlineItemEnhanced
     * preventDefault 已在 handleKeyDown 中统一处理
     */
    private handleNavigateUp(e: KeyboardEvent): void {
        // Workflowy 行为：始终导航到上一个块
        this.focusPreviousBlock();
    }

    private handleNavigateDown(e: KeyboardEvent): void {
        // Workflowy 行为：始终导航到下一个块
        this.focusNextBlock();
    }

    /**
     * 拖拽事件处理
     */
    private handleDragStart(e: DragEvent): void {
        e.stopPropagation(); // 阻止事件冒泡

        // 检查是否是多选拖拽
        const multiSelectionManager = this.getMultiSelectionManager?.();
        const selectedBlocks = multiSelectionManager?.getSelectedBlocks() || [];
        const isMultiSelection = selectedBlocks.length > 1 && selectedBlocks.includes(this.block.id);

        if (isMultiSelection) {
            // 多选拖拽
            OutlineItem.currentDraggedId = 'multi-selection';
            this.isDragging = true;

            if (e.dataTransfer) {
                e.dataTransfer.effectAllowed = 'move';
                
                // 使用多选管理器的拖拽数据
                multiSelectionManager.startDragSelectedBlocks(e);

                // 创建多选拖拽图像
                this.createMultiSelectionDragImage(e, selectedBlocks);

                // 为所有选中的块添加拖拽样式
                setTimeout(() => {
                    selectedBlocks.forEach(blockId => {
                        const element = document.querySelector(`[data-block-id="${blockId}"]`);
                        if (element) {
                            element.classList.add('dragging');
                        }
                    });
                }, 0);
            }
        } else {
            // 单个块拖拽
            OutlineItem.currentDraggedId = this.block.id;
            this.isDragging = true;
            this.draggedBlock = this.block;

            if (e.dataTransfer) {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', this.block.id);

                // 设置拖拽图像为整个item
                const dragImage = this.element.cloneNode(true) as HTMLElement;
                dragImage.style.opacity = '0.5';
                document.body.appendChild(dragImage);
                dragImage.style.position = 'absolute';
                dragImage.style.top = '-1000px';
                e.dataTransfer.setDragImage(dragImage, 0, 0);
                setTimeout(() => {
                    document.body.removeChild(dragImage);
                }, 0);

                // 添加拖拽样式到主元素
                setTimeout(() => {
                    this.element.classList.add('dragging');
                }, 0);
            }
        }
    }

    private handleDragOver(e: DragEvent): void {
        e.preventDefault();
        if (e.dataTransfer) {
            e.dataTransfer.dropEffect = 'move';
        }

        // 获取拖拽的块ID（部分环境下 dragover 读取不到 dataTransfer，回退到静态记录）
        const draggedId = e.dataTransfer?.getData('text/plain') || OutlineItem.currentDraggedId;
        if (!draggedId || draggedId === this.block.id) {
            return;
        }

        // 清除之前的样式
        this.clearDragStyles();

        // 添加拖拽悬停样式
        const rect = this.element.getBoundingClientRect();
        const dropZoneHeight = rect.height / 3;

        // 根据鼠标位置决定插入位置
        let dropPosition: 'before' | 'after' | 'child';

        if (e.clientY < rect.top + dropZoneHeight) {
            // 上方区域 - 插入到当前块之前
            dropPosition = 'before';
        } else if (e.clientY > rect.bottom - dropZoneHeight) {
            // 下方区域 - 插入到当前块之后
            dropPosition = 'after';
        } else {
            // 中间区域 - 作为子项插入
            dropPosition = 'child';
        }

        // 显示拖拽指示
        this.showDropZone(rect, dropPosition);
        this.element.classList.add('drag-over-active');
    }

    /**
     * 显示拖拽指示区域 - 完全复用 obsidian-outliner 的实现
     */
    private showDropZone(rect: DOMRect, position: 'before' | 'after' | 'child'): void {
        if (!OutlineItem.dropZone || !OutlineItem.dropZonePadding) {
            return;
        }

        // 计算主指示线位置
        let top: number;
        if (position === 'before') {
            top = rect.top - 2;
        } else {
            top = rect.bottom - 2;
        }

        // 获取容器的边界
        const container = this.element.closest('.workflowy-editor') as HTMLElement;
        const containerRect = container?.getBoundingClientRect() || rect;
        
        // 计算容器左边缘（包含 padding）
        const containerLeft = containerRect.left + 20; // 容器左边缘 + padding
        
        // 计算目标节点的缩进级别
        let targetLevel = this.block.level;
        if (position === 'child') {
            targetLevel = this.block.level + 1;
        }
        
        // 计算缩进宽度
        const indentWidth = 30; // 每级缩进的宽度
        const targetIndent = targetLevel * indentWidth;
        
        // 主指示线从目标缩进位置开始，延伸到容器右边缘
        const left = containerLeft + targetIndent;
        const width = containerRect.right - left;

        // 设置主指示线（蓝色实线）
        OutlineItem.dropZone.style.display = 'block';
        OutlineItem.dropZone.style.top = `${top}px`;
        OutlineItem.dropZone.style.left = `${left}px`;
        OutlineItem.dropZone.style.width = `${width}px`;

        // 计算缩进指示线（虚线）- 从容器左边缘到主指示线起点
        const dashPadding = 3;
        const dashWidth = indentWidth - dashPadding;
        
        // 获取主题色 - 使用 Obsidian 的正确变量
        const accentColor = getComputedStyle(document.body).getPropertyValue('--text-accent').trim() || '#007acc';

        // 设置缩进指示线（虚线）
        if (targetIndent > 0) {
            OutlineItem.dropZonePadding.style.width = `${targetIndent}px`;
            OutlineItem.dropZonePadding.style.marginLeft = `-${targetIndent}px`;
            
            // 创建虚线图案 SVG
            const svgPattern = `url('data:image/svg+xml,%3Csvg%20viewBox%3D%220%200%20${targetIndent}%204%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cline%20x1%3D%220%22%20y1%3D%220%22%20x2%3D%22${targetIndent}%22%20y2%3D%220%22%20stroke%3D%22${encodeURIComponent(accentColor)}%22%20stroke-width%3D%228%22%20stroke-dasharray%3D%22${dashWidth}%20${dashPadding}%22%2F%3E%3C%2Fsvg%3E')`;
            OutlineItem.dropZonePadding.style.backgroundImage = svgPattern;
        } else {
            OutlineItem.dropZonePadding.style.width = '0';
            OutlineItem.dropZonePadding.style.backgroundImage = 'none';
        }
    }

    private handleDrop(e: DragEvent): void {
        e.preventDefault();
        e.stopPropagation();

        // 检查是否是多选拖拽
        const multiSelectionManager = this.getMultiSelectionManager?.();
        let dragData: any = null;
        
        try {
            const dataText = e.dataTransfer?.getData('text/plain');
            if (dataText) {
                dragData = JSON.parse(dataText);
            }
        } catch {
            // 如果解析失败，说明是单个块拖拽
            const draggedId = e.dataTransfer?.getData('text/plain');
            dragData = { type: 'single-block', blockId: draggedId };
        }

        if (!dragData || 
            (dragData.type === 'single-block' && dragData.blockId === this.block.id)) {
            this.clearDragStyles();
            return;
        }

        // 确定放置位置 - 与 handleDragOver 保持一致的逻辑
        const rect = this.element.getBoundingClientRect();
        const dropZoneHeight = rect.height / 3;

        let position: 'before' | 'after' | 'child';
        if (e.clientY < rect.top + dropZoneHeight) {
            // 上方区域 - 插入到当前块之前
            position = 'before';
        } else if (e.clientY > rect.bottom - dropZoneHeight) {
            // 下方区域 - 插入到当前块之后
            position = 'after';
        } else {
            // 中间区域 - 作为子项插入
            position = 'child';
        }

        // 执行移动操作
        if (dragData.type === 'workflowy-multi-blocks') {
            // 多选拖拽
            if (multiSelectionManager) {
                multiSelectionManager.handleDropSelectedBlocks(dragData, this.block.id, position);
            }
        } else {
            // 单个块拖拽
            this.moveBlock(dragData.blockId, this.block.id, position);
        }

        // 清理拖拽状态与样式
        OutlineItem.currentDraggedId = null;
        this.isDragging = false;
        this.draggedBlock = null;
        this.clearDragStyles();
        
        // 触发重新渲染以更新垂直线
        if (this.onRender) {
            setTimeout(() => {
                this.onRender?.();
            }, 50);
        }
    }

    private handleDragEnd(e: DragEvent): void {
        // 清理多选拖拽样式
        if (OutlineItem.currentDraggedId === 'multi-selection') {
            const multiSelectionManager = this.getMultiSelectionManager?.();
            const selectedBlocks = multiSelectionManager?.getSelectedBlocks() || [];
            selectedBlocks.forEach(blockId => {
                const element = document.querySelector(`[data-block-id="${blockId}"]`);
                if (element) {
                    element.classList.remove('dragging');
                }
            });
        } else {
            this.element.classList.remove('dragging');
        }
        
        OutlineItem.currentDraggedId = null;
        this.isDragging = false;
        this.draggedBlock = null;
        this.clearDragStyles();
        
        // 触发重新渲染以更新垂直线
        if (this.onRender) {
            setTimeout(() => {
                this.onRender?.();
            }, 50);
        }
    }

    private handleDragLeave(e: DragEvent): void {
        // 只在真正离开元素时清除样式（不是子元素）
        if (e.target === this.element) {
            this.clearDragStyles();
        }
    }

    private clearDragStyles(): void {
        // 隐藏拖拽指示区域
        if (OutlineItem.dropZone) {
            OutlineItem.dropZone.style.display = 'none';
        }

        // 清除所有拖拽相关样式
        const elementsWithDragStyles = document.querySelectorAll('.drag-over-active');
        elementsWithDragStyles.forEach(el => {
            el.classList.remove('drag-over-active');
        });
    }

    private moveBlock(draggedId: string, targetId: string, position: 'before' | 'after' | 'child'): void {

        const draggedBlock = findBlockById(this.editor.getState().blocks, draggedId);
        const targetBlock = findBlockById(this.editor.getState().blocks, targetId);

        if (!draggedBlock || !targetBlock) {
            console.error('[OutlineItem] Block not found');
            return;
        }

        // 防止拖到自己的子节点中
        if (this.isDescendant(draggedBlock, targetBlock)) {
            console.warn('[OutlineItem] Cannot move block to its own descendant');
            return;
        }

        // 先从原位置删除
        let newBlocks = this.editor.getState().blocks;
        const parser = (this.editor as any).parser; // 访问私有parser

        // 删除被拖拽的块
        newBlocks = parser.deleteBlock(newBlocks, draggedId);

        // 根据位置插入
        if (position === 'before') {
            // 在目标块之前插入
            newBlocks = this.insertBlockBefore(newBlocks, draggedBlock, targetId);
        } else if (position === 'after') {
            // 在目标块之后插入
            newBlocks = parser.insertBlock(newBlocks, draggedBlock, targetId);
        } else if (position === 'child') {
            // 作为目标块的第一个子块插入
            newBlocks = this.insertBlockAsChild(newBlocks, draggedBlock, targetId);
        }

        // 更新状态
        this.editor.setState({ blocks: newBlocks });

        // 重新渲染
        if (this.onRender) {
            this.onRender();
        }
    }

    private isDescendant(ancestor: OutlineBlock, descendant: OutlineBlock): boolean {
        // 检查descendant是否是ancestor的后代
        function checkChildren(children: OutlineBlock[]): boolean {
            for (const child of children) {
                if (child.id === descendant.id) {
                    return true;
                }
                if (checkChildren(child.children)) {
                    return true;
                }
            }
            return false;
        }
        return checkChildren(ancestor.children);
    }

    private insertBlockBefore(blocks: OutlineBlock[], blockToInsert: OutlineBlock, targetId: string): OutlineBlock[] {
        // 在目标块之前插入块
        function insert(blocks: OutlineBlock[]): OutlineBlock[] {
            const newBlocks: OutlineBlock[] = [];
            for (const block of blocks) {
                if (block.id === targetId) {
                    // 在目标块之前插入
                    blockToInsert.level = block.level;
                    newBlocks.push(blockToInsert);
                    newBlocks.push(block);
                } else {
                    newBlocks.push({
                        ...block,
                        children: insert(block.children)
                    });
                }
            }
            return newBlocks;
        }
        return insert(blocks);
    }

    private insertBlockAsChild(blocks: OutlineBlock[], blockToInsert: OutlineBlock, parentId: string): OutlineBlock[] {
        // 作为第一个子块插入
        return blocks.map(block => {
            if (block.id === parentId) {
                blockToInsert.level = block.level + 1;
                return {
                    ...block,
                    children: [blockToInsert, ...block.children]
                };
            }
            return {
                ...block,
                children: this.insertBlockAsChild(block.children, blockToInsert, parentId)
            };
        });
    }

    /**
     * 内容变化处理
     */
    private handleContentChange(): void {
        const newContent = this.contentElement.textContent || '';
        this.onUpdate(this.block.id, newContent);

        // 更新占位符
        if (newContent) {
            this.contentElement.removeAttribute('data-placeholder');
        } else {
            this.contentElement.setAttribute('data-placeholder', '输入内容...');
        }
    }

    /**
     * 焦点处理
     */
    private handleFocus(): void {
        this.onFocus(this.block.id);
        this.element.classList.add('focused');
    }

    private handleBlur(): void {
        this.element.classList.remove('focused');
    }

    /**
     * 折叠/展开处理
     */
    private toggleCollapse(): boolean {
        if (this.editor.toggleCollapse(this.block.id)) {
            this.updateCollapseIndicator();
            if (this.onRender) {
                this.onRender();
            }
            return true;
        }
        return false;
    }

    /**
     * 处理复选框点击
     */
    private handleCheckboxClick(): void {
        if (this.editor.toggleTodo(this.block.id)) {
            // 触发重新渲染并恢复焦点
            this.triggerRenderAndRestoreFocus(this.block.id);
        }
    }

    private updateCollapseIndicator(): void {
        if (this.collapseIndicator) {
            if (this.editor.isCollapsed(this.block.id)) {
                this.collapseIndicator.classList.add('collapsed');
                this.collapseIndicator.innerHTML = '▶';
            } else {
                this.collapseIndicator.classList.remove('collapsed');
                this.collapseIndicator.innerHTML = '▼';
            }
        }
    }



    /**
     * 辅助方法 - 块操作
     */
    private deleteBlock(): void {
        // 先找到上一个块的ID（在删除前）
        const allBlocks = getAllBlocks(this.editor.getState().blocks);
        const currentIndex = allBlocks.findIndex(b => b.id === this.block.id);
        let targetBlockId: string | null = null;

        if (currentIndex > 0) {
            targetBlockId = allBlocks[currentIndex - 1].id;
        }

        // 删除当前块
        this.editor.deleteBlock(this.block.id);

        // 触发渲染
        if (this.onRender) {
            this.onRender();

            // 渲染后聚焦到上一个块的末尾
            if (targetBlockId) {
                setTimeout(() => {
                    this.focusBlockById(targetBlockId);
                }, 10);
            }
        }
    }

    /**
     * 辅助方法 - 焦点导航（借鉴 OutlineItemEnhanced）
     */
    private focusPreviousBlock(): void {
        // 实现聚焦到上一个可见块的逻辑
        // 这需要与 WorkflowyView 协调
        const allBlocks = getAllBlocks(this.editor.getState().blocks);
        const currentIndex = allBlocks.findIndex(b => b.id === this.block.id);

        if (currentIndex > 0) {
            const prevBlock = allBlocks[currentIndex - 1];
            // Workflowy 行为：↑ 键导航到上一个块的开头
            this.focusBlockAtStart(prevBlock.id);
        } else {
        }
    }

    private focusNextBlock(): void {
        // 实现聚焦到下一个可见块的逻辑
        const allBlocks = getAllBlocks(this.editor.getState().blocks);
        const currentIndex = allBlocks.findIndex(b => b.id === this.block.id);

        if (currentIndex < allBlocks.length - 1) {
            const nextBlock = allBlocks[currentIndex + 1];
            // Workflowy 行为：↓ 键导航到下一个块的开头
            this.focusBlockAtStart(nextBlock.id);
        } else {
        }
    }

    private focusBlockAtStart(blockId: string): void {
        // 聚焦到指定块的开头（Workflowy 导航行为）
        const element = document.querySelector(`[data-block-id="${blockId}"] .workflowy-content`) as HTMLElement;
        if (element) {
            element.focus();

            // 将光标移到内容开头
            const range = document.createRange();
            const selection = window.getSelection();
            if (selection && element.childNodes.length > 0) {
                range.selectNodeContents(element);
                range.collapse(true); // true = 开头
                selection.removeAllRanges();
                selection.addRange(range);
            } else {
                // 对于空内容，直接创建范围并设置为开头
                range.setStart(element, 0);
                range.collapse(true);
                selection?.removeAllRanges();
                selection?.addRange(range);
            }
        } else {
        }
    }

    private focusBlockById(blockId: string, position: 'start' | 'end' = 'end'): void {
        // 在 Live Preview 模式下，需要特殊处理
        const blockElement = document.querySelector(`[data-block-id="${blockId}"]`);
        if (!blockElement) {
            console.error('[OutlineItem] Block element not found for:', blockId);
            return;
        }

        // 检查是否是 Live Preview 模式
        const displayElement = blockElement.querySelector('.workflowy-content-display') as HTMLElement;
        if (displayElement) {
            // Live Preview 模式：点击 displayElement 进入编辑模式
            displayElement.click();
            return;
        }

        // 源码模式：查找 contentEditable 元素
        const element = blockElement.querySelector('.workflowy-content') as HTMLElement;
        if (element) {

            // 确保元素可见并聚焦
            element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            
            // 先移除所有其他元素的 focused 类
            document.querySelectorAll('.workflowy-item.focused').forEach(el => {
                el.classList.remove('focused');
            });
            
            // 为当前元素的父容器添加 focused 类
            const itemElement = element.closest('.workflowy-item');
            if (itemElement) {
                itemElement.classList.add('focused');
            }
            
            element.focus();

            // 使用更可靠的光标设置方法
            const selection = window.getSelection();
            if (selection) {
                const range = document.createRange();

                try {
                    if (element.childNodes.length > 0) {
                        // 有文本内容的情况
                        const textNode = element.childNodes[0];
                        if (textNode.nodeType === Node.TEXT_NODE) {
                            const textLength = textNode.textContent?.length || 0;
                            if (position === 'end') {
                                range.setStart(textNode, textLength);
                                range.setEnd(textNode, textLength);
                            } else {
                                range.setStart(textNode, 0);
                                range.setEnd(textNode, 0);
                            }
                        } else {
                            // 非文本节点，使用 selectNodeContents
                            range.selectNodeContents(element);
                            range.collapse(position === 'start');
                        }
                    } else {
                        // 空内容的情况
                        range.setStart(element, 0);
                        range.setEnd(element, 0);
                    }

                    selection.removeAllRanges();
                    selection.addRange(range);

                } catch (error) {
                    console.error('[OutlineItem] Error setting cursor position:', error);
                    // 备用方法：简单聚焦
                    element.focus();
                }
            } else {
                console.warn('[OutlineItem] No selection object available');
                element.focus();
            }
        } else {
            console.error('[OutlineItem] Element not found for block:', blockId);
            // 尝试通过其他方式找到元素
            const allElements = document.querySelectorAll('.workflowy-content');
        }
    }

    private focusBlockAtPosition(blockId: string, position: number): void {
        // 聚焦到指定块的指定位置
        const element = document.querySelector(`[data-block-id="${blockId}"] .workflowy-content`) as HTMLElement;
        if (element) {
            element.focus();

            // 将光标移到指定位置
            const range = document.createRange();
            const selection = window.getSelection();
            if (selection) {
                try {
                    const textNode = element.childNodes[0];
                    if (textNode && textNode.nodeType === Node.TEXT_NODE) {
                        const maxPosition = Math.min(position, textNode.textContent?.length || 0);
                        range.setStart(textNode, maxPosition);
                        range.collapse(true);
                    } else {
                        // 如果没有文本节点，设置到元素开头
                        range.setStart(element, 0);
                        range.collapse(true);
                    }
                    selection.removeAllRanges();
                    selection.addRange(range);
                } catch (error) {
                    console.error('[OutlineItem] Error setting cursor position:', error);
                    // 降级：移到末尾
                    if (element.childNodes.length > 0) {
                        range.selectNodeContents(element);
                        range.collapse(false);
                        selection.removeAllRanges();
                        selection.addRange(range);
                    }
                }
            }
        } else {
        }
    }

    // ==================== 公共方法 ====================

    getElement(): HTMLElement {
        return this.element;
    }

    /**
     * 提供给 EventDelegator 的入口（捕获阶段触发）
     */
    public onKeyDownDelegated(e: KeyboardEvent): void {
        this.handleKeyDown(e);
    }

    focus(): void {
        this.contentElement.focus();
    }

    blur(): void {
        // 安全检查：contentElement 可能为 undefined（使用 Obsidian 渲染器的块）
        if (this.contentElement) {
            this.contentElement.blur();
        }
    }

    destroy(): void {
        this.element.remove();
    }

    updateContent(newContent: string): void {
        if (this.contentElement.textContent !== newContent) {
            this.contentElement.textContent = newContent;
            this.handleContentChange();
        }
    }

    setLevel(level: number): void {
        this.block.level = level;
        this.element.style.paddingLeft = `${level * UI_CONFIG.indentSize}px`;
        this.element.setAttribute('data-level', level.toString());
    }

    /**
     * 等待异步渲染完成（如果有）
     */
    async waitForRender(): Promise<void> {
        if (this.renderPromise) {
            await this.renderPromise;
        }
    }

    /**
     * 查找父块
     */
    private findParentBlock(blocks: OutlineBlock[], targetId: string, parent: OutlineBlock | null = null): OutlineBlock | null {
        for (const block of blocks) {
            if (block.id === targetId) {
                return parent;
            }
            const found = this.findParentBlock(block.children, targetId, block);
            if (found !== null) {
                return found;
            }
        }
        return null;
    }

    /**
     * 创建多选拖拽图像
     */
    private createMultiSelectionDragImage(e: DragEvent, selectedBlocks: string[]): void {
        if (!e.dataTransfer) return;

        // 创建拖拽图像容器
        const dragContainer = document.createElement('div');
        dragContainer.style.cssText = `
            position: absolute;
            top: -1000px;
            left: -1000px;
            background: var(--background-primary);
            border: 2px solid var(--text-accent);
            border-radius: 6px;
            padding: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            font-family: inherit;
            font-size: 12px;
            color: var(--text-normal);
            z-index: 9999;
        `;

        // 添加计数标签
        const countLabel = document.createElement('div');
        countLabel.textContent = `拖拽 ${selectedBlocks.length} 个节点`;
        countLabel.style.cssText = `
            font-weight: 500;
            margin-bottom: 4px;
            color: var(--text-accent);
        `;
        dragContainer.appendChild(countLabel);

        // 添加前几个节点的预览
        const previewCount = Math.min(3, selectedBlocks.length);
        for (let i = 0; i < previewCount; i++) {
            const blockId = selectedBlocks[i];
            const element = document.querySelector(`[data-block-id="${blockId}"]`);
            if (element) {
                const contentEl = element.querySelector('.workflowy-content') as HTMLElement;
                const content = contentEl?.textContent || '';
                
                const previewItem = document.createElement('div');
                previewItem.textContent = `• ${content.slice(0, 20)}${content.length > 20 ? '...' : ''}`;
                previewItem.style.cssText = `
                    opacity: 0.8;
                    margin: 2px 0;
                    font-size: 11px;
                `;
                dragContainer.appendChild(previewItem);
            }
        }

        // 如果有更多节点，显示省略号
        if (selectedBlocks.length > previewCount) {
            const moreItem = document.createElement('div');
            moreItem.textContent = `... 还有 ${selectedBlocks.length - previewCount} 个节点`;
            moreItem.style.cssText = `
                opacity: 0.6;
                margin: 2px 0;
                font-size: 11px;
                font-style: italic;
            `;
            dragContainer.appendChild(moreItem);
        }

        document.body.appendChild(dragContainer);
        e.dataTransfer.setDragImage(dragContainer, 0, 0);

        // 清理拖拽图像
        setTimeout(() => {
            if (document.body.contains(dragContainer)) {
                document.body.removeChild(dragContainer);
            }
        }, 0);
    }

    /**
     * 使用 Obsidian 渲染器创建非列表项元素
     * 支持标题、代码块、段落、引用等
     */
    private async createObsidianRenderedElement(): Promise<void> {
        if (!this.app) return;

        // 创建渲染容器
        const rendererContainer = this.element.createDiv({
            cls: 'workflowy-obsidian-block'
        });

        // 创建并挂载 Obsidian 渲染器
        this.obsidianRenderer = new ObsidianBlockRenderer(
            this.app,
            this.block,
            rendererContainer,
            this.sourcePath,
            (newContent: string) => {
                // 内容变化回调
                this.block.content = newContent;
                this.onUpdate(this.block.id, newContent);
            }
        );

        // 渲染内容
        await this.obsidianRenderer.render();

        // 为非列表项添加最小化的交互（如聚焦）
        rendererContainer.addEventListener('click', () => {
            this.onFocus(this.block.id);
        });

        // 保存 contentElement 引用（兼容性）
        this.contentElement = rendererContainer;
    }

    /**
     * ==================== Live Preview 模式方法 ====================
     */

    /**
     * 绑定自动扩展功能
     */
    private bindAutoResize(): void {
        if (!this.editorElement) {
            console.warn('[OutlineItem] bindAutoResize aborted - no editorElement');
            return;
        }

        const autoResize = () => {
            if (!this.editorElement) return;

            // 先重置 height 为 auto 来获取准确的 scrollHeight
            const originalHeight = this.editorElement.style.height;
            this.editorElement.style.height = 'auto';

            // 立即读取 scrollHeight（内容的实际高度）
            const scrollHeight = this.editorElement.scrollHeight;

            // 恢复 height（避免闪烁）
            this.editorElement.style.height = originalHeight;

            // 设置新的高度（如果需要）
            if (scrollHeight > 0) {
                this.editorElement.style.height = scrollHeight + 'px';
            }

            // 关键：强制 scrollTop 为 0，确保文本从顶部开始
            this.editorElement.scrollTop = 0;
        };

        // 监听输入事件
        this.editorElement.addEventListener('input', autoResize);

        // 初始调整
        this.editorElement.style.height = 'auto';
        this.editorElement.style.height = this.editorElement.scrollHeight + 'px';
        this.editorElement.scrollTop = 0;
    }

    /**
     * 绑定双层渲染事件
     */
    private bindLivePreviewEvents(): void {
        if (!this.displayElement || !this.editorElement) {
            return;
        }

        // ========== 折叠指示器点击事件 ==========
        if (this.collapseIndicator) {
            this.collapseIndicator.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleCollapse();
            });
        }

        // ========== 复选框点击事件 ==========
        if (this.checkboxElement) {
            this.checkboxElement.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.handleCheckboxClick();
            });
        }

        // ========== 鼠标悬停效果 ==========
        this.element.addEventListener('mouseenter', () => {
            this.element.classList.add('hovered');
        });

        this.element.addEventListener('mouseleave', () => {
            this.element.classList.remove('hovered');
        });

        // ========== Bullet 拖拽支持 ==========
        this.bulletElement.setAttribute('draggable', 'true');

        this.bulletElement.addEventListener('dragstart', (e) => {
            this.handleDragStart(e);
        });

        // 容器拖拽事件（接收放置）- 使用捕获阶段
        this.element.addEventListener('dragover', (e) => this.handleDragOver(e), { capture: true });
        this.element.addEventListener('drop', (e) => this.handleDrop(e), { capture: true });
        this.element.addEventListener('dragend', (e) => this.handleDragEnd(e), { capture: true });
        this.element.addEventListener('dragleave', (e) => this.handleDragLeave(e), { capture: true });

        // ========== 点击显示层 → 进入编辑模式 ==========
        this.displayElement.addEventListener('click', (e) => {
            // 如果点击的是链接，不进入编辑模式
            const target = e.target as HTMLElement;
            if (target.tagName === 'A' || target.closest('a')) {
                return;
            }
            this.enterEditMode();
        });

        // ========== textarea 输入事件 ==========
        this.editorElement.addEventListener('input', () => {
            const newContent = this.editorElement!.value;
            this.onUpdate(this.block.id, newContent);
        });

        // ========== 失焦 → 退出编辑模式 ==========
        this.editorElement.addEventListener('blur', () => {
            this.exitEditMode();
        });

        // ========== 聚焦事件 ==========
        this.editorElement.addEventListener('focus', () => {
            this.handleFocus();
        });

        // ========== 键盘事件（保留 WorkFlowy 快捷键） ==========
        this.editorElement.addEventListener('keydown', (e) => {
            this.handleEditorKeydown(e);
        });

        // ========== 为编辑器添加 Markdown 快捷键和右键菜单支持 ==========
        if (this.app && this.editorElement) {
            this.livePreviewEditor = new LivePreviewEditor(
                this.app, 
                this.editorElement
            );
            this.livePreviewEditor.bindShortcuts();
            this.livePreviewEditor.bindContextMenu();
        }
    }

    /**
     * 进入编辑模式
     */
    private enterEditMode(): void {
        if (!this.displayElement || !this.editorElement) return;

        // 保存当前滚动位置
        const scrollContainer = this.element.closest('.workflowy-editor') || document.documentElement;
        const savedScrollTop = scrollContainer.scrollTop;
        const elementRect = this.element.getBoundingClientRect();
        const containerRect = scrollContainer.getBoundingClientRect();
        const relativeTop = elementRect.top - containerRect.top;

        this.isEditMode = true;

        // 切换显示
        this.displayElement.style.display = 'none';
        this.editorElement.style.display = 'block';

        // 调整 textarea 高度以匹配内容
        this.editorElement.style.height = 'auto';
        this.editorElement.style.height = this.editorElement.scrollHeight + 'px';

        // 确保 scrollTop 为 0（新增：进入编辑时重置滚动，确保文本从顶部开始显示）
        this.editorElement.scrollTop = 0;

        // 聚焦
        this.editorElement.focus();

        // 恢复滚动位置 - 使用双重 requestAnimationFrame 确保 DOM 完全稳定
        // 这样可以等待前面异步渲染的非列表块完成布局更新
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const newElementRect = this.element.getBoundingClientRect();
                const newRelativeTop = newElementRect.top - containerRect.top;
                const scrollDiff = newRelativeTop - relativeTop;
                
                if (Math.abs(scrollDiff) > 1) {
                    scrollContainer.scrollTop = savedScrollTop + scrollDiff;
                }
            });
        });

        // 触发焦点回调
        this.onFocus(this.block.id);
    }

    /**
     * 退出编辑模式
     */
    private exitEditMode(): void {
        if (!this.displayElement || !this.editorElement) return;

        this.isEditMode = false;

        // 确保内容已保存
        const currentContent = this.editorElement.value;
        if (currentContent !== this.block.content) {
            this.onUpdate(this.block.id, currentContent);
        }

        // 切换显示
        this.editorElement.style.display = 'none';
        this.displayElement.style.display = 'block';

        // 重新渲染显示层
        this.renderDisplay();
    }

    /**
     * 渲染显示层（使用 MarkdownRenderer）
     */
    private async renderDisplay(): Promise<void> {
        if (!this.app || !this.displayElement) return;

        this.displayElement.empty();

        // 获取当前内容（优先使用 editorElement 的值，因为它是最新的）
        const content = this.editorElement?.value || this.block.content;

        // 创建一个临时的 Component 来避免内存泄漏
        const tempComponent = new Component();
        
        try {
            // 使用 Obsidian MarkdownRenderer（完整 Live Preview）
            await MarkdownRenderer.renderMarkdown(
                content,
                this.displayElement,
                this.sourcePath || '',
                tempComponent
            );

            // 处理内部链接点击
            this.enableInternalLinks();
        } catch (error) {
            console.error('[OutlineItem] Error rendering markdown:', error);
            // 降级：显示纯文本
            this.displayElement.textContent = content;
        }
    }

    /**
     * 启用内部链接点击
     */
    private enableInternalLinks(): void {
        if (!this.displayElement || !this.app) return;

        const links = this.displayElement.querySelectorAll('a.internal-link');
        links.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const href = link.getAttribute('href');
                if (href) {
                    this.app!.workspace.openLinkText(href, this.sourcePath || '');
                }
            });
        });
    }

    /**
     * 处理编辑器键盘事件（保留 WorkFlowy 快捷键）
     */
    private handleEditorKeydown(e: KeyboardEvent): void {
        if (!this.editorElement) return;

        const keyCombo = getKeyCombo(e);

        switch (keyCombo) {
            case 'Enter':
                e.preventDefault();
                this.handleEnterInEditor();
                break;
            case 'Tab':
                e.preventDefault();
                this.editor.indentBlock(this.block.id);
                this.exitEditMode();
                this.onRender?.();
                break;
            case 'Shift+Tab':
                e.preventDefault();
                this.editor.outdentBlock(this.block.id);
                this.exitEditMode();
                this.onRender?.();
                break;
            case 'Escape':
                e.preventDefault();
                this.exitEditMode();
                break;
            case 'Ctrl+ArrowUp':
            case 'Cmd+ArrowUp':
                e.preventDefault();
                this.editor.moveBlockUp(this.block.id);
                this.exitEditMode();
                this.onRender?.();
                break;
            case 'Ctrl+ArrowDown':
            case 'Cmd+ArrowDown':
                e.preventDefault();
                this.editor.moveBlockDown(this.block.id);
                this.exitEditMode();
                this.onRender?.();
                break;
            // 其他快捷键可以继续添加
        }
    }

    /**
     * 处理编辑器中的 Enter 键
     */
    private handleEnterInEditor(): void {
        if (!this.editorElement) return;

        // 获取光标位置
        const cursorPos = this.editorElement.selectionStart;
        const content = this.editorElement.value;

        const beforeCursor = content.substring(0, cursorPos);
        const afterCursor = content.substring(cursorPos);

        // 更新当前块
        this.editorElement.value = beforeCursor;
        this.onUpdate(this.block.id, beforeCursor);

        // 创建新块
        const newBlock = this.editor.createNewBlock(this.block.id);
        this.onUpdate(newBlock.id, afterCursor);

        // 退出编辑模式并重新渲染
        this.exitEditMode();
        this.onRender?.();
        
        // 等待渲染完成后，聚焦并进入新块的编辑模式
        setTimeout(() => {
            this.focusAndEditBlock(newBlock.id);
        }, 150); // 增加延迟以确保渲染完成
    }

    /**
     * 聚焦并进入块的编辑模式（Live Preview 专用）
     */
    private focusAndEditBlock(blockId: string): void {
        // 在 Live Preview 模式下，需要找到对应的 displayElement 并点击它来进入编辑模式
        const blockElement = document.querySelector(`[data-block-id="${blockId}"]`);
        if (blockElement) {
            const displayElement = blockElement.querySelector('.workflowy-content-display') as HTMLElement;
            if (displayElement) {
                // 模拟点击进入编辑模式
                displayElement.click();
            } else {
                // 源码模式，直接聚焦 contentElement
                const contentElement = blockElement.querySelector('.workflowy-content') as HTMLElement;
                if (contentElement) {
                    contentElement.focus();
                }
            }
        }
    }
}
