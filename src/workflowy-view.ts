import { FileView, WorkspaceLeaf, TFile, Menu } from 'obsidian';
import { WORKFLOWY_VIEW_TYPE } from './constants';
import { BlockEditor } from './block-editor';
import { OutlineItem } from './ui/outline-item';
import { OutlineBlock } from './types';
import { getAllBlocks } from './utils';
import { EventDelegator } from './isolation/event-delegator';
import { VerticalLinesManager } from './features/vertical-lines';
import { MultiSelectionManager } from './features/multi-selection';
import { ZoomManager } from './features/zoom';
import { NavigationHeader } from './ui/navigation-header';
import { ThemeManager } from './features/theme-manager';
// import WorkflowyPlugin from './main';

export class WorkflowyView extends FileView {
    private plugin: any;
    private editor: BlockEditor;
    // file 属性由 FileView 提供，不需要重新声明
    private container: HTMLElement;
    private blockElements: Map<string, OutlineItem> = new Map();
    private containerSelector: string | null = null;
    private verticalLinesManager: VerticalLinesManager | null = null;
    private multiSelectionManager: MultiSelectionManager | null = null;
    private zoomManager: ZoomManager | null = null;
    private navigationHeader: NavigationHeader | null = null;
    private themeManager: ThemeManager | null = null;

    constructor(leaf: WorkspaceLeaf, plugin: any) {
        super(leaf);
        this.plugin = plugin;
        this.editor = new BlockEditor();

        // 初始化Zoom管理器
        this.zoomManager = new ZoomManager(
            this.editor,
            () => this.getDocumentTitle()
        );

        // 设置Zoom变化回调
        this.zoomManager.setOnZoomChange((zoomedBlockId) => {
            this.handleZoomChange(zoomedBlockId);
        });

        // 初始化主题管理器
        const savedTheme = this.plugin.settings?.ui?.theme || 'default';
        this.themeManager = new ThemeManager(savedTheme);

        // 设置主题变化回调（保存到设置）
        this.themeManager.setOnThemeChange((themeId) => {
            if (this.plugin.settings) {
                this.plugin.settings.ui.theme = themeId;
                this.plugin.saveSettings();
            }
        });
    }

    getViewType(): string {
        return WORKFLOWY_VIEW_TYPE;
    }

    getDisplayText(): string {
        return this.file?.basename || 'Workflowy View';
    }

    getIcon(): string {
        return 'list-tree';
    }

    async onOpen(): Promise<void> {
        this.container = this.contentEl;
        this.container.empty();
        this.container.addClass('workflowy-container');

        // 为当前视图生成唯一容器选择器，供 EventDelegator 使用
        const uniqueId = `workflowy-container-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        this.container.setAttribute('id', uniqueId);
        this.containerSelector = `#${uniqueId}`;

        // 设置主题管理器的容器并应用主题
        if (this.themeManager) {
            this.themeManager.setContainer(this.container);
        }

        // 通过 EventDelegator 在捕获阶段注册键盘事件，避免被 Obsidian 原生快捷键抢先处理
        EventDelegator.getInstance().registerEvent(
            'keydown',
            this.containerSelector,
            (ev: Event) => {
                const e = ev as KeyboardEvent;

                // 检查是否有多选状态
                const hasMultiSelection = this.multiSelectionManager && 
                    this.multiSelectionManager.getSelectedBlocks().length > 0;

                // 检查是否是多选相关的键盘事件
                const isMultiSelectionKey = hasMultiSelection &&
                    (e.key === 'Delete' || 
                     e.key === 'Backspace' || 
                     e.key === 'Escape' || 
                     e.key === 'Tab' ||  // TAB 键也是多选相关的
                     (e.key === 'a' && (e.ctrlKey || e.metaKey)));

                if (isMultiSelectionKey) {
                    // 多选模式下的相关键，不阻止传播，让多选管理器优先处理
                    return;
                }

                const target = e.target as HTMLElement;

                // 检查是否是 Markdown 快捷键（Live Preview 模式需要）
                const isMod = e.ctrlKey || e.metaKey;
                const isMarkdownShortcut = isMod && (
                    e.key === 'b' ||  // 加粗
                    e.key === 'i' ||  // 斜体
                    e.key === 'k' ||  // 链接
                    (e.shiftKey && e.key === 'H')  // 高亮
                );

                // 检查当前是否在 Live Preview 模式的 textarea 中
                const isInLivePreviewEditor = target.classList.contains('workflowy-content-editor') ||
                    target.closest('.workflowy-content-editor');

                // 如果是 Markdown 快捷键且在 Live Preview 编辑器中，不阻止传播
                // 让 LivePreviewEditor 处理
                if (isMarkdownShortcut && isInLivePreviewEditor) {
                    return;
                }

                // 立即阻止事件传播，防止被 Obsidian 原生快捷键处理
                e.stopImmediatePropagation();

                // 锁定到所在的内容元素
                let contentEl = target.closest('.workflowy-content') as HTMLElement | null;
                if (!contentEl && document.activeElement) contentEl = (document.activeElement as HTMLElement).closest('.workflowy-content');

                const hostItemEl = contentEl?.closest('.workflowy-item') as HTMLElement | null;
                let blockId = contentEl?.getAttribute('data-block-id')
                    || hostItemEl?.getAttribute('data-block-id')
                    || null;

                if (!blockId && typeof (this as any).getFocusedBlockId === 'function') {
                    const focusedId = (this as any).getFocusedBlockId();
                    if (focusedId) {
                        blockId = focusedId;
                    }
                }

                if (!blockId) {
                    console.warn('[WorkflowyView] No blockId for keydown, skipping dispatch');
                    return;
                }

                const item = this.blockElements.get(blockId);
                if (item && typeof (item as any).onKeyDownDelegated === 'function') {
                    (item as any).onKeyDownDelegated(e);
                } else {
                    console.warn('[WorkflowyView] No OutlineItem found for blockId:', blockId);
                }
            },
            { capture: true } // 明确指定捕获阶段
        );

        // 创建导航头部（包含面包屑和搜索框）
        this.createNavigationHeader();

        // 创建主编辑区域
        this.container.createDiv('workflowy-editor');

        // 如果文件还没有加载，尝试从视图状态中加载
        if (!this.file) {
            const state = this.leaf.getViewState();
            if (state.state?.file && typeof state.state.file === 'string') {
                await this.loadFile(state.state.file);
            }
        }

        // 渲染块
        this.renderBlocks();
    }

