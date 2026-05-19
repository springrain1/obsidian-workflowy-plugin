/**
 * ViewStateManager - 中心化视图状态管理器
 *
 * 职责：
 * 1. 追踪所有视图实例及其类型
 * 2. 提供视图状态查询 API
 * 3. 管理视图生命周期
 * 4. 维护视图与文件的映射关系
 */

import { WorkspaceLeaf, View } from 'obsidian';
import { WORKFLOWY_VIEW_TYPE } from '../constants';

export enum ViewType {
    MARKDOWN = 'markdown',
    WORKFLOWY = 'workflowy-view',
    OTHER = 'other'
}

export interface ViewState {
    leafId: string;
    viewType: ViewType;
    filePath?: string;
    isActive: boolean;
    createdAt: number;
    lastAccessedAt: number;
}

export class ViewStateManager {
    private static instance: ViewStateManager;
    private viewStates: Map<string, ViewState> = new Map();
    private leafToViewType: WeakMap<WorkspaceLeaf, ViewType> = new WeakMap();

    private constructor() {
        // Singleton pattern
    }

    /**
     * 获取单例实例
     */
    public static getInstance(): ViewStateManager {
        if (!ViewStateManager.instance) {
            ViewStateManager.instance = new ViewStateManager();
        }
        return ViewStateManager.instance;
    }

    /**
     * 重置管理器（用于测试和清理）
     */
    public static reset(): void {
        if (ViewStateManager.instance) {
            ViewStateManager.instance.viewStates.clear();
            ViewStateManager.instance = null as any;
        }
    }

    /**
     * 注册视图
     */
    public registerView(leaf: WorkspaceLeaf, viewType: ViewType, filePath?: string): void {
        const leafId = this.getLeafId(leaf);
        const now = Date.now();

        // 检查是否是活动 leaf（需要通过 app.workspace）
        const isActive = (leaf as any).workspace?.activeLeaf === leaf;

        this.viewStates.set(leafId, {
            leafId,
            viewType,
            filePath,
            isActive: isActive || false,
            createdAt: now,
            lastAccessedAt: now
        });

        this.leafToViewType.set(leaf, viewType);
    }

    /**
     * 注销视图
     */
    public unregisterView(leaf: WorkspaceLeaf): void {
        const leafId = this.getLeafId(leaf);
        this.viewStates.delete(leafId);
        this.leafToViewType.delete(leaf);
    }

    /**
     * 更新视图状态
     */
    public updateViewState(leaf: WorkspaceLeaf, updates: Partial<ViewState>): void {
        const leafId = this.getLeafId(leaf);
        const currentState = this.viewStates.get(leafId);

        if (currentState) {
            this.viewStates.set(leafId, {
                ...currentState,
                ...updates,
                lastAccessedAt: Date.now()
            });
        }
    }

    /**
     * 获取视图类型
     */
    public getViewType(leaf?: WorkspaceLeaf): ViewType {
        if (!leaf) {
            return ViewType.OTHER;
        }

        const view = leaf.view;
        if (!view) {
            return ViewType.OTHER;
        }

        const viewType = view.getViewType();

        if (viewType === WORKFLOWY_VIEW_TYPE) {
            return ViewType.WORKFLOWY;
        } else if (viewType === 'markdown') {
            return ViewType.MARKDOWN;
        } else {
            return ViewType.OTHER;
        }
    }

    /**
     * 检查是否在 Workflowy 视图中
     */
    public isInWorkflowyView(leaf?: WorkspaceLeaf): boolean {
        return this.getViewType(leaf) === ViewType.WORKFLOWY;
    }

    /**
     * 检查是否在 Markdown 视图中
     */
    public isInMarkdownView(leaf?: WorkspaceLeaf): boolean {
        return this.getViewType(leaf) === ViewType.MARKDOWN;
    }

    /**
     * 获取当前活动视图类型
     */
    public getActiveViewType(workspace: any): ViewType {
        const activeLeaf = workspace.activeLeaf;
        return this.getViewType(activeLeaf);
    }

    /**
     * 获取所有 Workflowy 视图
     */
    public getAllWorkflowyViews(): ViewState[] {
        return Array.from(this.viewStates.values())
            .filter(state => state.viewType === ViewType.WORKFLOWY);
    }

    /**
     * 获取视图状态
     */
    public getViewState(leaf: WorkspaceLeaf): ViewState | undefined {
        const leafId = this.getLeafId(leaf);
        return this.viewStates.get(leafId);
    }

    /**
     * 检查是否有任何 Workflowy 视图处于活动状态
     */
    public hasActiveWorkflowyView(): boolean {
        return Array.from(this.viewStates.values())
            .some(state => state.viewType === ViewType.WORKFLOWY && state.isActive);
    }

    /**
     * 获取视图统计信息
     */
    public getStatistics(): {
        total: number;
        workflowy: number;
        markdown: number;
        other: number;
    } {
        const stats = {
            total: 0,
            workflowy: 0,
            markdown: 0,
            other: 0
        };

        for (const state of this.viewStates.values()) {
            stats.total++;
            if (state.viewType === ViewType.WORKFLOWY) {
                stats.workflowy++;
            } else if (state.viewType === ViewType.MARKDOWN) {
                stats.markdown++;
            } else {
                stats.other++;
            }
        }

        return stats;
    }

    /**
     * 生成 leaf 的唯一标识符
     */
    private getLeafId(leaf: WorkspaceLeaf): string {
        // 使用 leaf 的内部 ID 或创建一个唯一标识
        return (leaf as any).id || `leaf-${Date.now()}-${Math.random()}`;
    }

    /**
     * 调试：打印当前状态
     */
    public debugPrintState(): void {
        // Debug method for development
    }
}
