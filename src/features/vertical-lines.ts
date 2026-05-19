/**
 * 垂直缩进线管理器
 * 直接复用 obsidian-outliner 的核心逻辑和算法
 */

import { OutlineBlock } from '../types';
import { UI_CONFIG } from '../constants';
import { getAllBlocks } from '../utils';
import { BlockEditor } from '../block-editor';

interface LineData {
    top: number;
    left: number;
    height: string;
    blockId: string;
    block: OutlineBlock;
}

export class VerticalLinesManager {
    private contentContainer: HTMLElement;
    private scroller: HTMLElement;
    private editor: BlockEditor;
    private lines: LineData[] = [];
    private lineElements: HTMLElement[] = [];
    private onToggleCollapse: (blockId: string) => void;

    // 方案C：节流机制 - 避免短时间内多次更新
    private updateTimer: number | null = null;
    private pendingUpdate = false;

    // 方案C：缓存机制 - 缓存 DOM 查询结果
    private blockElementCache = new Map<string, HTMLElement>();
    private cacheTimeout = 200; // 缓存 200ms

    constructor(
        container: HTMLElement,
        editor: BlockEditor,
        onToggleCollapse: (blockId: string) => void
    ) {
        this.editor = editor;
        this.onToggleCollapse = onToggleCollapse;

        // 确保容器有相对定位
        if (getComputedStyle(container).position === 'static') {
            container.style.position = 'relative';
        }

        this.prepareDom(container);
    }