    async onClose(): Promise<void> {
        // 保存所有正在编辑的内容
        this.saveAllEditingContent();
        
        // 保存当前状态
        if (this.file) {
            await this.saveToFile();
        }

        // 反注册键盘事件委托
        if (this.containerSelector) {
            EventDelegator.getInstance().unregisterEvent('keydown', this.containerSelector);
            this.containerSelector = null;
        }

        // 销毁导航头部
        if (this.navigationHeader) {
            this.navigationHeader.destroy();
            this.navigationHeader = null;
        }

        // 销毁垂直线管理器
        if (this.verticalLinesManager) {
            this.verticalLinesManager.destroy();
            this.verticalLinesManager = null;
        }

        // 销毁多选管理器
        if (this.multiSelectionManager) {
            this.multiSelectionManager.destroy();
            this.multiSelectionManager = null;
        }

        // 清理zoom管理器
        this.zoomManager = null;

        // 清理块元素
        this.blockElements.clear();
    }

    async setState(state: any, result: any): Promise<void> {
        // 确保 result 对象存在且 history 标志被正确设置
        // 这对于导航历史记录至关重要
        if (result && typeof result === 'object') {
            // 如果文件发生变化，应该记录到历史中
            if (state?.file && state.file !== this.file?.path) {
                result.history = true;
            }
        }
        
        // FileView 会自动处理文件加载
        // 调用父类的 setState，它会触发 onLoadFile
        return super.setState(state, result);
    }

    getState(): any {
        // FileView 期望的状态结构：直接返回状态对象，不包含 type
        // type 由 leaf 的 viewState 管理
        return {
            file: this.file?.path
        };
    }

    // 重写菜单方法，添加切换选项
    onPaneMenu(menu: Menu, source: string): void {
        super.onPaneMenu(menu, source);

        if (source === 'more-options' && this.file) {
            menu.addItem((item) => {
                item.setTitle('打开为Markdown')
                    .setIcon('edit')
                    .onClick(() => {
                        this.plugin.openAsMarkdown(this.file!);
                    });
            });
        }
    }

    /**
     * 创建导航头部（面包屑+搜索框）
     */
    private createNavigationHeader(): void {
        // 创建NavigationHeader实例
        this.navigationHeader = new NavigationHeader();
        this.navigationHeader.create(this.container);

        // 设置主题管理器
        if (this.themeManager) {
            this.navigationHeader.setThemeManager(this.themeManager);
        }

        // 设置面包屑点击回调
        this.navigationHeader.setOnBreadcrumbClick((blockId) => {
            this.handleBreadcrumbClick(blockId);
        });

        // 设置搜索回调
        this.navigationHeader.setOnSearch((query) => {
            this.handleSearch(query);
        });

        // 初始化显示根面包屑
        this.updateNavigationHeader();
    }

    /**
     * 获取文档标题
     */
    private getDocumentTitle(): string {
        return this.file?.basename || 'Untitled';
    }

    /**
     * 更新导航头部
     */
    private updateNavigationHeader(): void {
        if (!this.navigationHeader || !this.zoomManager) {
            return;
        }

        const breadcrumbs = this.zoomManager.collectBreadcrumbs();
        this.navigationHeader.updateBreadcrumbs(breadcrumbs);

        // 根据是否缩放控制搜索框的显示/隐藏
        if (this.zoomManager.isZoomed()) {
            this.navigationHeader.hideSearch();
            this.navigationHeader.show();
        } else {
            this.navigationHeader.showSearch();
            this.navigationHeader.show();
        }
    }

    /**
     * 处理面包屑点击
     */
    private handleBreadcrumbClick(blockId: string | null): void {
        if (!this.zoomManager) {
            return;
        }

        if (blockId === null) {
            // 点击根节点，退出缩放
            this.zoomManager.zoomOut();
        } else {
            // 缩放到指定块
            this.zoomManager.zoomIn(blockId);
        }
    }

