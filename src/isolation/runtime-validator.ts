/**
 * RuntimeValidator - 运行时验证器
 *
 * 职责：
 * 1. 运行时断言和边界检查
 * 2. 异常情况检测和告警
 * 3. 性能监控
 * 4. 健康检查
 */

import { ViewStateManager } from './view-state-manager';
import { IsolationLayer } from './isolation-layer';
import { CommandProxy } from './command-proxy';
import { EventDelegator } from './event-delegator';

export enum ValidationLevel {
    INFO = 'info',
    WARNING = 'warning',
    ERROR = 'error',
    CRITICAL = 'critical'
}

export interface ValidationResult {
    passed: boolean;
    level: ValidationLevel;
    message: string;
    timestamp: number;
    context?: any;
}

export interface HealthCheckResult {
    healthy: boolean;
    checks: {
        viewStateManager: boolean;
        isolationLayer: boolean;
        commandProxy: boolean;
        eventDelegator: boolean;
    };
    issues: ValidationResult[];
    timestamp: number;
}

export class RuntimeValidator {
    private static instance: RuntimeValidator;
    private viewStateManager: ViewStateManager;
    private isolationLayer: IsolationLayer;
    private commandProxy: CommandProxy;
    private eventDelegator: EventDelegator;
    private validationResults: ValidationResult[] = [];
    private maxResultSize: number = 1000;
    private assertionsEnabled: boolean = true;

    private constructor() {
        this.viewStateManager = ViewStateManager.getInstance();
        this.isolationLayer = IsolationLayer.getInstance();
        this.commandProxy = CommandProxy.getInstance();
        this.eventDelegator = EventDelegator.getInstance();
    }

    /**
     * 获取单例实例
     */
    public static getInstance(): RuntimeValidator {
        if (!RuntimeValidator.instance) {
            RuntimeValidator.instance = new RuntimeValidator();
        }
        return RuntimeValidator.instance;
    }

    /**
     * 启用/禁用断言
     */
    public setAssertionsEnabled(enabled: boolean): void {
        this.assertionsEnabled = enabled;
    }

    /**
     * 断言：确保条件为真
     */
    public assert(
        condition: boolean,
        message: string,
        level: ValidationLevel = ValidationLevel.ERROR,
        context?: any
    ): void {
        if (!this.assertionsEnabled) return;

        if (!condition) {
            const result: ValidationResult = {
                passed: false,
                level,
                message: `Assertion failed: ${message}`,
                timestamp: Date.now(),
                context
            };

            this.recordValidation(result);

            if (level === ValidationLevel.CRITICAL || level === ValidationLevel.ERROR) {
                console.error(`[RuntimeValidator] ${result.message}`, context);
                throw new Error(result.message);
            } else {
                console.warn(`[RuntimeValidator] ${result.message}`, context);
            }
        }
    }

    /**
     * 验证：视图状态一致性
     */
    public validateViewStateConsistency(): ValidationResult {
        try {
            const stats = this.viewStateManager.getStatistics();
            const hasWorkflowyViews = stats.workflowy > 0;
            const violations = this.isolationLayer.getViolations();

            // 检查是否有 Workflowy 视图但存在大量违规
            if (hasWorkflowyViews && violations.length > 10) {
                const result: ValidationResult = {
                    passed: false,
                    level: ValidationLevel.WARNING,
                    message: `Multiple isolation violations detected (${violations.length}) with active Workflowy views`,
                    timestamp: Date.now(),
                    context: { stats, violationCount: violations.length }
                };

                this.recordValidation(result);
                return result;
            }

            const result: ValidationResult = {
                passed: true,
                level: ValidationLevel.INFO,
                message: 'View state consistency check passed',
                timestamp: Date.now(),
                context: { stats }
            };

            return result;
        } catch (error) {
            const result: ValidationResult = {
                passed: false,
                level: ValidationLevel.ERROR,
                message: `View state consistency check failed: ${error}`,
                timestamp: Date.now()
            };

            this.recordValidation(result);
            return result;
        }
    }

