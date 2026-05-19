/**
 * 多选节点管理器
 * 支持鼠标拖拽选择多个节点，以及对选中节点进行批量操作
 */

import { OutlineBlock } from '../types';
import { BlockEditor } from '../block-editor';
import { getAllBlocks } from '../utils';

export class MultiSelectionManager {
    private editor: BlockEditor;
    private container: HTMLElement;
    private selectedBlocks: Set<string> = new Set();
    private isSelecting: boolean = false;
    private selectionStart: { x: number; y: number } | null = null;
    private selectionBox: HTMLElement | null = null;
    private justFinishedSelecting: boolean = false;
    private selectionCounter: HTMLElement | null = null;
    private onSelectionChange: (selectedIds: string[]) => void;
    private onRender: () => void;
    private updateThrottleTimer: number | null = null;
    private boundKeyDownHandler: (e: KeyboardEvent) => void;

    constructor(
        container: HTMLElement,
        editor: BlockEditor,
        onSelectionChange: (selectedIds: string[]) => void,
        onRender: () => void
    ) {
        this.container = container;
        this.editor = editor;
        this.onSelectionChange = onSelectionChange;
        this.onRender = onRender;
        this.bindEvents();
        this.createSelectionBox();
        this.createSelectionCounter();
    }

    /**
     * 创建选择框元素
     */
    private createSelectionBox(): void {
        this.selectionBox = document.createElement('div');
        this.selectionBox.className = 'workflowy-selection-box';
        this.selectionBox.style.cssText = `
            position: absolute;
            border: 2px dashed var(--text-accent);
            background: rgba(var(--color-accent-rgb), 0.1);
            pointer-events: none;
            z-index: 1000;
            display: none;
        `;
        document.body.appendChild(this.selectionBox);
    }