    /**
     * 处理Zoom状态变化
     */
    private handleZoomChange(zoomedBlockId: string | null): void {
        // 更新导航头部
        this.updateNavigationHeader();

        // 重新渲染块（应用zoom过滤）
        this.renderBlocks();

        // 如果缩放到某个块，聚焦到该块，光标在末尾
        if (zoomedBlockId) {
            setTimeout(() => {
                const item = this.blockElements.get(zoomedBlockId);
                if (item) {
                    // 使用 OutlineItem 的 focus() 方法，自动处理两种模式
                    item.focus();
                    
                    // 将光标移到末尾
                    const element = item.getElement();
                    // 支持两种模式：Live Preview (.workflowy-content-editor) 和源码模式 (.workflowy-content)
                    const contentEl = element.querySelector('.workflowy-content-editor, .workflowy-content') as HTMLElement;
                    
                    if (contentEl) {
                        // 如果是 textarea（Live Preview 模式）
                        if (contentEl instanceof HTMLTextAreaElement) {
                            contentEl.setSelectionRange(contentEl.value.length, contentEl.value.length);
                        } else {
                            // contenteditable div（源码模式）
                            const selection = window.getSelection();
                            if (selection) {
                                const range = document.createRange();
                                try {
                                    if (contentEl.childNodes.length > 0) {
                                        range.selectNodeContents(contentEl);
                                        range.collapse(false); // false = 末尾
                                    } else {
                                        range.setStart(contentEl, 0);
                                        range.setEnd(contentEl, 0);
                                    }
                                    selection.removeAllRanges();
                                    selection.addRange(range);
                                } catch (error) {
                                    console.error('[WorkflowyView] Error setting cursor to end:', error);
                                }
                            }
                        }
                    }
                }
            }, 100);
        }
    }

    private async loadFile(filePath: string): Promise<void> {
        const file = this.app.vault.getAbstractFileByPath(filePath);
        if (file instanceof TFile) {
            this.file = file;
            const content = await this.app.vault.read(file);
            this.editor.loadFromMarkdown(content);
            this.renderBlocks();

            // 文件加载后更新导航头部，显示正确的文件名
            this.updateNavigationHeader();
        } else {
            console.error('[WorkflowyView] File not found or not a TFile:', filePath);
        }
    }

    private async saveToFile(): Promise<void> {
        if (!this.file) return;

        const markdown = this.editor.toMarkdown();
        await this.app.vault.modify(this.file, markdown);
    }

    private async renderBlocks(): Promise<void> {
        const editorContainer = this.container.querySelector('.workflowy-editor');
        if (!editorContainer) {
            console.error('[WorkflowyView] Editor container not found!');
            return;
        }

        editorContainer.empty();
        this.blockElements.clear();

        const state = this.editor.getState();

        // 收集所有异步渲染的 Promise
        const renderPromises: Promise<void>[] = [];

        // 如果有zoom状态，只渲染zoom的块及其子块
        if (this.zoomManager && this.zoomManager.isZoomed()) {
            const zoomedBlockId = this.zoomManager.getZoomedBlockId();
            if (zoomedBlockId) {
                // 重要：每次渲染时重新获取最新的块数据
                const allBlocks = getAllBlocks(state.blocks);
                const zoomedBlock = allBlocks.find(b => b.id === zoomedBlockId);

                if (zoomedBlock) {
                    // 只渲染缩放块及其子块
                    await this.renderZoomedBlock(zoomedBlock, editorContainer as HTMLElement);
                } else {
                    // 找不到缩放块，退出缩放
                    console.warn('[WorkflowyView] Zoomed block not found, exiting zoom');
                    this.zoomManager.zoomOut();
                    const promises = this.renderBlockList(state.blocks, editorContainer as HTMLElement);
                    renderPromises.push(...promises);
                }
            } else {
                const promises = this.renderBlockList(state.blocks, editorContainer as HTMLElement);
                renderPromises.push(...promises);
            }
        } else {
            const promises = this.renderBlockList(state.blocks, editorContainer as HTMLElement);
            renderPromises.push(...promises);
        }

        // 等待所有异步渲染完成
        await Promise.all(renderPromises);

        // 如果没有块，创建一个空块（仅在非zoom状态下）
        if (state.blocks.length === 0 && !this.zoomManager?.isZoomed()) {
            this.editor.createNewBlock();
            this.renderBlocks();
            return;
        }

        // 如果在zoom状态下，但zoom的块没有内容和子块，也需要保持显示
        if (this.zoomManager?.isZoomed()) {
            const zoomedBlockId = this.zoomManager.getZoomedBlockId();
            if (zoomedBlockId && this.blockElements.size === 0) {
                console.warn('[WorkflowyView] Zoom block has no content, but should still be visible');
            }
        }

        // 等待DOM渲染完成后初始化垂直线管理器和多选管理器
        requestAnimationFrame(() => {
            // 在zoom模式下，垂直线管理器需要使用调整后的level
            this.initializeVerticalLines(editorContainer as HTMLElement);
            this.initializeMultiSelection(editorContainer as HTMLElement);
        });
    }

    /**
     * 初始化垂直线管理器
     */
    private initializeVerticalLines(editorContainer: HTMLElement): void {
        // 销毁旧的垂直线管理器
        if (this.verticalLinesManager) {
            this.verticalLinesManager.destroy();
        }

        // 创建新的垂直线管理器
        this.verticalLinesManager = new VerticalLinesManager(
            editorContainer,
            this.editor,
            (blockId: string) => this.handleVerticalLineClick(blockId)
        );

        // 使用 requestAnimationFrame 确保DOM渲染完成
        requestAnimationFrame(() => {
            if (this.verticalLinesManager) {
                this.verticalLinesManager.update();
            }
        });
    }

