/**
 * IsolationLayer - 完整的隔离层
 *
 * 职责：
 * 1. 提供所有隔离检查功能
 * 2. 强制执行视图边界
 * 3. 防止功能泄露
 * 4. 运行时验证
 */

import { WorkspaceLeaf, View } from 'obsidian';
import { ViewStateManager, ViewType } from './view-state-manager';
import { WORKFLOWY_VIEW_TYPE } from '../constants';

export enum IsolationViolationType {
    COMMAND_IN_WRONG_VIEW = 'command_in_wrong_view',
    EVENT_LEAKED = 'event_leaked',
    STYLE_LEAKED = 'style_leaked',
    API_MISUSE = 'api_misuse',
    STATE_CORRUPTION = 'state_corruption'
}

export interface IsolationViolation {
    type: IsolationViolationType;
    message: string;
    context: any;
    timestamp: number;
    stackTrace?: string;
}

export interface IsolationCheckResult {
    allowed: boolean;
    reason?: string;
    violation?: IsolationViolation;
}

export class IsolationLayer {
    private static instance: IsolationLayer;
    private viewStateManager: ViewStateManager;
    private violations: IsolationViolation[] = [];
    private strictMode: boolean = true; // 严格模式：发现违规时抛出错误

    private constructor() {
        this.viewStateManager = ViewStateManager.getInstance();
    }

    /**
     * 获取单例实例
     */
    public static getInstance(): IsolationLayer {
        if (!IsolationLayer.instance) {
            IsolationLayer.instance = new IsolationLayer();
        }
        return IsolationLayer.instance;
    }

    /**
     * 设置严格模式
     */
    public setStrictMode(strict: boolean): void {
        this.strictMode = strict;
    }

    /**
     * 检查命令是否可以执行
     */
    public checkCommandExecution(
        commandId: string,
        requiredViewType: ViewType,
        currentLeaf?: WorkspaceLeaf
    ): IsolationCheckResult {
        const currentViewType = this.viewStateManager.getViewType(currentLeaf);

        if (currentViewType !== requiredViewType) {
            const violation: IsolationViolation = {
                type: IsolationViolationType.COMMAND_IN_WRONG_VIEW,
                message: `Command '${commandId}' requires ${requiredViewType} view but executed in ${currentViewType} view`,
                context: { commandId, requiredViewType, currentViewType },
                timestamp: Date.now(),
                stackTrace: this.captureStackTrace()
            };

            this.recordViolation(violation);

            return {
                allowed: false,
                reason: violation.message,
                violation
            };
        }

        return { allowed: true };
    }

    /**
     * 检查事件是否应该被处理
     */
    public checkEventHandling(
        event: Event,
        requiredContext: 'workflowy-container' | 'markdown-editor'
    ): IsolationCheckResult {
        const target = event.target as HTMLElement;

        if (requiredContext === 'workflowy-container') {
            if (!this.isElementInWorkflowyContainer(target)) {
                const violation: IsolationViolation = {
                    type: IsolationViolationType.EVENT_LEAKED,
                    message: `Event '${event.type}' handled outside Workflowy container`,
                    context: { eventType: event.type, targetElement: target.className },
                    timestamp: Date.now(),
                    stackTrace: this.captureStackTrace()
                };

                this.recordViolation(violation);

                return {
                    allowed: false,
                    reason: violation.message,
                    violation
                };
            }
        }

        return { allowed: true };
    }

    /**
     * 检查 API 调用是否合法
     */
    public checkAPICall(
        apiName: string,
        callerView: ViewType,
        requiredView: ViewType
    ): IsolationCheckResult {
        if (callerView !== requiredView) {
            const violation: IsolationViolation = {
                type: IsolationViolationType.API_MISUSE,
                message: `API '${apiName}' requires ${requiredView} view but called from ${callerView} view`,
                context: { apiName, callerView, requiredView },
                timestamp: Date.now(),
                stackTrace: this.captureStackTrace()
            };

            this.recordViolation(violation);

            return {
                allowed: false,
                reason: violation.message,
                violation
            };
        }

        return { allowed: true };
    }

    /**
     * 检查样式是否应该应用
     */
    public checkStyleApplication(selector: string): IsolationCheckResult {
        // 确保所有 Workflowy 样式都限制在容器内
        if (this.isWorkflowyStyleSelector(selector)) {
            if (!selector.startsWith('.workflowy-container') &&
                !selector.includes('.workflowy-container ')) {
                const violation: IsolationViolation = {
                    type: IsolationViolationType.STYLE_LEAKED,
                    message: `Style selector '${selector}' not properly scoped to .workflowy-container`,
                    context: { selector },
                    timestamp: Date.now(),
                    stackTrace: this.captureStackTrace()
                };

                this.recordViolation(violation);

                return {
                    allowed: false,
                    reason: violation.message,
                    violation
                };
            }
        }

        return { allowed: true };
    }