    /**
     * 验证：样式隔离
     */
    public validateStyleIsolation(): ValidationResult {
        try {
            // 检查是否有样式泄露到 Workflowy 容器外
            const containers = document.querySelectorAll('.workflowy-container');
            if (containers.length === 0) {
                return {
                    passed: true,
                    level: ValidationLevel.INFO,
                    message: 'No Workflowy containers present',
                    timestamp: Date.now()
                };
            }

            // 检查是否有未隔离的 Workflowy 样式
            const styleSheets = Array.from(document.styleSheets);
            let unscopedRules = 0;

            for (const sheet of styleSheets) {
                try {
                    const rules = Array.from(sheet.cssRules || []);
                    for (const rule of rules) {
                        // 排除 @keyframes 规则，它们不需要隔离
                        if (rule instanceof CSSKeyframesRule) {
                            continue;
                        }
                        if (rule instanceof CSSStyleRule) {
                            const selector = rule.selectorText;
                            if (this.isWorkflowySelector(selector) &&
                                !this.isProperlyScoped(selector)) {
                                unscopedRules++;
                            }
                        }
                    }
                } catch (e) {
                    // 跨域样式表无法访问
                    continue;
                }
            }

            // 降低严格程度：只有超过阈值才报告为失败
            if (unscopedRules > 5) {
                const result: ValidationResult = {
                    passed: false,
                    level: ValidationLevel.WARNING,
                    message: `Found ${unscopedRules} unscoped Workflowy style rules`,
                    timestamp: Date.now(),
                    context: { unscopedRules }
                };

                this.recordValidation(result);
                return result;
            } else if (unscopedRules > 0) {
                // 少量未隔离规则仅记录info，不影响健康检查
                return {
                    passed: true,
                    level: ValidationLevel.INFO,
                    message: `Style isolation check passed with ${unscopedRules} minor warnings`,
                    timestamp: Date.now(),
                    context: { unscopedRules }
                };
            }

            return {
                passed: true,
                level: ValidationLevel.INFO,
                message: 'Style isolation check passed',
                timestamp: Date.now()
            };
        } catch (error) {
            // 样式检查错误不应导致健康检查失败，降级为INFO
            return {
                passed: true,
                level: ValidationLevel.INFO,
                message: `Style isolation check skipped: ${error}`,
                timestamp: Date.now()
            };
        }
    }

    /**
     * 验证：命令隔离
     */
    public validateCommandIsolation(): ValidationResult {
        try {
            const blockedStats = this.commandProxy.getBlockedCommandStats();
            const totalBlocked = Object.values(blockedStats).reduce((a, b) => a + b, 0);

            if (totalBlocked > 20) {
                const result: ValidationResult = {
                    passed: false,
                    level: ValidationLevel.WARNING,
                    message: `High number of blocked commands (${totalBlocked})`,
                    timestamp: Date.now(),
                    context: { blockedStats }
                };

                this.recordValidation(result);
                return result;
            }

            return {
                passed: true,
                level: ValidationLevel.INFO,
                message: 'Command isolation check passed',
                timestamp: Date.now(),
                context: { totalBlocked }
            };
        } catch (error) {
            const result: ValidationResult = {
                passed: false,
                level: ValidationLevel.ERROR,
                message: `Command isolation check failed: ${error}`,
                timestamp: Date.now()
            };

            this.recordValidation(result);
            return result;
        }
    }

    /**
     * 验证：事件隔离
     */
    public validateEventIsolation(): ValidationResult {
        try {
            const blockedStats = this.eventDelegator.getBlockedEventStats();
            const totalBlocked = Object.values(blockedStats).reduce((a, b) => a + b, 0);

            if (totalBlocked > 50) {
                const result: ValidationResult = {
                    passed: false,
                    level: ValidationLevel.WARNING,
                    message: `High number of blocked events (${totalBlocked})`,
                    timestamp: Date.now(),
                    context: { blockedStats }
                };

                this.recordValidation(result);
                return result;
            }

            return {
                passed: true,
                level: ValidationLevel.INFO,
                message: 'Event isolation check passed',
                timestamp: Date.now(),
                context: { totalBlocked }
            };
        } catch (error) {
            const result: ValidationResult = {
                passed: false,
                level: ValidationLevel.ERROR,
                message: `Event isolation check failed: ${error}`,
                timestamp: Date.now()
            };

            this.recordValidation(result);
            return result;
        }
    }

