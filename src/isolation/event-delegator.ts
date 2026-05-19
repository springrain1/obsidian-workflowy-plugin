/**
 * EventDelegator - 事件委托系统
 *
 * 职责：
 * 1. 全局事件拦截
 * 2. 事件来源验证
 * 3. 防止事件泄露
 * 4. 提供统一的事件处理接口
 */

import { IsolationLayer } from './isolation-layer';

export interface DelegatedEvent {
    type: string;
    handler: (event: Event) => void;
    containerSelector: string;
    options?: AddEventListenerOptions;
}

export interface EventLog {
    eventType: string;
    timestamp: number;
    targetElement: string;
    handled: boolean;
    blocked: boolean;
    reason?: string;
}

export class EventDelegator {
    private static instance: EventDelegator;
    private isolationLayer: IsolationLayer;
    private registeredEvents: Map<string, DelegatedEvent[]> = new Map();
    private eventLogs: EventLog[] = [];
    private maxLogSize: number = 500;
    private globalHandlers: Map<string, (e: Event) => void> = new Map();

    private constructor() {
        this.isolationLayer = IsolationLayer.getInstance();
    }

    /**
     * 获取单例实例
     */
    public static getInstance(): EventDelegator {
        if (!EventDelegator.instance) {
            EventDelegator.instance = new EventDelegator();
        }
        return EventDelegator.instance;
    }

    /**
     * 注册事件委托
     */
    public registerEvent(
        eventType: string,
        containerSelector: string,
        handler: (event: Event) => void,
        options?: AddEventListenerOptions
    ): void {
        const event: DelegatedEvent = {
            type: eventType,
            handler,
            containerSelector,
            options
        };

        if (!this.registeredEvents.has(eventType)) {
            this.registeredEvents.set(eventType, []);
            this.setupGlobalHandler(eventType);
        }

        this.registeredEvents.get(eventType)!.push(event);
    }

    /**
     * 注销事件委托
     */
    public unregisterEvent(eventType: string, containerSelector: string): void {
        const events = this.registeredEvents.get(eventType);
        if (!events) return;

        const filtered = events.filter(e => e.containerSelector !== containerSelector);
        if (filtered.length === 0) {
            this.registeredEvents.delete(eventType);
            this.removeGlobalHandler(eventType);
        } else {
            this.registeredEvents.set(eventType, filtered);
        }
    }

    /**
     * 设置全局事件处理器
     */
    private setupGlobalHandler(eventType: string): void {
        const handler = (e: Event) => {
            this.handleGlobalEvent(e);
        };

        this.globalHandlers.set(eventType, handler);
        document.addEventListener(eventType, handler, true); // 使用捕获阶段
    }

    /**
     * 移除全局事件处理器
     */
    private removeGlobalHandler(eventType: string): void {
        const handler = this.globalHandlers.get(eventType);
        if (handler) {
            document.removeEventListener(eventType, handler, true);
            this.globalHandlers.delete(eventType);
        }
    }

    /**
     * 处理全局事件
     */
    private handleGlobalEvent(event: Event): void {
        const eventType = event.type;
        const events = this.registeredEvents.get(eventType);
        if (!events) return;

        const target = event.target as HTMLElement;

        for (const delegatedEvent of events) {
            const container = document.querySelector(delegatedEvent.containerSelector);
            if (!container) continue;

            // 检查事件是否在容器内；对键盘事件额外使用 activeElement 作为兜底
            const activeEl = (document.activeElement as HTMLElement) || null;
            const isKeyboardEvent = eventType === 'keydown' || eventType === 'keypress' || eventType === 'keyup';
            const inContainerByTarget = container.contains(target);
            const inContainerByActive = isKeyboardEvent && !!activeEl && container.contains(activeEl);
            const inContainer = inContainerByTarget || inContainerByActive;

            if (inContainer) {
                // 验证事件处理权限
                const checkResult = this.isolationLayer.checkEventHandling(
                    event,
                    'workflowy-container'
                );

                if (checkResult.allowed) {
                    try {
                        // 将 activeElement 附加到事件对象，便于下游定位
                        (event as any)._wfActiveElement = inContainerByActive ? activeEl : undefined;
                        delegatedEvent.handler(event);
                        this.logEvent(eventType, (target && (target as any).className) || 'unknown', true, false);
                    } catch (error) {
                        console.error(`[EventDelegator] Error handling ${eventType}:`, error);
                        this.logEvent(eventType, (target && (target as any).className) || 'unknown', false, false, String(error));
                    }
                } else {
                    this.logEvent(eventType, (target && (target as any).className) || 'unknown', false, true, checkResult.reason);
                    event.stopPropagation();
                    event.preventDefault();
                }
                break;
            }
        }
    }