    /**
     * 创建DOM容器 - 复用 obsidian-outliner 的结构
     */
    private prepareDom(container: HTMLElement): void {
        this.contentContainer = document.createElement("div");
        this.contentContainer.classList.add("workflowy-vertical-lines-content-container");

        this.scroller = document.createElement("div");
        this.scroller.classList.add("workflowy-vertical-lines-scroller");

        this.scroller.appendChild(this.contentContainer);
        container.appendChild(this.scroller);

        // 设置容器样式
        this.scroller.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            pointer-events: none;
            z-index: 1;
            overflow: hidden;
        `;

        this.contentContainer.style.cssText = `
            position: relative;
            width: 100%;
            height: 100%;
        `;
    }

    /**
     * 更新垂直线 - 主入口方法（方案C：节流优化）
     * 避免短时间内多次调用，合并为一次更新
     */
    public update(): void {
        // 如果已在更新队列中，等待下次更新
        if (this.updateTimer !== null || this.pendingUpdate) {
            return;
        }

        // 立即执行一次更新
        this.performUpdate();

        // 设置节流定时器，50ms 内重复调用会合并为一次
        this.updateTimer = window.setTimeout(() => {
            this.updateTimer = null;
            this.pendingUpdate = false;
        }, 50);
    }

    /**
     * 执行实际更新
     */
    private performUpdate(): void {
        this.calculate();
        this.updateDom();
    }

    /**
     * 计算垂直线位置 - 避免重复计算
     */
    private calculate(): void {
        this.lines = [];
        const state = this.editor.getState();
        
        // 只处理顶级块，避免重复计算
        this.processBlocks(state.blocks);

        // 按位置排序
        this.lines.sort((a, b) =>
            a.top === b.top ? a.left - b.left : a.top - b.top,
        );
    }

    /**
     * 递归处理块列表
     */
    private processBlocks(blocks: OutlineBlock[]): void {
        for (const block of blocks) {
            if (block.children.length > 0 && !this.editor.isCollapsed(block.id)) {
                this.calculateLineForBlock(block);
                // 递归处理子块
                this.processBlocks(block.children);
            }
        }
    }

    /**
     * 为单个块计算垂直线
     */
    private calculateLineForBlock(block: OutlineBlock): void {
        // 查找对应的DOM元素
        const blockElement = this.getBlockElement(block.id);
        if (!blockElement) {
            return;
        }

        // 计算垂直线的位置
        const rect = blockElement.getBoundingClientRect();
        const containerRect = this.scroller.parentElement!.getBoundingClientRect();

        // 计算左边距 - 与圆点中心对齐
        // 重要：在zoom模式下，使用DOM元素的实际level（data-level属性）而不是blocks中的level
        // 因为zoom模式下会调整显示的level，DOM是正确的显示状态
        const displayLevel = parseInt(blockElement.getAttribute('data-level') || '0');

        // 布局分析：
        // - 缩进：level * 30px
        // - 折叠指示器：16px 宽度 + 4px 右边距 = 20px
        // - 圆点：6px 宽度，margin: 11px 12px 0 0，中心在 3px 处
        // 总计：level * 30 + 20 + 3 = level * 30 + 23
        const left = displayLevel * UI_CONFIG.indentSize + 23;

        // 计算顶部位置（相对于容器）
        const top = rect.top - containerRect.top;

        // 计算高度 - 到最后一个可见子项
        const lastVisibleChild = this.findLastVisibleChild(block);
        let bottom = rect.bottom - containerRect.top;
        
        if (lastVisibleChild) {
            const lastChildElement = this.getBlockElement(lastVisibleChild.id);
            if (lastChildElement) {
                const lastChildRect = lastChildElement.getBoundingClientRect();
                bottom = lastChildRect.bottom - containerRect.top;
            }
        }

        const height = bottom - top - 28; // 减去内容行高度

        // 只有当高度大于20px时才绘制线条
        if (height > 20) {
            this.lines.push({
                top: top + 28, // 28px 是内容行的高度偏移
                left,
                height: `${height}px`,
                blockId: block.id,
                block
            });
        }
    }

    /**
     * 查找块对应的DOM元素
     */
    private getBlockElement(blockId: string): HTMLElement | null {
        // 检查缓存
        const cached = this.blockElementCache.get(blockId);
        if (cached && document.body.contains(cached)) {
            return cached;
        }

        // 查询 DOM
        const element = this.scroller.parentElement?.querySelector(
            `[data-block-id="${blockId}"]`
        ) as HTMLElement;

        // 缓存结果
        if (element) {
            this.blockElementCache.set(blockId, element);
            // 设置缓存过期
            setTimeout(() => {
                this.blockElementCache.delete(blockId);
            }, this.cacheTimeout);
        }

        return element;
    }

    /**
     * 递归查找最后一个可见的子项
     */
    private findLastVisibleChild(block: OutlineBlock): OutlineBlock | null {
        if (block.children.length === 0) {
            return null;
        }

        const lastChild = block.children[block.children.length - 1];
        
        // 如果最后一个子项有子项且未折叠，递归查找
        if (lastChild.children.length > 0 && !this.editor.isCollapsed(lastChild.id)) {
            const deepestChild = this.findLastVisibleChild(lastChild);
            return deepestChild || lastChild;
        }
        
        return lastChild;
    }

    /**
     * 检查是否有下一个兄弟节点
     */
    private hasNextSibling(block: OutlineBlock): boolean {
        const allBlocks = getAllBlocks(this.editor.getState().blocks);
        const currentIndex = allBlocks.findIndex(b => b.id === block.id);
        
        if (currentIndex === -1 || currentIndex === allBlocks.length - 1) {
            return false;
        }

        const nextBlock = allBlocks[currentIndex + 1];
        return nextBlock.level === block.level;
    }

    /**
     * 更新DOM - 复用 obsidian-outliner 的DOM更新逻辑
     */
    private updateDom(): void {
        // 更新容器尺寸
        const parentElement = this.scroller.parentElement;
        if (parentElement) {
            this.contentContainer.style.height = parentElement.scrollHeight + "px";
        }

        // 创建或更新垂直线元素
        for (let i = 0; i < this.lines.length; i++) {
            if (this.lineElements.length === i) {
                const e = document.createElement("div");
                e.classList.add("workflowy-vertical-line");
                e.dataset.index = String(i);
                e.addEventListener("mousedown", this.onClick);
                this.contentContainer.appendChild(e);
                this.lineElements.push(e);
            }

            const l = this.lines[i];
            const e = this.lineElements[i];
            // 确保像素对齐，避免子像素渲染问题
            e.style.top = Math.round(l.top) + "px";
            e.style.left = Math.round(l.left) + "px";
            e.style.height = l.height;
            e.style.display = "block";
            

        }

        // 隐藏多余的元素
        for (let i = this.lines.length; i < this.lineElements.length; i++) {
            const e = this.lineElements[i];
            e.style.top = "0px";
            e.style.left = "0px";
            e.style.height = "0px";
            e.style.display = "none";
        }
    }

    /**
     * 处理点击事件 - 复用 obsidian-outliner 的点击逻辑
     */
    private onClick = (e: MouseEvent) => {
        e.preventDefault();
        const clickedElement = e.target as HTMLElement;
        const lineIndex = Number(clickedElement.dataset.index);
        const line = this.lines[lineIndex];
        
        if (line) {
            this.toggleFolding(line);
        }
    };

    /**
     * 切换折叠状态 - 完全复用 obsidian-outliner 的折叠逻辑
     * 
     * 逻辑说明：
     * 1. 获取当前块的所有直接子项
     * 2. 检查所有子项的折叠状态
     * 3. 如果所有子项都已折叠 → 展开所有子项
     * 4. 如果有任何子项未折叠 → 折叠所有子项
     * 
     * 重要：当前块本身不会被折叠，只折叠/展开其直接子项
     */
    private toggleFolding(line: LineData): void {
        const { block } = line;

        if (block.children.length === 0) {
            return;
        }

        // 检查是否需要展开 - 检查所有非空的直接子项
        let needToUnfold = true;
        const blocksToToggle: string[] = [];
        
        for (const child of block.children) {
            // 跳过空的子项（没有内容的）- 与 obsidian-outliner 的 isEmpty() 逻辑一致
            if (!child.content || child.content.trim() === '') {
                continue;
            }
            
            // 如果有任何子项未折叠，则需要折叠所有子项
            // 注意：这里检查的是子项本身是否折叠，而不是子项的子项
            if (!this.editor.isCollapsed(child.id)) {
                needToUnfold = false;
            }
            
            blocksToToggle.push(child.id);
        }

        // 执行折叠/展开操作 - 使用明确的方法而不是 toggle
        for (const blockId of blocksToToggle) {
            if (needToUnfold) {
                // 展开所有子项
                this.editor.expand(blockId);
            } else {
                // 折叠所有子项
                this.editor.collapse(blockId);
            }
        }

        // 通知外部更新视图
        this.onToggleCollapse(block.id);
    }

    /**
     * 销毁垂直线管理器
     */
    public destroy(): void {
        // 清理定时器
        if (this.updateTimer !== null) {
            clearTimeout(this.updateTimer);
            this.updateTimer = null;
        }

        // 清理缓存
        this.blockElementCache.clear();

        this.lineElements.forEach(element => element.remove());
        this.lineElements = [];
        this.lines = [];
        if (this.scroller.parentElement) {
            this.scroller.remove();
        }
    }
}