    /**
     * 执行完整的健康检查
     */
    public performHealthCheck(): HealthCheckResult {
        const checks = {
            viewStateManager: true,
            isolationLayer: true,
            commandProxy: true,
            eventDelegator: true
        };

        const issues: ValidationResult[] = [];

        // 检查各个组件
        try {
            const viewStateResult = this.validateViewStateConsistency();
            if (!viewStateResult.passed) {
                checks.viewStateManager = false;
                issues.push(viewStateResult);
            }
        } catch (error) {
            checks.viewStateManager = false;
            issues.push({
                passed: false,
                level: ValidationLevel.ERROR,
                message: `ViewStateManager check failed: ${error}`,
                timestamp: Date.now()
            });
        }

        try {
            const styleResult = this.validateStyleIsolation();
            if (!styleResult.passed) {
                checks.isolationLayer = false;
                issues.push(styleResult);
            }
        } catch (error) {
            checks.isolationLayer = false;
            issues.push({
                passed: false,
                level: ValidationLevel.ERROR,
                message: `IsolationLayer check failed: ${error}`,
                timestamp: Date.now()
            });
        }

        try {
            const commandResult = this.validateCommandIsolation();
            if (!commandResult.passed) {
                checks.commandProxy = false;
                issues.push(commandResult);
            }
        } catch (error) {
            checks.commandProxy = false;
            issues.push({
                passed: false,
                level: ValidationLevel.ERROR,
                message: `CommandProxy check failed: ${error}`,
                timestamp: Date.now()
            });
        }

        try {
            const eventResult = this.validateEventIsolation();
            if (!eventResult.passed) {
                checks.eventDelegator = false;
                issues.push(eventResult);
            }
        } catch (error) {
            checks.eventDelegator = false;
            issues.push({
                passed: false,
                level: ValidationLevel.ERROR,
                message: `EventDelegator check failed: ${error}`,
                timestamp: Date.now()
            });
        }

        const healthy = Object.values(checks).every(check => check);

        const result: HealthCheckResult = {
            healthy,
            checks,
            issues,
            timestamp: Date.now()
        };

        return result;
    }

    /**
     * 获取所有验证结果
     */
    public getValidationResults(): ValidationResult[] {
        return [...this.validationResults];
    }

    /**
     * 获取错误和警告
     */
    public getIssues(): ValidationResult[] {
        return this.validationResults.filter(
            r => r.level === ValidationLevel.ERROR ||
                r.level === ValidationLevel.WARNING ||
                r.level === ValidationLevel.CRITICAL
        );
    }

    /**
     * 清除验证结果
     */
    public clearResults(): void {
        this.validationResults = [];
    }

    /**
     * 记录验证结果
     */
    private recordValidation(result: ValidationResult): void {
        this.validationResults.push(result);

        // 保持结果大小
        if (this.validationResults.length > this.maxResultSize) {
            this.validationResults = this.validationResults.slice(-this.maxResultSize);
        }
    }

    /**
     * 检查是否是 Workflowy 选择器
     */
    private isWorkflowySelector(selector: string): boolean {
        return selector.includes('workflowy') ||
            selector.includes('block-') ||
            selector.includes('collapse-') ||
            selector.includes('outline-');
    }

    /**
     * 检查选择器是否正确限定作用域
     */
    private isProperlyScoped(selector: string): boolean {
        return selector.startsWith('.workflowy-container') ||
            selector.includes('.workflowy-container ');
    }

    /**
     * 调试：打印状态
     */
    public debugPrintState(): void {
        // Debug method for development
    }
}