    /**
     * 初始化多选管理器
     */
    private initializeMultiSelection(editorContainer: HTMLElement): void {
        // 保存旧的选择状态
        let previousSelection: string[] = [];
        if (this.multiSelectionManager) {
            previousSelection = this.multiSelectionManager.getSelectedBlocks();
            this.multiSelectionManager.destroy();
        }

        // 创建新的多选管理器
        this.multiSelectionManager = new MultiSelectionManager(
            editorContainer,
            this.editor,
            (selectedIds: string[]) => this.handleSelectionChange(selectedIds),
            () => this.renderBlocks()
        );

        // 恢复选择状态
        if (previousSelection.length > 0) {
            // 使用 requestAnimationFrame 确保 DOM 已经渲染完成
            requestAnimationFrame(() => {
                if (this.multiSelectionManager) {
                    this.multiSelectionManager.setSelectedBlocks(previousSelection);
                }
            });
        }
    }

    /**
     * 处理选择变化事件
     */
    private handleSelectionChange(selectedIds: string[]): void {
        // 可以在这里添加选择状态的UI反馈
    }

    /**
     * 处理垂直线点击事件
     * 注意：垂直线管理器已经处理了折叠逻辑，这里只需要更新视图
     */
    private handleVerticalLineClick(blockId: string): void {
        // 只触发视图更新，不再调用 toggleCollapse
        // 因为 VerticalLinesManager 已经处理了折叠逻辑
        this.renderBlocks();

        // 恢复焦点到被点击的块
        setTimeout(() => {
            const item = this.blockElements.get(blockId);
            if (item) {
                item.focus();
            }
        }, 100);
    }

    /**
     * 处理bullet点击事件（缩放功能）
     */
    private handleBulletClick(blockId: string): void {
        if (!this.zoomManager) {
            return;
        }

        // 如果当前已经缩放到该块，则退出缩放
        if (this.zoomManager.getZoomedBlockId() === blockId) {
            this.zoomManager.zoomOut();
        } else {
            // 缩放到该块
            this.zoomManager.zoomIn(blockId);
        }
    }

    private renderBlockList(blocks: OutlineBlock[], container: HTMLElement, parentCompletedTodo: boolean = false): Promise<void>[] {
        const renderPromises: Promise<void>[] = [];

        for (let i = 0; i < blocks.length; i++) {
            const block = blocks[i];

            try {
                // 使用统一的 OutlineItem 实现
                const blockItem = new OutlineItem(
                    block,
                    this.editor,
                    (blockId, content) => this.handleBlockUpdate(blockId, content),
                    (blockId) => this.handleBlockFocus(blockId),
                    async () => await this.renderBlocks(), // 重新渲染回调（异步）
                    () => this.multiSelectionManager, // 多选管理器获取函数
                    (blockId) => this.handleBulletClick(blockId), // bullet点击回调（用于zoom）
                    () => this.zoomManager?.getZoomedBlockId() || null, // 获取当前zoom的块ID
                    this.app, // Obsidian App 实例
                    this.file?.path || '', // 文件路径
                    this.plugin.settings // 插件设置
                );

                // 如果是异步渲染的块，收集 Promise
                const renderPromise = blockItem.waitForRender();
                if (renderPromise) {
                    renderPromises.push(renderPromise);
                }

                const element = blockItem.getElement();
                
                // 如果父节点是已完成的待办，为子节点添加特殊类名
                if (parentCompletedTodo) {
                    element.classList.add('child-of-completed-todo');
                }

                container.appendChild(element);
                this.blockElements.set(block.id, blockItem);

                // 渲染子块（如果未折叠）
                if (block.children.length > 0 && !this.editor.isCollapsed(block.id)) {
                    const childContainer = container.createDiv('workflowy-children');
                    // 如果当前节点是已完成的待办，传递标记给子节点
                    const isCompletedTodo = block.isTodo && block.todoCompleted;
                    const childPromises = this.renderBlockList(block.children, childContainer, isCompletedTodo || parentCompletedTodo);
                    renderPromises.push(...childPromises);
                }
            } catch (error) {
                console.error('[WorkflowyView] Error rendering block:', error);
                console.error('[WorkflowyView] Block data:', block);
            }
        }

        return renderPromises;
    }

    private handleBlockUpdate(blockId: string, content: string): void {
        this.editor.updateBlockContent(blockId, content);

        // 更新垂直线（不需要完整重新渲染）
        // 使用 requestAnimationFrame 确保 DOM 更新后再计算
        if (this.verticalLinesManager) {
            requestAnimationFrame(() => {
                if (this.verticalLinesManager) {
                    this.verticalLinesManager.update();
                }
            });
        }

        // 自动保存
        if (this.file) {
            this.saveToFile();
        }
    }

