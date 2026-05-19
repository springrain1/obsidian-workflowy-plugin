import { OutlineBlock } from '../types';
import { findBlockById, getAllBlocks } from '../utils';
import { BlockEditor } from '../block-editor';

/**
 * 面包屑导航项
 */
export interface Breadcrumb {
    title: string;
    blockId: string | null; // null 表示根节点（文档标题）
}

/**
 * Zoom 管理器
 * 管理聚焦状态和面包屑导航
 */
export class ZoomManager {
    private zoomedBlockId: string | null = null;
    private onZoomChange?: (zoomedBlockId: string | null) => void;

    constructor(
        private editor: BlockEditor,
        private getDocumentTitle: () => string
    ) {}

    /**
     * 设置缩放变化回调
     */
    setOnZoomChange(callback: (zoomedBlockId: string | null) => void): void {
        this.onZoomChange = callback;
    }

    /**
     * 获取当前缩放的块ID
     */
    getZoomedBlockId(): string | null {
        return this.zoomedBlockId;
    }

    /**
     * 缩放到指定块
     */
    zoomIn(blockId: string): boolean {
        const block = findBlockById(this.editor.getState().blocks, blockId);
        if (!block) {
            console.warn('[ZoomManager] Block not found:', blockId);
            return false;
        }

        this.zoomedBlockId = blockId;

        if (this.onZoomChange) {
            this.onZoomChange(blockId);
        }

        return true;
    }

    /**
     * 缩放退出（显示所有内容）
     */
    zoomOut(): void {
        this.zoomedBlockId = null;

        if (this.onZoomChange) {
            this.onZoomChange(null);
        }
    }

    /**
     * 检查某个块是否应该显示
     * @param blockId 要检查的块ID
     * @param allBlocks 所有块的扁平列表
     */
    shouldShowBlock(blockId: string, allBlocks: OutlineBlock[]): boolean {
        if (!this.zoomedBlockId) {
            // 未缩放，显示所有块
            return true;
        }

        // 找到当前块和缩放目标块
        const currentBlock = allBlocks.find(b => b.id === blockId);
        const zoomedBlock = allBlocks.find(b => b.id === this.zoomedBlockId);

        if (!currentBlock || !zoomedBlock) {
            return false;
        }

        // 如果是缩放目标块本身，显示
        if (blockId === this.zoomedBlockId) {
            return true;
        }

        // 检查当前块是否是缩放目标块的后代
        return this.isDescendant(zoomedBlock, currentBlock, this.editor.getState().blocks);
    }

    /**
     * 检查一个块是否是另一个块的后代
     */
    private isDescendant(ancestor: OutlineBlock, descendant: OutlineBlock, blocks: OutlineBlock[]): boolean {
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

    /**
     * 收集面包屑导航
     * @param blockId 当前聚焦的块ID（如果为null，使用缩放的块ID）
     */
    collectBreadcrumbs(blockId?: string): Breadcrumb[] {
        const targetBlockId = blockId || this.zoomedBlockId;

        if (!targetBlockId) {
            // 没有缩放，返回文档标题
            return [{
                title: this.getDocumentTitle(),
                blockId: null
            }];
        }

        const allBlocks = getAllBlocks(this.editor.getState().blocks);
        const targetBlock = allBlocks.find(b => b.id === targetBlockId);

        if (!targetBlock) {
            return [{
                title: this.getDocumentTitle(),
                blockId: null
            }];
        }

        // 收集从根到目标块的路径
        const breadcrumbs: Breadcrumb[] = [
            {
                title: this.getDocumentTitle(),
                blockId: null
            }
        ];

        // 找到从根到目标块的路径
        const path = this.findPathToBlock(targetBlockId, this.editor.getState().blocks);

        for (const block of path) {
            breadcrumbs.push({
                title: this.cleanTitle(block.content),
                blockId: block.id
            });
        }

        return breadcrumbs;
    }

    /**
     * 找到从根到指定块的路径
     */
    private findPathToBlock(blockId: string, blocks: OutlineBlock[], path: OutlineBlock[] = []): OutlineBlock[] {
        for (const block of blocks) {
            if (block.id === blockId) {
                return [...path, block];
            }

            if (block.children.length > 0) {
                const childPath = this.findPathToBlock(blockId, block.children, [...path, block]);
                if (childPath.length > 0) {
                    return childPath;
                }
            }
        }

        return [];
    }

    /**
     * 清理标题文本（去除标记符号）
     */
    private cleanTitle(title: string): string {
        if (!title.trim()) {
            return '(空)';
        }

        return title
            .trim()
            .replace(/^#+(\s)/, '$1')  // 去除 markdown 标题符号
            .replace(/^([-+*]|\d+\.)(\s)/, '$2')  // 去除列表符号
            .replace(/^\s*\[[ xX]\]\s*/, '')  // 去除待办事项标记
            .trim()
            || '(空)';
    }

    /**
     * 获取应该显示的块ID列表（用于过滤渲染）
     */
    getVisibleBlockIds(): Set<string> | null {
        if (!this.zoomedBlockId) {
            return null; // 显示所有块
        }

        const allBlocks = getAllBlocks(this.editor.getState().blocks);
        const zoomedBlock = allBlocks.find(b => b.id === this.zoomedBlockId);

        if (!zoomedBlock) {
            return null;
        }

        const visibleIds = new Set<string>();
        visibleIds.add(this.zoomedBlockId);

        // 添加所有后代块
        function addDescendants(block: OutlineBlock) {
            for (const child of block.children) {
                visibleIds.add(child.id);
                addDescendants(child);
            }
        }

        addDescendants(zoomedBlock);
        return visibleIds;
    }

    /**
     * 检查是否处于缩放状态
     */
    isZoomed(): boolean {
        return this.zoomedBlockId !== null;
    }
}
