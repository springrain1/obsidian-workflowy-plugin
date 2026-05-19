/**
 * Isolation Module - 完整的功能隔离系统
 *
 * 这个模块提供了一套完整的隔离机制，确保 Workflowy 功能
 * 只在专用视图中生效，完全不影响原生 Obsidian Markdown 编辑体验。
 *
 * 核心组件：
 * - ViewStateManager: 中心化视图状态管理
 * - IsolationLayer: 完整的隔离层和边界检查
 * - CommandProxy: 命令代理和执行控制
 * - EventDelegator: 事件委托和隔离
 * - RuntimeValidator: 运行时验证和健康检查
 */

import { ViewStateManager } from './view-state-manager';
import { IsolationLayer } from './isolation-layer';
import { CommandProxy } from './command-proxy';
import { EventDelegator } from './event-delegator';
import { RuntimeValidator } from './runtime-validator';

// 导出核心类
export { ViewStateManager, ViewType } from './view-state-manager';
export type { ViewState } from './view-state-manager';

export { IsolationLayer, IsolationViolationType } from './isolation-layer';
export type { IsolationViolation, IsolationCheckResult } from './isolation-layer';

export { CommandProxy } from './command-proxy';
export type { ProxiedCommand, CommandExecutionLog } from './command-proxy';

export { EventDelegator } from './event-delegator';
export type { DelegatedEvent, EventLog } from './event-delegator';

export { RuntimeValidator, ValidationLevel } from './runtime-validator';
export type { ValidationResult, HealthCheckResult } from './runtime-validator';

/**
 * 初始化隔离系统
 *
 * 这个函数应该在插件加载时调用，用于初始化所有隔离组件
 */
export function initializeIsolationSystem(options?: {
    strictMode?: boolean;
    enableAssertions?: boolean;
    debugMode?: boolean;
}): {
    viewStateManager: ViewStateManager;
    isolationLayer: IsolationLayer;
    commandProxy: CommandProxy;
    eventDelegator: EventDelegator;
    runtimeValidator: RuntimeValidator;
} {
    const viewStateManager = ViewStateManager.getInstance();
    const isolationLayer = IsolationLayer.getInstance();
    const commandProxy = CommandProxy.getInstance();
    const eventDelegator = EventDelegator.getInstance();
    const runtimeValidator = RuntimeValidator.getInstance();

    // 应用配置
    if (options?.strictMode !== undefined) {
        isolationLayer.setStrictMode(options.strictMode);
    }

    if (options?.enableAssertions !== undefined) {
        runtimeValidator.setAssertionsEnabled(options.enableAssertions);
    }

    if (options?.debugMode) {
        viewStateManager.debugPrintState();
        isolationLayer.debugPrintState();
        commandProxy.debugPrintState();
        eventDelegator.debugPrintState();
        runtimeValidator.debugPrintState();
    }

    return {
        viewStateManager,
        isolationLayer,
        commandProxy,
        eventDelegator,
        runtimeValidator
    };
}

/**
 * 清理隔离系统
 *
 * 这个函数应该在插件卸载时调用，用于清理所有隔离组件
 */
export function cleanupIsolationSystem(): void {
    const eventDelegatorInstance = EventDelegator.getInstance();
    eventDelegatorInstance.cleanup();

    ViewStateManager.reset();
}

/**
 * 执行隔离系统健康检查
 */
export function performIsolationHealthCheck(): any {
    const runtimeValidatorInstance = RuntimeValidator.getInstance();
    return runtimeValidatorInstance.performHealthCheck();
}