    /**
     * 渲染缩放后的块（只渲染该块和子块）
     * 缩放后的块显示为第一级（level 0），子块相应调整级别
     */
    private async renderZoomedBlock(block: OutlineBlock, container: HTMLElement, parentCompletedTodo: boolean = false): Promise<void> {
        try {
            // 创建一个临时块副本，将其level设置为0（显示为第一级）
            const zoomedBlockCopy: OutlineBlock = {
                ...block,
                level: 0
            };

            // 渲染缩放目标块
            const blockItem = new OutlineItem(
                zoomedBlockCopy,
                this.editor,
                (blockId, content) => this.handleBlockUpdate(blockId, content),
                (blockId) => this.handleBlockFocus(blockId),
                async () => await this.renderBlocks(),
                () => this.multiSelectionManager,
                (blockId) => this.handleBulletClick(blockId),
                () => this.zoomManager?.getZoomedBlockId() || null, // 获取当前zoom的块ID
                this.app, // Obsidian App 实例
                this.file?.path || '', // 文件路径
                this.plugin.settings // 插件设置
            );

            const element = blockItem.getElement();

            if (parentCompletedTodo) {
                element.classList.add('child-of-completed-todo');
            }

            container.appendChild(element);
            this.blockElements.set(block.id, blockItem);

            // 渲染子块（子块的level也需要相应调整）
            if (block.children.length > 0 && !this.editor.isCollapsed(block.id)) {
                const childContainer = container.createDiv('workflowy-children');
                const isCompletedTodo = block.isTodo && block.todoCompleted;

                // 调整子块的level，使其相对于缩放块显示
                const adjustedChildren = this.adjustChildrenLevel(block.children, block.level);
                const childPromises = this.renderBlockList(adjustedChildren, childContainer, isCompletedTodo || parentCompletedTodo);
                await Promise.all(childPromises);
            } else {
                
                // 如果没有子节点，显示"点击新增节点"提示
                if (block.children.length === 0) {
                    const emptyHint = container.createDiv('workflowy-empty-hint');
                    emptyHint.textContent = '点击新增节点';
                    emptyHint.style.cssText = `
                        padding-left: 60px;
                        color: var(--text-muted);
                        font-style: italic;
                        cursor: pointer;
                        padding-top: 8px;
                        padding-bottom: 8px;
                    `;
                    
                    // 点击提示时创建第一个子节点
                    emptyHint.addEventListener('click', () => {
                        const newBlock = this.editor.createChildBlock(block.id);
                        this.renderBlocks();
                        
                        // 聚焦到新创建的块
                        setTimeout(() => {
                            const blockItem = this.blockElements.get(newBlock.id);
                            if (blockItem) {
                                blockItem.focus();
                            }
                        }, 50);
                    });
                }
            }
        } catch (error) {
            console.error('[WorkflowyView] Error rendering zoomed block:', error);
        }
    }

    /**
     * 调整子块的level，使其相对于缩放块的原始level
     */
    private adjustChildrenLevel(children: OutlineBlock[], baseLevel: number): OutlineBlock[] {
        return children.map(child => ({
            ...child,
            level: child.level - baseLevel,
            children: this.adjustChildrenLevel(child.children, baseLevel)
        }));
    }

    private handleBlockFocus(blockId: string): void {
        this.editor.focusBlock(blockId);

        // 移除其他块的焦点样式
        this.blockElements.forEach((item, id) => {
            if (id !== blockId) {
                item.blur();
            }
        });

        // 更新导航头部的面包屑（显示当前聚焦块的路径）
        if (this.zoomManager && this.zoomManager.isZoomed()) {
            this.updateNavigationHeader();
        }
    }

    collapseAll(): void {
        const allBlocks = getAllBlocks(this.editor.getState().blocks);
        for (const block of allBlocks) {
            if (block.children.length > 0) {
                this.editor.toggleCollapse(block.id);
            }
        }
        this.renderBlocks();
    }

    expandAll(): void {
        const state = this.editor.getState();
        state.collapsedBlocks.clear();
        this.renderBlocks();
    }

    private handleSearch(query: string): void {
        const trimmedQuery = query.trim();
        
        // 清空搜索
        if (!trimmedQuery) {
            this.clearSearch();
            return;
        }

        const searchMode = this.plugin.settings.search.mode;
        const caseSensitive = this.plugin.settings.search.caseSensitive;
        const autoExpand = this.plugin.settings.search.autoExpandMatches;

        if (searchMode === 'highlight') {
            this.handleHighlightSearch(trimmedQuery, caseSensitive);
        } else {
            this.handleFilterSearch(trimmedQuery, caseSensitive, autoExpand);
        }
    }

    /**
     * 高亮搜索模式：高亮匹配的节点，显示所有内容
     */
    private handleHighlightSearch(query: string, caseSensitive: boolean): void {
        const allBlocks = getAllBlocks(this.editor.getState().blocks);
        const matchingBlocks = this.findMatchingBlocks(allBlocks, query, caseSensitive);

        // 移除所有过滤样式和搜索状态类
        this.blockElements.forEach((item) => {
            const element = item.getElement();
            element.classList.remove('workflowy-filtered-hidden');
            element.classList.remove('search-matched-node');
            element.classList.remove('search-parent-node');
            element.style.display = '';
        });

        // 高亮匹配的文本
        this.blockElements.forEach((item, blockId) => {
            // 支持两种模式：Live Preview (.workflowy-content-wrapper) 和源码模式 (.workflowy-content)
            const contentEl = item.getElement().querySelector('.workflowy-content-wrapper, .workflowy-content') as HTMLElement;
            if (!contentEl) return;

            if (matchingBlocks.has(blockId)) {
                this.highlightTextInContent(contentEl, query, caseSensitive);
            } else {
                this.removeTextHighlight(contentEl);
            }
        });
    }

