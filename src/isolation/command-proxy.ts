/**
 * CommandProxy - 命令代理系统
 *
 * 职责：
 * 1. 拦截所有命令调用
 * 2. 验证命令执行上下文
 * 3. 强制执行视图约束
 * 4. 提供命令执行日志
 */

import { Command, WorkspaceLeaf } from 'obsidian';
import { IsolationLayer } from './isolation-layer';
import { ViewStateManager, ViewType } from './view-state-manager';

export interface ProxiedCommand {
    id: string;
    name: string;
    requiredViewType: ViewType;
    checkCallback?: (checking: boolean) => boolean | void;
    editorCallback?: (...args: any[]) => void;
    callback?: () => void;
    hotkeys?: any[];
    mobileOnly?: boolean;
}

export interface CommandExecutionLog {
    commandId: string;
    timestamp: number;
    viewType: ViewType;
    success: boolean;
    blocked: boolean;
    reason?: string;
}

export class CommandProxy {
    private static instance: CommandProxy;
    private isolationLayer: IsolationLayer;
    private viewStateManager: ViewStateManager;
    private commandRegistry: Map<string, ProxiedCommand> = new Map();
    private executionLogs: CommandExecutionLog[] = [];
    private maxLogSize: number = 500;

    private constructor() {
        this.isolationLayer = IsolationLayer.getInstance();
        this.viewStateManager = ViewStateManager.getInstance();
    }

    /**
     * 获取单例实例
     */
    public static getInstance(): CommandProxy {
        if (!CommandProxy.instance) {
            CommandProxy.instance = new CommandProxy();
        }
        return CommandProxy.instance;
    }

    /**
     * 注册命令（带隔离控制）
     */
    public registerCommand(command: ProxiedCommand): Command {
        this.commandRegistry.set(command.id, command);

        // 创建带检查的命令对象
        const proxiedCommand: Command = {
            id: command.id,
            name: command.name,
            hotkeys: command.hotkeys,
            mobileOnly: command.mobileOnly
        };

        // 使用 checkCallback 模式确保命令只在正确的视图中可用
        if (command.checkCallback) {
            proxiedCommand.checkCallback = (checking: boolean) => {
                const canExecute = this.canExecuteCommand(command.id);

                if (checking) {
                    // 返回命令是否可用
                    return canExecute;
                }

                if (!canExecute) {
                    this.logCommandExecution(command.id, false, true, 'View type mismatch');
                    return false;
                }

                // 执行实际的 checkCallback
                try {
                    const result = command.checkCallback!(checking);
                    this.logCommandExecution(command.id, true, false);
                    return result;
                } catch (error) {
                    console.error(`[CommandProxy] Error executing command ${command.id}:`, error);
                    this.logCommandExecution(command.id, false, false, String(error));
                    return false;
                }
            };
        } else if (command.callback) {
            // 对于普通 callback，也使用 checkCallback 模式
            proxiedCommand.checkCallback = (checking: boolean) => {
                const canExecute = this.canExecuteCommand(command.id);

                if (checking) {
                    return canExecute;
                }

                if (!canExecute) {
                    this.logCommandExecution(command.id, false, true, 'View type mismatch');
                    return false;
                }

                try {
                    command.callback!();
                    this.logCommandExecution(command.id, true, false);
                    return true;
                } catch (error) {
                    console.error(`[CommandProxy] Error executing command ${command.id}:`, error);
                    this.logCommandExecution(command.id, false, false, String(error));
                    return false;
                }
            };
        } else if (command.editorCallback) {
            proxiedCommand.editorCheckCallback = (checking: boolean, editor: any, view: any) => {
                const canExecute = this.canExecuteCommand(command.id);

                if (checking) {
                    return canExecute;
                }

                if (!canExecute) {
                    this.logCommandExecution(command.id, false, true, 'View type mismatch');
                    return false;
                }

                try {
                    command.editorCallback!(editor, view);
                    this.logCommandExecution(command.id, true, false);
                    return true;
                } catch (error) {
                    console.error(`[CommandProxy] Error executing command ${command.id}:`, error);
                    this.logCommandExecution(command.id, false, false, String(error));
                    return false;
                }
            };
        }

        return proxiedCommand;
    }