    /**
     * 创建隔离的事件监听器
     */
    public createIsolatedEventListener(
        element: HTMLElement,
        eventType: string,
        handler: (event: Event) => void,
        requiredContainer: string = '.workflowy-container'
    ): (event: Event) => void {
        return (event: Event) => {
            const target = event.target as HTMLElement;

            // 检查是否在要求的容器内
            if (!target.closest(requiredContainer)) {
                console.warn(`[EventDelegator] Event ${eventType} blocked: not in ${requiredContainer}`);
                this.logEvent(eventType, target.className, false, true, `Not in ${requiredContainer}`);
                event.stopPropagation();
                event.preventDefault();
                return;
            }

            // 执行处理器
            try {
                handler(event);
                this.logEvent(eventType, target.className, true, false);
            } catch (error) {
                console.error(`[EventDelegator] Error in isolated listener:`, error);
                this.logEvent(eventType, target.className, false, false, String(error));
            }
        };
    }

    /**
     * 批量注册 Workflowy 事件
     */
    public registerWorkflowyEvents(
        containerElement: HTMLElement,
        eventHandlers: { [eventType: string]: (event: Event) => void }
    ): void {
        for (const [eventType, handler] of Object.entries(eventHandlers)) {
            const isolatedHandler = this.createIsolatedEventListener(
                containerElement,
                eventType,
                handler
            );

            containerElement.addEventListener(eventType, isolatedHandler);
        }
    }

    /**
     * 清理容器的所有事件
     */
    public cleanupContainerEvents(containerSelector: string): void {
        for (const eventType of this.registeredEvents.keys()) {
            this.unregisterEvent(eventType, containerSelector);
        }
    }

    /**
     * 获取事件日志
     */
    public getEventLogs(): EventLog[] {
        return [...this.eventLogs];
    }

    /**
     * 获取被阻止的事件统计
     */
    public getBlockedEventStats(): Record<string, number> {
        const stats: Record<string, number> = {};

        for (const log of this.eventLogs) {
            if (log.blocked) {
                stats[log.eventType] = (stats[log.eventType] || 0) + 1;
            }
        }

        return stats;
    }

    /**
     * 清除事件日志
     */
    public clearLogs(): void {
        this.eventLogs = [];
    }

    /**
     * 记录事件
     */
    private logEvent(
        eventType: string,
        targetElement: string,
        handled: boolean,
        blocked: boolean,
        reason?: string
    ): void {
        const log: EventLog = {
            eventType,
            timestamp: Date.now(),
            targetElement,
            handled,
            blocked,
            reason
        };

        this.eventLogs.push(log);

        // 保持日志大小
        if (this.eventLogs.length > this.maxLogSize) {
            this.eventLogs = this.eventLogs.slice(-this.maxLogSize);
        }
    }

    /**
     * 调试：打印状态
     */
    public debugPrintState(): void {
        // Debug method for development
    }

    /**
     * 清理所有事件
     */
    public cleanup(): void {
        // 移除所有全局处理器
        for (const eventType of this.globalHandlers.keys()) {
            this.removeGlobalHandler(eventType);
        }

        this.registeredEvents.clear();
        this.eventLogs = [];
    }
}