    /**
     * 过滤搜索模式：只显示匹配的节点及其父节点
     */
    private handleFilterSearch(query: string, caseSensitive: boolean, autoExpand: boolean): void {
        const allBlocks = getAllBlocks(this.editor.getState().blocks);
        const matchingBlocks = this.findMatchingBlocks(allBlocks, query, caseSensitive);
        
        // 收集所有应该可见的节点（匹配节点 + 祖先节点）
        const visibleBlocks = this.collectVisibleBlocks(allBlocks, matchingBlocks);

        // 如果启用自动展开，展开包含匹配内容的折叠节点
        if (autoExpand) {
            this.expandMatchedBlocks(matchingBlocks);
        }

        // 应用过滤：隐藏不在可见集合中的节点
        this.blockElements.forEach((item, blockId) => {
            const element = item.getElement();
            // 支持两种模式：Live Preview (.workflowy-content-wrapper) 和源码模式 (.workflowy-content)
            const contentEl = element.querySelector('.workflowy-content-wrapper, .workflowy-content') as HTMLElement;
            const collapseEl = element.querySelector('.workflowy-collapse');
            const collapsePlaceholder = element.querySelector('.workflowy-collapse-placeholder');
            const hasChildren = !!(collapseEl || collapsePlaceholder);
            
            if (visibleBlocks.has(blockId)) {
                // 可见节点
                element.classList.remove('workflowy-filtered-hidden');
                element.style.display = '';
                
                // 区分匹配节点和父节点
                if (matchingBlocks.has(blockId)) {
                    // 匹配的节点
                    element.classList.add('search-matched-node');
                    element.classList.remove('search-parent-node');
                    
                    // 高亮匹配的文本
                    if (contentEl) {
                        this.highlightTextInContent(contentEl, query, caseSensitive);
                    }
                } else {
                    // 父节点（非匹配但可见）
                    element.classList.remove('search-matched-node');
                    element.classList.add('search-parent-node');
                    
                    // 移除文本高亮
                    if (contentEl) {
                        this.removeTextHighlight(contentEl);
                    }
                }
            } else {
                // 隐藏节点
                element.classList.add('workflowy-filtered-hidden');
                element.style.display = 'none';
                element.classList.remove('search-matched-node');
                element.classList.remove('search-parent-node');
                
                if (contentEl) {
                    this.removeTextHighlight(contentEl);
                }
            }
        });
    }

    /**
     * 查找匹配的节点
     */
    private findMatchingBlocks(blocks: OutlineBlock[], query: string, caseSensitive: boolean): Set<string> {
        const matchingIds = new Set<string>();
        const searchQuery = caseSensitive ? query : query.toLowerCase();

        for (const block of blocks) {
            const content = caseSensitive ? block.content : block.content.toLowerCase();
            if (content.includes(searchQuery)) {
                matchingIds.add(block.id);
            }
        }

        return matchingIds;
    }

    /**
     * 收集所有应该可见的节点（匹配节点 + 所有祖先节点）
     */
    private collectVisibleBlocks(allBlocks: OutlineBlock[], matchingBlocks: Set<string>): Set<string> {
        const visibleBlocks = new Set<string>();

        // 为每个匹配的节点，添加它和它的所有祖先
        for (const blockId of matchingBlocks) {
            const block = allBlocks.find(b => b.id === blockId);
            if (block) {
                // 添加当前节点
                visibleBlocks.add(blockId);
                
                // 添加所有祖先节点
                this.addAncestors(block, allBlocks, visibleBlocks);
            }
        }

        return visibleBlocks;
    }

    /**
     * 递归添加所有祖先节点
     */
    private addAncestors(block: OutlineBlock, allBlocks: OutlineBlock[], visibleSet: Set<string>): void {
        // 查找父节点
        const parent = this.findParentBlock(block, allBlocks);
        if (parent) {
            visibleSet.add(parent.id);
            // 递归添加父节点的祖先
            this.addAncestors(parent, allBlocks, visibleSet);
        }
    }

    /**
     * 查找节点的父节点
     */
    private findParentBlock(block: OutlineBlock, allBlocks: OutlineBlock[]): OutlineBlock | null {
        for (const potentialParent of allBlocks) {
            if (potentialParent.children.some(child => child.id === block.id)) {
                return potentialParent;
            }
            // 递归查找子节点中的父节点
            const parentInChildren = this.findParentInChildren(block, potentialParent.children);
            if (parentInChildren) {
                return parentInChildren;
            }
        }
        return null;
    }

    /**
     * 在子节点中递归查找父节点
     */
    private findParentInChildren(block: OutlineBlock, children: OutlineBlock[]): OutlineBlock | null {
        for (const child of children) {
            if (child.children.some(c => c.id === block.id)) {
                return child;
            }
            const found = this.findParentInChildren(block, child.children);
            if (found) {
                return found;
            }
        }
        return null;
    }

    /**
     * 展开包含匹配内容的折叠节点
     * 包括匹配节点本身和包含匹配节点的父节点
     */
    private expandMatchedBlocks(matchingBlocks: Set<string>): void {
        const state = this.editor.getState();
        const allBlocks = getAllBlocks(state.blocks);
        const blocksToExpand = new Set<string>();
        
        // 1. 收集所有匹配节点
        for (const blockId of matchingBlocks) {
            blocksToExpand.add(blockId);
        }
        
        // 2. 收集所有包含匹配节点的父节点
        for (const blockId of matchingBlocks) {
            const block = allBlocks.find(b => b.id === blockId);
            if (block) {
                // 向上查找所有祖先节点
                let parent = this.findParentBlock(block, allBlocks);
                while (parent) {
                    blocksToExpand.add(parent.id);
                    parent = this.findParentBlock(parent, allBlocks);
                }
            }
        }
        
        // 3. 展开所有需要展开的节点
        for (const blockId of blocksToExpand) {
            if (state.collapsedBlocks.has(blockId)) {
                this.editor.toggleCollapse(blockId);
            }
        }
        
        // 重新渲染以应用展开状态
        this.renderBlocks();
    }