    /**
     * 创建选择计数器元素
     */
    private createSelectionCounter(): void {
        this.selectionCounter = document.createElement('div');
        this.selectionCounter.className = 'workflowy-selection-counter';
        this.selectionCounter.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--background-secondary);
            border: 1px solid var(--background-modifier-border);
            border-radius: 6px;
            padding: 8px 12px;
            font-size: 12px;
            color: var(--text-muted);
            z-index: 1001;
            display: none;
        `;
        document.body.appendChild(this.selectionCounter);
    }

    /**
     * 更新选择计数器
     */
    private updateSelectionCounter(): void {
        if (!this.selectionCounter) return;

        const count = this.selectedBlocks.size;
        if (count > 0) {
            this.selectionCounter.textContent = `已选择 ${count} 个节点`;
            this.selectionCounter.style.display = 'block';
        } else {
            this.selectionCounter.style.display = 'none';
        }
    }

    /**
     * 绑定事件监听器
     */
    private bindEvents(): void {
        // 鼠标按下开始选择
        this.container.addEventListener('mousedown', this.handleMouseDown.bind(this), true);
        
        // 鼠标移动更新选择区域
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        
        // 鼠标释放结束选择
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));
        
        // 键盘事件处理 - 在 document 级别捕获，确保能拦截所有键盘事件（包括 textarea）
        this.boundKeyDownHandler = this.handleKeyDown.bind(this);
        document.addEventListener('keydown', this.boundKeyDownHandler, true);
        
        // 点击空白区域清除选择
        this.container.addEventListener('click', this.handleContainerClick.bind(this));
    }

    /**
     * 处理鼠标按下事件
     */
    private handleMouseDown(e: MouseEvent): void {
        // 只处理左键
        if (e.button !== 0) return;
        
        const target = e.target as HTMLElement;
        
        // 检查是否点击了圆点（用于拖拽）
        const bulletElement = target.closest('.workflowy-bullet') as HTMLElement;
        if (bulletElement) {
            // 如果点击的是圆点，不处理多选逻辑，让拖拽功能处理
            return;
        }

        // 只在内容区域启动多选，避免与其他功能冲突
        // 支持源码模式和 Live Preview 模式
        const contentElement = target.closest('.workflowy-content, .workflowy-content-display, .workflowy-content-editor') as HTMLElement;
        if (!contentElement) {
            return;
        }
        
        // 如果点击的是折叠指示器或垂直线，不启动多选
        if (target.classList.contains('workflowy-collapse') ||
            target.classList.contains('workflowy-vertical-line') ||
            target.closest('.workflowy-collapse')) {
            return;
        }
        
        // 从内容元素或其父元素获取 blockId
        let blockElement = contentElement.closest('[data-block-id]') as HTMLElement;
        if (!blockElement) {
            // 尝试从内容元素的 data-block-id 属性获取
            const blockId = contentElement.getAttribute('data-block-id');
            if (blockId) {
                blockElement = contentElement;
            } else {
                return;
            }
        }
        
        const blockId = blockElement.dataset.blockId || blockElement.getAttribute('data-block-id');
        if (!blockId) return;
        
        // 如果按住 Ctrl/Cmd，切换单个节点选择
        if (e.ctrlKey || e.metaKey) {
            this.toggleBlockSelection(blockId);
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        
        // 如果点击的是已选中的节点，保持选择状态（可能要开始拖拽）
        if (this.selectedBlocks.has(blockId)) {
            return;
        }
        
        // 清除之前的选择
        this.clearSelection();
        
        // 准备开始拖拽选择，记录起始节点和位置
        this.isSelecting = true;
        this.selectionStart = { x: e.clientX, y: e.clientY };
        
        // 记录起始节点ID，用于后续精确选择
        (this.selectionStart as any).startBlockId = blockId;
        (this.selectionStart as any).startElement = blockElement;
        
        // 不阻止默认行为，让普通点击能正常进入编辑状态
        // 只有在实际开始拖拽时才阻止默认行为
    }

    /**
     * 处理鼠标移动事件
     */
    private handleMouseMove(e: MouseEvent): void {
        if (!this.isSelecting || !this.selectionStart) {
            return;
        }

        // 计算垂直移动距离
        const deltaY = e.clientY - this.selectionStart.y;
        const minDragDistance = 8; // 增加最小拖拽距离，避免误触

        if (Math.abs(deltaY) < minDragDistance) {
            return;
        }

        // 阻止默认行为，避免触发文本选择
        e.preventDefault();

        // 添加选择状态类名，禁用文本选择
        this.container.classList.add('selecting');

        // 显示选择框（垂直线条）
        if (this.selectionBox) {
            this.selectionBox.style.display = 'block';
            this.selectionBox.style.left = `${this.selectionStart.x - 2}px`;
            this.selectionBox.style.top = `${Math.min(this.selectionStart.y, e.clientY)}px`;
            this.selectionBox.style.width = '4px';
            this.selectionBox.style.height = `${Math.abs(deltaY)}px`;
        }

        // 使用节流机制更新选择，避免频繁更新
        if (this.updateThrottleTimer !== null) {
            return;
        }

        this.updateThrottleTimer = window.setTimeout(() => {
            this.updateThrottleTimer = null;
        }, 16); // 约 60fps

        // 基于垂直拖拽更新选择
        this.updateSelectionFromVerticalDrag(e.clientY);
    }

    /**
     * 处理鼠标释放事件
     */
    private handleMouseUp(e: MouseEvent): void {
        if (this.isSelecting) {
            // 移除选择状态类名
            this.container.classList.remove('selecting');

            // 隐藏选择框
            if (this.selectionBox) {
                this.selectionBox.style.display = 'none';
            }
            
            // 如果没有选中任何节点，说明是普通点击，清除选择状态
            if (this.selectedBlocks.size === 0) {
                this.isSelecting = false;
                this.selectionStart = null;
                return;
            }
            
            this.isSelecting = false;
            this.selectionStart = null;
            
            // 标记刚完成选择，避免立即清除
            this.justFinishedSelecting = true;
            setTimeout(() => {
                this.justFinishedSelecting = false;
            }, 300); // 增加到 300ms，确保点击事件不会清除选择
        }
    }

    /**
     * 基于垂直拖拽更新选择的节点
     */
    private updateSelectionFromVerticalDrag(currentY: number): void {
        if (!this.selectionStart) return;

        // 使用记录的起始节点ID，避免 elementFromPoint 的不准确性
        const startBlockId = (this.selectionStart as any).startBlockId;
        const startElement = (this.selectionStart as any).startElement as HTMLElement;

        if (!startBlockId || !startElement) return;

        // 获取所有可见的节点元素，按垂直位置排序
        const blockElements = Array.from(this.container.querySelectorAll('[data-block-id]')) as HTMLElement[];
        const sortedElements = blockElements
            .map(element => ({
                element,
                blockId: element.dataset.blockId!,
                rect: element.getBoundingClientRect()
            }))
            .filter(item => item.blockId) // 过滤掉没有 blockId 的元素
            .sort((a, b) => a.rect.top - b.rect.top);

        if (sortedElements.length === 0) return;

        // 找到当前鼠标位置对应的节点
        // 使用更可靠的方法：找到 Y 坐标最接近的节点
        let currentBlockId: string | null = null;
        let minDistance = Infinity;

        for (const item of sortedElements) {
            const rect = item.rect;
            const centerY = rect.top + rect.height / 2;
            const distance = Math.abs(centerY - currentY);

            if (distance < minDistance) {
                minDistance = distance;
                currentBlockId = item.blockId;
            }
        }

        if (!currentBlockId) return;

        // 找到起始和结束节点在排序列表中的索引
        const startIndex = sortedElements.findIndex(item => item.blockId === startBlockId);
        const endIndex = sortedElements.findIndex(item => item.blockId === currentBlockId);

        if (startIndex === -1 || endIndex === -1) return;

        // 选择范围内的所有节点
        const minIndex = Math.min(startIndex, endIndex);
        const maxIndex = Math.max(startIndex, endIndex);

        const newSelection = new Set<string>();
        for (let i = minIndex; i <= maxIndex; i++) {
            newSelection.add(sortedElements[i].blockId);
        }

        // 更新选择状态
        this.selectedBlocks = newSelection;
        this.updateSelectionDisplay();
        this.onSelectionChange(Array.from(this.selectedBlocks));
    }

    /**
     * 根据选择框更新选中的节点（保留原方法作为备用）
     */
    private updateSelectionFromBox(x: number, y: number, width: number, height: number): void {
        const selectionRect = { left: x, top: y, right: x + width, bottom: y + height };
        const newSelection = new Set<string>();

        // 检查所有可见的节点元素
        const blockElements = this.container.querySelectorAll('[data-block-id]');
        blockElements.forEach(element => {
            const rect = element.getBoundingClientRect();
            
            // 检查节点是否与选择框相交
            if (this.isRectIntersecting(rect, selectionRect)) {
                const blockId = (element as HTMLElement).dataset.blockId;
                if (blockId) {
                    newSelection.add(blockId);
                }
            }
        });

        // 更新选择状态
        this.selectedBlocks = newSelection;
        this.updateSelectionDisplay();
        this.onSelectionChange(Array.from(this.selectedBlocks));
    }

    /**
     * 检查两个矩形是否相交
     */
    private isRectIntersecting(rect: DOMRect, selectionRect: { left: number; top: number; right: number; bottom: number }): boolean {
        return !(rect.right < selectionRect.left || 
                rect.left > selectionRect.right || 
                rect.bottom < selectionRect.top || 
                rect.top > selectionRect.bottom);
    }

    /**
     * 切换单个节点的选择状态
     */
    private toggleBlockSelection(blockId: string): void {
        if (this.selectedBlocks.has(blockId)) {
            this.selectedBlocks.delete(blockId);
        } else {
            this.selectedBlocks.add(blockId);
        }
        
        this.updateSelectionDisplay();
        this.onSelectionChange(Array.from(this.selectedBlocks));
    }

    /**
     * 更新选择状态的视觉显示
     */
    private updateSelectionDisplay(): void {
        // 清除所有选择样式
        const allElements = this.container.querySelectorAll('.workflowy-item');
        allElements.forEach(element => {
            element.classList.remove('workflowy-selected');
        });

        // 添加选择样式到选中的节点
        this.selectedBlocks.forEach(blockId => {
            const element = this.container.querySelector(`[data-block-id="${blockId}"]`);
            if (element) {
                element.classList.add('workflowy-selected');
            }
        });

        // 更新选择计数器
        this.updateSelectionCounter();
    }

    /**
     * 处理容器点击事件
     */
    private handleContainerClick(e: MouseEvent): void {
        // 如果正在选择过程中或刚完成选择，不处理点击事件
        if (this.isSelecting || this.justFinishedSelecting) {
            return;
        }
        
        const target = e.target as HTMLElement;
        
        // 如果点击的不是节点元素，清除选择
        if (!target.closest('[data-block-id]')) {
            this.clearSelection();
        }
    }

    /**
     * 处理键盘事件
     */
    private handleKeyDown(e: KeyboardEvent): void {
        // 只在有选中节点时处理键盘事件
        if (this.selectedBlocks.size === 0) {
            return;
        }

        // 检查是否在搜索框中（搜索框有焦点时不处理多选删除）
        const activeElement = document.activeElement as HTMLElement;
        if (activeElement && activeElement.classList.contains('workflowy-search')) {
            return;
        }

        // 有选中节点就处理，不检查 target 是否在容器内
        // 因为多选状态下 target 可能是 body
        switch (e.key) {
            case 'Delete':
            case 'Backspace':
                this.deleteSelectedBlocks();
                e.preventDefault();
                e.stopImmediatePropagation();
                break;
                
            case 'Escape':
                this.clearSelection();
                e.preventDefault();
                e.stopImmediatePropagation();
                break;
                
            case 'Tab':
                if (e.shiftKey) {
                    this.outdentSelectedBlocks();
                } else {
                    this.indentSelectedBlocks();
                }
                e.preventDefault();
                e.stopImmediatePropagation();
                break;
                
            case 'a':
                if (e.ctrlKey || e.metaKey) {
                    this.selectAll();
                    e.preventDefault();
                    e.stopImmediatePropagation();
                }
                break;
        }
    }

    /**
     * 删除选中的节点
     */
    private deleteSelectedBlocks(): void {
        if (this.selectedBlocks.size === 0) {
            return;
        }

        // 按层级排序，先删除深层节点，避免删除父节点时子节点已经不存在
        const allBlocks = getAllBlocks(this.editor.getState().blocks);
        const selectedBlocksData = allBlocks.filter(block => this.selectedBlocks.has(block.id));
        selectedBlocksData.sort((a, b) => b.level - a.level);

        // 删除选中的节点
        selectedBlocksData.forEach(block => {
            this.editor.deleteBlock(block.id);
        });

        this.clearSelection();
        this.onRender();
    }

    /**
     * 缩进选中的节点
     */
    private indentSelectedBlocks(): void {
        if (this.selectedBlocks.size === 0) {
            return;
        }

        const allBlocks = getAllBlocks(this.editor.getState().blocks);
        const selectedBlocksData = allBlocks.filter(block => this.selectedBlocks.has(block.id));
        
        // 按文档顺序排序（从上到下）
        selectedBlocksData.sort((a, b) => {
            const aIndex = allBlocks.indexOf(a);
            const bIndex = allBlocks.indexOf(b);
            return aIndex - bIndex;
        });

        // 记录第一个选中节点的ID，用于恢复焦点
        const firstBlockId = selectedBlocksData[0]?.id;

        // 对每个选中的节点执行缩进操作
        selectedBlocksData.forEach(block => {
            this.editor.indentBlock(block.id);
        });

        this.onRender();

        // 恢复焦点到第一个选中的节点
        if (firstBlockId) {
            setTimeout(() => {
                this.focusBlock(firstBlockId);
            }, 50);
        }
    }

    /**
     * 取消缩进选中的节点
     */
    private outdentSelectedBlocks(): void {
        if (this.selectedBlocks.size === 0) {
            return;
        }

        const allBlocks = getAllBlocks(this.editor.getState().blocks);
        const selectedBlocksData = allBlocks.filter(block => this.selectedBlocks.has(block.id));
        
        // 按文档顺序排序（从上到下）
        selectedBlocksData.sort((a, b) => {
            const aIndex = allBlocks.indexOf(a);
            const bIndex = allBlocks.indexOf(b);
            return aIndex - bIndex;
        });

        // 记录第一个选中节点的ID，用于恢复焦点
        const firstBlockId = selectedBlocksData[0]?.id;

        // 对每个选中的节点执行取消缩进操作
        selectedBlocksData.forEach(block => {
            this.editor.outdentBlock(block.id);
        });

        this.onRender();

        // 恢复焦点到第一个选中的节点
        if (firstBlockId) {
            setTimeout(() => {
                this.focusBlock(firstBlockId);
            }, 50);
        }
    }

    /**
     * 聚焦块（支持源码模式和 Live Preview 模式）
     */
    private focusBlock(blockId: string): void {
        const blockElement = this.container.querySelector(`[data-block-id="${blockId}"]`);
        if (!blockElement) return;

        // 检查是否是 Live Preview 模式
        const displayElement = blockElement.querySelector('.workflowy-content-display') as HTMLElement;
        if (displayElement) {
            // Live Preview 模式：点击 displayElement 进入编辑模式
            displayElement.click();
        } else {
            // 源码模式：直接聚焦 contentElement
            const contentElement = blockElement.querySelector('.workflowy-content') as HTMLElement;
            if (contentElement) {
                contentElement.focus();
            }
        }
    }

    /**
     * 选择所有节点
     */
    private selectAll(): void {
        const allBlocks = getAllBlocks(this.editor.getState().blocks);
        this.selectedBlocks = new Set(allBlocks.map(block => block.id));
        this.updateSelectionDisplay();
        this.onSelectionChange(Array.from(this.selectedBlocks));
    }

    /**
     * 清除所有选择
     */
    public clearSelection(): void {
        this.selectedBlocks.clear();
        this.updateSelectionDisplay();
        this.onSelectionChange([]);
    }

    /**
     * 获取选中的节点ID列表
     */
    public getSelectedBlocks(): string[] {
        return Array.from(this.selectedBlocks);
    }

    /**
     * 检查节点是否被选中
     */
    public isBlockSelected(blockId: string): boolean {
        return this.selectedBlocks.has(blockId);
    }

    /**
     * 设置选中的节点
     */
    public setSelectedBlocks(blockIds: string[]): void {
        this.selectedBlocks = new Set(blockIds);
        this.updateSelectionDisplay();
        this.onSelectionChange(Array.from(this.selectedBlocks));
    }

    /**
     * 获取选中节点的数据
     */
    public getSelectedBlocksData(): OutlineBlock[] {
        const allBlocks = getAllBlocks(this.editor.getState().blocks);
        return allBlocks.filter(block => this.selectedBlocks.has(block.id));
    }

    /**
     * 开始拖拽选中的节点
     */
    public startDragSelectedBlocks(e: DragEvent): void {
        if (this.selectedBlocks.size === 0) {
            return;
        }
        
        // 设置拖拽数据 - 只传递 blockIds，避免循环引用
        if (e.dataTransfer) {
            e.dataTransfer.setData('text/plain', JSON.stringify({
                type: 'workflowy-multi-blocks',
                blockIds: Array.from(this.selectedBlocks)
            }));
            e.dataTransfer.effectAllowed = 'move';
        }
    }

    /**
     * 处理多选节点的拖拽放置
     */
    public handleDropSelectedBlocks(
        dragData: any, 
        targetBlockId: string, 
        position: 'before' | 'after' | 'child'
    ): boolean {
        if (dragData.type !== 'workflowy-multi-blocks') {
            return false;
        }

        const sourceBlockIds = dragData.blockIds as string[];
        const allBlocks = getAllBlocks(this.editor.getState().blocks);
        const targetBlock = allBlocks.find(block => block.id === targetBlockId);
        
        if (!targetBlock) {
            return false;
        }

        // 检查是否会造成循环引用
        if (this.wouldCreateCycle(sourceBlockIds, targetBlockId, position)) {
            return false;
        }

        // 按层级排序，先移动深层节点
        const sourceBlocks = allBlocks.filter(block => sourceBlockIds.includes(block.id));
        sourceBlocks.sort((a, b) => b.level - a.level);

        // 移动节点
        sourceBlocks.forEach(block => {
            this.editor.moveBlock(block.id, targetBlockId, position);
        });

        this.onRender();
        return true;
    }

    /**
     * 检查移动是否会造成循环引用
     */
    private wouldCreateCycle(
        sourceBlockIds: string[], 
        targetBlockId: string, 
        position: 'before' | 'after' | 'child'
    ): boolean {
        // 如果目标位置是作为子节点，需要检查循环引用
        if (position === 'child') {
            return sourceBlockIds.some(sourceId => {
                return this.isAncestor(sourceId, targetBlockId);
            });
        }
        
        // 对于 before/after 位置，检查目标节点的父节点
        const allBlocksForCycle = getAllBlocks(this.editor.getState().blocks);
        const targetBlockForCycle = allBlocksForCycle.find(block => block.id === targetBlockId);
        if (!targetBlockForCycle) {
            return false;
        }
        
        const parentId = this.findParentId(targetBlockId);
        if (!parentId) {
            return false;
        }
        
        return sourceBlockIds.some(sourceId => {
            return this.isAncestor(sourceId, parentId);
        });
    }

    /**
     * 检查是否是祖先节点
     */
    private isAncestor(ancestorId: string, descendantId: string): boolean {
        const allBlocks = getAllBlocks(this.editor.getState().blocks);
        const descendant = allBlocks.find(block => block.id === descendantId);
        
        if (!descendant) {
            return false;
        }
        
        // 递归检查父节点
        const parentId = this.findParentId(descendantId);
        if (!parentId) {
            return false;
        }
        
        if (parentId === ancestorId) {
            return true;
        }
        
        return this.isAncestor(ancestorId, parentId);
    }

    /**
     * 查找父节点ID
     */
    private findParentId(blockId: string): string | null {
        const allBlocks = getAllBlocks(this.editor.getState().blocks);
        
        for (const block of allBlocks) {
            if (block.children.some(child => child.id === blockId)) {
                return block.id;
            }
        }
        
        return null;
    }

    /**
     * 销毁管理器
     */
    public destroy(): void {
        // 清除节流定时器
        if (this.updateThrottleTimer !== null) {
            window.clearTimeout(this.updateThrottleTimer);
            this.updateThrottleTimer = null;
        }

        // 移除 document 级别的键盘事件监听器
        if (this.boundKeyDownHandler) {
            document.removeEventListener('keydown', this.boundKeyDownHandler, true);
        }

        if (this.selectionBox) {
            document.body.removeChild(this.selectionBox);
            this.selectionBox = null;
        }

        if (this.selectionCounter) {
            document.body.removeChild(this.selectionCounter);
            this.selectionCounter = null;
        }
        
        this.clearSelection();
    }
}