    /**
     * 检查命令是否可以执行
     */
    public canExecuteCommand(commandId: string, leaf?: WorkspaceLeaf): boolean {
        const command = this.commandRegistry.get(commandId);
        if (!command) {
            console.warn(`[CommandProxy] Unknown command: ${commandId}`);
            return false;
        }

        // 如果没有提供 leaf，使用当前活动的 leaf
        if (!leaf) {
            // 需要从 app.workspace 获取，这里暂时返回基于 ViewStateManager 的检查
            const activeViewType = this.viewStateManager.getActiveViewType((window as any).app?.workspace);
            return activeViewType === command.requiredViewType;
        }

        const currentViewType = this.viewStateManager.getViewType(leaf);
        return currentViewType === command.requiredViewType;
    }

    /**
     * 执行命令（带完整检查）
     */
    public executeCommand(
        commandId: string,
        context: { leaf?: WorkspaceLeaf; [key: string]: any }
    ): boolean {
        const command = this.commandRegistry.get(commandId);
        if (!command) {
            console.error(`[CommandProxy] Cannot execute unknown command: ${commandId}`);
            return false;
        }

        // 验证执行上下文
        const checkResult = this.isolationLayer.checkCommandExecution(
            commandId,
            command.requiredViewType,
            context.leaf
        );

        if (!checkResult.allowed) {
            this.logCommandExecution(commandId, false, true, checkResult.reason);
            console.warn(`[CommandProxy] Command ${commandId} blocked:`, checkResult.reason);
            return false;
        }

        // 执行命令
        try {
            if (command.callback) {
                command.callback();
            } else if (command.checkCallback) {
                command.checkCallback(false);
            }

            this.logCommandExecution(commandId, true, false);
            return true;
        } catch (error) {
            console.error(`[CommandProxy] Error executing command ${commandId}:`, error);
            this.logCommandExecution(commandId, false, false, String(error));
            return false;
        }
    }

    /**
     * 获取命令信息
     */
    public getCommandInfo(commandId: string): ProxiedCommand | undefined {
        return this.commandRegistry.get(commandId);
    }

    /**
     * 获取所有注册的命令
     */
    public getAllCommands(): ProxiedCommand[] {
        return Array.from(this.commandRegistry.values());
    }

    /**
     * 获取特定视图类型的命令
     */
    public getCommandsForViewType(viewType: ViewType): ProxiedCommand[] {
        return Array.from(this.commandRegistry.values())
            .filter(cmd => cmd.requiredViewType === viewType);
    }

    /**
     * 获取执行日志
     */
    public getExecutionLogs(): CommandExecutionLog[] {
        return [...this.executionLogs];
    }

    /**
     * 获取被阻止的命令统计
     */
    public getBlockedCommandStats(): Record<string, number> {
        const stats: Record<string, number> = {};

        for (const log of this.executionLogs) {
            if (log.blocked) {
                stats[log.commandId] = (stats[log.commandId] || 0) + 1;
            }
        }

        return stats;
    }

    /**
     * 清除执行日志
     */
    public clearLogs(): void {
        this.executionLogs = [];
    }

    /**
     * 记录命令执行
     */
    private logCommandExecution(
        commandId: string,
        success: boolean,
        blocked: boolean,
        reason?: string
    ): void {
        const log: CommandExecutionLog = {
            commandId,
            timestamp: Date.now(),
            viewType: this.viewStateManager.getActiveViewType((window as any).app?.workspace),
            success,
            blocked,
            reason
        };

        this.executionLogs.push(log);

        // 保持日志大小
        if (this.executionLogs.length > this.maxLogSize) {
            this.executionLogs = this.executionLogs.slice(-this.maxLogSize);
        }

        // 如果命令被阻止，输出警告
        if (blocked) {
            console.warn(`[CommandProxy] Command ${commandId} blocked: ${reason}`);
        }
    }

    /**
     * 调试：打印状态
     */
    public debugPrintState(): void {
    }
}