    /**
     * 在内容元素中高亮匹配的文本
     * 支持源码模式和 Live Preview 模式
     */
    private highlightTextInContent(contentEl: HTMLElement, query: string, caseSensitive: boolean): void {
        // Live Preview 模式：查找 .workflowy-content-display
        // 源码模式：直接使用 contentEl（.workflowy-content）
        const displayEl = contentEl.querySelector('.workflowy-content-display') as HTMLElement;
        const targetEl = displayEl || contentEl;
        
        if (!targetEl) return;
        
        // 获取纯文本内容
        const textContent = targetEl.textContent || '';
        if (!textContent) return;

        const searchQuery = caseSensitive ? query : query.toLowerCase();
        const searchContent = caseSensitive ? textContent : textContent.toLowerCase();
        
        // 找到所有匹配位置
        const matches: {start: number, end: number}[] = [];
        let index = 0;
        while ((index = searchContent.indexOf(searchQuery, index)) !== -1) {
            matches.push({start: index, end: index + query.length});
            index += query.length;
        }
        
        // 如果有匹配，构建带高亮的 HTML
        if (matches.length > 0) {
            let html = '';
            let lastIndex = 0;
            
            for (const match of matches) {
                // 添加匹配前的文本
                html += this.escapeHtml(textContent.substring(lastIndex, match.start));
                // 添加高亮的匹配文本
                html += '<mark class="search-highlight">' + 
                        this.escapeHtml(textContent.substring(match.start, match.end)) + 
                        '</mark>';
                lastIndex = match.end;
            }
            // 添加剩余文本
            html += this.escapeHtml(textContent.substring(lastIndex));
            
            // 设置 HTML（保留 contenteditable 属性）
            const isEditable = targetEl.getAttribute('contenteditable');
            targetEl.innerHTML = html;
            if (isEditable) {
                targetEl.setAttribute('contenteditable', isEditable);
            }
        }
    }

    /**
     * 移除内容元素中的文本高亮
     * 支持源码模式和 Live Preview 模式
     */
    private removeTextHighlight(contentEl: HTMLElement): void {
        // Live Preview 模式：查找 .workflowy-content-display
        // 源码模式：直接使用 contentEl（.workflowy-content）
        const displayEl = contentEl.querySelector('.workflowy-content-display') as HTMLElement;
        const targetEl = displayEl || contentEl;
        
        if (!targetEl) return;
        
        // 如果包含 mark 标签，移除它们
        const marks = targetEl.querySelectorAll('mark.search-highlight');
        if (marks.length > 0) {
            const textContent = targetEl.textContent || '';
            const isEditable = targetEl.getAttribute('contenteditable');
            targetEl.textContent = textContent;
            if (isEditable) {
                targetEl.setAttribute('contenteditable', isEditable);
            }
        }
    }

    /**
     * HTML 转义
     */
    private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 清除搜索状态
     */
    private clearSearch(): void {
        // 移除所有搜索相关的样式
        this.blockElements.forEach((item) => {
            const element = item.getElement();
            // 支持两种模式：Live Preview (.workflowy-content-wrapper) 和源码模式 (.workflowy-content)
            const contentEl = element.querySelector('.workflowy-content-wrapper, .workflowy-content') as HTMLElement;
            
            element.classList.remove('search-match');
            element.classList.remove('search-matched-node');
            element.classList.remove('search-parent-node');
            element.classList.remove('workflowy-filtered-hidden');
            element.style.display = '';
            
            // 移除文本高亮
            if (contentEl) {
                this.removeTextHighlight(contentEl);
            }
        });
        
        // 重要：触发垂直线重新计算
        // 延迟执行，确保 DOM 更新完成
        if (this.verticalLinesManager) {
            setTimeout(() => {
                if (this.verticalLinesManager) {
                    this.verticalLinesManager.update();
                }
            }, 50);
        }
    }

    // 公共方法供插件调用
    async openFile(file: TFile): Promise<void> {
        await this.loadFile(file.path);
    }

    getCurrentFile(): TFile | null {
        return this.file;
    }

    /**
     * FileView 必需方法：返回当前文件
     */
    getFile(): TFile | null {
        return this.file;
    }

    /**
     * FileView 必需属性：是否允许没有文件
     */
    allowNoFile = false;

    /**
     * FileView 必需方法：加载文件
     */
    async onLoadFile(file: TFile): Promise<void> {
        this.file = file;
        const content = await this.app.vault.read(file);
        this.editor.loadFromMarkdown(content);
        await this.renderBlocks();
        this.updateNavigationHeader();
    }

    /**
     * FileView 必需方法：卸载文件
     */
    async onUnloadFile(file: TFile): Promise<void> {
        // 保存当前状态
        if (this.file) {
            await this.saveToFile();
        }
        this.file = null;
    }