    /**
     * 验证视图状态一致性
     */
    public validateViewState(leaf: WorkspaceLeaf, expectedType: ViewType): IsolationCheckResult {
        const actualType = this.viewStateManager.getViewType(leaf);

        if (actualType !== expectedType) {
            const violation: IsolationViolation = {
                type: IsolationViolationType.STATE_CORRUPTION,
                message: `View state mismatch: expected ${expectedType}, got ${actualType}`,
                context: { expectedType, actualType },
                timestamp: Date.now(),
                stackTrace: this.captureStackTrace()
            };

            this.recordViolation(violation);

            return {
                allowed: false,
                reason: violation.message,
                violation
            };
        }

        return { allowed: true };
    }

    /**
     * 安全执行 Workflowy 操作
     */
    public safeExecuteWorkflowyAction(
        leaf: WorkspaceLeaf | undefined,
        action: () => void,
        actionName: string = 'unknown'
    ): boolean {
        if (!leaf) {
            console.warn(`[IsolationLayer] Cannot execute '${actionName}': no leaf provided`);
            return false;
        }

        const checkResult = this.checkCommandExecution(
            actionName,
            ViewType.WORKFLOWY,
            leaf
        );

        if (!checkResult.allowed) {
            if (this.strictMode) {
                throw new Error(`Isolation violation: ${checkResult.reason}`);
            }
            console.error(`[IsolationLayer] Action '${actionName}' blocked:`, checkResult.reason);
            return false;
        }

        try {
            action();
            return true;
        } catch (error) {
            console.error(`[IsolationLayer] Error executing '${actionName}':`, error);
            return false;
        }
    }

    /**
     * 检查是否应该显示菜单项
     */
    public shouldShowMenuItem(
        leaf: WorkspaceLeaf | undefined,
        menuItemFor: 'workflowy' | 'markdown'
    ): boolean {
        if (!leaf) return false;

        const viewType = this.viewStateManager.getViewType(leaf);

        if (menuItemFor === 'workflowy') {
            // "打开为大纲笔记"只在 Markdown 视图中显示
            return viewType === ViewType.MARKDOWN;
        } else {
            // "打开为Markdown"只在 Workflowy 视图中显示
            return viewType === ViewType.WORKFLOWY;
        }
    }

    /**
     * 元素是否在 Workflowy 容器内
     */
    public isElementInWorkflowyContainer(element: HTMLElement): boolean {
        return element.closest('.workflowy-container') !== null;
    }

    /**
     * 创建隔离的样式选择器
     */
    public createIsolatedStyleSelector(selector: string): string {
        if (selector.startsWith('.workflowy-container')) {
            return selector;
        }
        return `.workflowy-container ${selector}`;
    }

    /**
     * 阻止事件泄露
     */
    public preventEventLeakage(event: Event): void {
        const target = event.target as HTMLElement;
        if (!this.isElementInWorkflowyContainer(target)) {
            event.stopPropagation();
            event.preventDefault();

            const violation: IsolationViolation = {
                type: IsolationViolationType.EVENT_LEAKED,
                message: `Event '${event.type}' prevented from leaking outside Workflowy container`,
                context: { eventType: event.type },
                timestamp: Date.now()
            };

            this.recordViolation(violation);
        }
    }

    /**
     * 获取所有违规记录
     */
    public getViolations(): IsolationViolation[] {
        return [...this.violations];
    }

    /**
     * 清除违规记录
     */
    public clearViolations(): void {
        this.violations = [];
    }

    /**
     * 获取违规统计
     */
    public getViolationStats(): Record<IsolationViolationType, number> {
        const stats: any = {};

        for (const type of Object.values(IsolationViolationType)) {
            stats[type] = 0;
        }

        for (const violation of this.violations) {
            stats[violation.type]++;
        }

        return stats;
    }

    /**
     * 记录违规
     */
    private recordViolation(violation: IsolationViolation): void {
        this.violations.push(violation);
        console.warn('[IsolationLayer] Violation detected:', violation);

        // 保持最近1000条记录
        if (this.violations.length > 1000) {
            this.violations = this.violations.slice(-1000);
        }
    }

    /**
     * 捕获堆栈跟踪
     */
    private captureStackTrace(): string {
        const stack = new Error().stack;
        return stack || 'Stack trace not available';
    }

    /**
     * 判断选择器是否是 Workflowy 样式
     */
    private isWorkflowyStyleSelector(selector: string): boolean {
        const workflowyPrefixes = [
            '.workflowy',
            '.block-',
            '.collapse-',
            '.outline-'
        ];

        return workflowyPrefixes.some(prefix => selector.includes(prefix));
    }

    /**
     * 调试：打印隔离状态
     */
    public debugPrintState(): void {
        // Debug method for development
    }
}