    /**
     * 允许 Obsidian 识别此视图可以显示文件
     */
    canAcceptExtension(extension: string): boolean {
        return extension === 'md';
    }

    // 编辑器命令 - 供快捷键调用
    getFocusedBlockId(): string | null {
        return this.editor.getState().focusedBlockId;
    }

    executeIndent(): boolean {
        const focusedId = this.getFocusedBlockId();
        if (!focusedId) return false;

        if (this.editor.indentBlock(focusedId)) {
            this.renderBlocks();
            // 恢复焦点
            setTimeout(() => {
                const item = this.blockElements.get(focusedId);
                item?.focus();
            }, 10);
            return true;
        }
        return false;
    }

    executeOutdent(): boolean {
        const focusedId = this.getFocusedBlockId();
        if (!focusedId) return false;

        if (this.editor.outdentBlock(focusedId)) {
            this.renderBlocks();
            setTimeout(() => {
                const item = this.blockElements.get(focusedId);
                item?.focus();
            }, 10);
            return true;
        }
        return false;
    }

    executeMoveUp(): boolean {
        const focusedId = this.getFocusedBlockId();
        if (!focusedId) return false;

        if (this.editor.moveBlockUp(focusedId)) {
            this.renderBlocks();
            setTimeout(() => {
                const item = this.blockElements.get(focusedId);
                item?.focus();
            }, 10);
            return true;
        }
        return false;
    }

    executeMoveDown(): boolean {
        const focusedId = this.getFocusedBlockId();
        if (!focusedId) return false;

        if (this.editor.moveBlockDown(focusedId)) {
            this.renderBlocks();
            setTimeout(() => {
                const item = this.blockElements.get(focusedId);
                item?.focus();
            }, 10);
            return true;
        }
        return false;
    }

    executeToggleCollapse(): boolean {
        const focusedId = this.getFocusedBlockId();
        if (!focusedId) return false;

        if (this.editor.toggleCollapse(focusedId)) {
            this.renderBlocks();
            setTimeout(() => {
                const item = this.blockElements.get(focusedId);
                item?.focus();
            }, 10);
            return true;
        }
        return false;
    }

    executeUndo(): boolean {
        if (this.editor.undo()) {
            // 检查撤销后的状态
            const state = this.editor.getState();

            // 如果在zoom状态下，检查zoom的块是否还存在
            if (this.zoomManager?.isZoomed()) {
                const zoomedBlockId = this.zoomManager.getZoomedBlockId();
                if (zoomedBlockId) {
                    const allBlocks = getAllBlocks(state.blocks);
                    const zoomedBlock = allBlocks.find(b => b.id === zoomedBlockId);

                    if (!zoomedBlock) {
                        console.warn('[WorkflowyView] Zoomed block no longer exists after undo, exiting zoom');
                        this.zoomManager.zoomOut();
                    }
                }
            }

            // 如果撤销后没有块，创建一个空块
            if (state.blocks.length === 0 && !this.zoomManager?.isZoomed()) {
                this.editor.createNewBlock();
            }

            this.renderBlocks();
            return true;
        }
        return false;
    }

    executeRedo(): boolean {
        if (this.editor.redo()) {
            // 检查重做后的状态
            const state = this.editor.getState();

            // 如果在zoom状态下，检查zoom的块是否还存在
            if (this.zoomManager?.isZoomed()) {
                const zoomedBlockId = this.zoomManager.getZoomedBlockId();
                if (zoomedBlockId) {
                    const allBlocks = getAllBlocks(state.blocks);
                    const zoomedBlock = allBlocks.find(b => b.id === zoomedBlockId);

                    if (!zoomedBlock) {
                        console.warn('[WorkflowyView] Zoomed block no longer exists after redo, exiting zoom');
                        this.zoomManager.zoomOut();
                    }
                }
            }

            // 如果重做后没有块，创建一个空块
            if (state.blocks.length === 0 && !this.zoomManager?.isZoomed()) {
                this.editor.createNewBlock();
            }

            this.renderBlocks();
            return true;
        }
        return false;
    }

    executeDeleteBlock(): boolean {
        const focusedId = this.getFocusedBlockId();
        if (!focusedId) return false;

        if (this.editor.deleteBlock(focusedId)) {
            this.renderBlocks();
            return true;
        }
        return false;
    }

    /**
     * 刷新视图（用于设置更改后重新渲染）
     */
    refresh(): void {
        // 在刷新前，保存所有正在编辑的内容
        this.saveAllEditingContent();
        this.renderBlocks();
    }

    /**
     * 保存所有正在编辑的内容（Live Preview 模式）
     */
    private saveAllEditingContent(): void {
        // 查找所有 textarea（不管是否可见）
        const allTextareas = this.container.querySelectorAll('.workflowy-content-editor');
        
        let savedCount = 0;
        allTextareas.forEach(textarea => {
            const blockId = (textarea as HTMLElement).getAttribute('data-block-id');
            const content = (textarea as HTMLTextAreaElement).value;
            
            // 只保存有内容变化的块
            if (blockId && content) {
                const currentBlock = this.editor.getState().blocks.find(b => b.id === blockId);
                if (currentBlock && currentBlock.content !== content) {
                    this.editor.updateBlockContent(blockId, content);
                    savedCount++;
                }
            }
        });

        // 保存到文件
        if (this.file && savedCount > 0) {
            this.saveToFile();
        }
    }
}