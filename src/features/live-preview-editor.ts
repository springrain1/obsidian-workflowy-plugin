/**
 * Live Preview 编辑器增强
 * 为 Live Preview 模式的 contenteditable 添加 Markdown 快捷键和右键菜单支持
 */

import { App, Menu, Editor } from 'obsidian';

export class LivePreviewEditor {
    private app: App;
    private element: HTMLElement;

    constructor(app: App, element: HTMLElement) {
        this.app = app;
        this.element = element;
    }

    /**
     * 绑定快捷键事件
     */
    bindShortcuts(): void {
        this.element.addEventListener('keydown', this.handleKeyDown.bind(this));
    }

    /**
     * 绑定右键菜单
     */
    bindContextMenu(): void {
        this.element.addEventListener('contextmenu', this.handleContextMenu.bind(this));
    }

    /**
     * 处理键盘快捷键
     */
    private handleKeyDown(e: KeyboardEvent): void {
        const isMod = e.ctrlKey || e.metaKey;
        
        // Ctrl+B: 加粗
        if (isMod && e.key === 'b') {
            e.preventDefault();
            e.stopPropagation();
            this.toggleFormat('**', '**', '加粗文本');
            return;
        }

        // Ctrl+I: 斜体
        if (isMod && e.key === 'i') {
            e.preventDefault();
            e.stopPropagation();
            this.toggleFormat('*', '*', '斜体文本');
            return;
        }

        // Ctrl+K: 插入链接
        if (isMod && e.key === 'k') {
            e.preventDefault();
            e.stopPropagation();
            this.insertLink();
            return;
        }

        // Ctrl+Shift+H: 高亮
        if (isMod && e.shiftKey && e.key === 'H') {
            e.preventDefault();
            e.stopPropagation();
            this.toggleFormat('==', '==', '高亮文本');
            return;
        }
    }

    /**
     * 处理右键菜单
     */
    private handleContextMenu(e: MouseEvent): void {
        e.preventDefault();
        e.stopPropagation();

        const menu = new Menu();

        // 获取选中的文本
        const selection = window.getSelection();
        const hasSelection = selection && selection.toString().length > 0;

        // 文本格式化选项
        menu.addItem((item) => {
            item
                .setTitle('加粗')
                .setIcon('bold')
                .onClick(() => this.toggleFormat('**', '**', '加粗文本'));
        });

        menu.addItem((item) => {
            item
                .setTitle('斜体')
                .setIcon('italic')
                .onClick(() => this.toggleFormat('*', '*', '斜体文本'));
        });

        menu.addItem((item) => {
            item
                .setTitle('高亮')
                .setIcon('highlighter')
                .onClick(() => this.toggleFormat('==', '==', '高亮文本'));
        });

        menu.addSeparator();

        // 链接选项
        menu.addItem((item) => {
            item
                .setTitle('插入链接')
                .setIcon('link')
                .onClick(() => this.insertLink());
        });

        menu.addItem((item) => {
            item
                .setTitle('插入外部链接')
                .setIcon('external-link')
                .onClick(() => this.insertExternalLink());
        });

        menu.addSeparator();

        // 剪贴板操作
        if (hasSelection) {
            menu.addItem((item) => {
                item
                    .setTitle('剪切')
                    .setIcon('scissors')
                    .onClick(() => {
                        document.execCommand('cut');
                    });
            });

            menu.addItem((item) => {
                item
                    .setTitle('复制')
                    .setIcon('copy')
                    .onClick(() => {
                        document.execCommand('copy');
                    });
            });
        }

        menu.addItem((item) => {
            item
                .setTitle('粘贴')
                .setIcon('clipboard')
                .onClick(() => {
                    document.execCommand('paste');
                });
        });

        menu.addItem((item) => {
            item
                .setTitle('以纯文本形式粘贴')
                .setIcon('clipboard-paste')
                .onClick(() => {
                    navigator.clipboard.readText().then(text => {
                        this.insertText(text);
                    });
                });
        });

        menu.addSeparator();

        // 全选
        menu.addItem((item) => {
            item
                .setTitle('全选')
                .setIcon('select-all')
                .onClick(() => {
                    const range = document.createRange();
                    range.selectNodeContents(this.element);
                    const sel = window.getSelection();
                    if (sel) {
                        sel.removeAllRanges();
                        sel.addRange(range);
                    }
                });
        });

        // 显示菜单
        menu.showAtMouseEvent(e);
    }

    /**
     * 切换格式（加粗、斜体、高亮等）
     */
    private toggleFormat(prefix: string, suffix: string, placeholder: string): void {
        // 如果是 textarea 元素，使用特殊处理
        if (this.element instanceof HTMLTextAreaElement) {
            this.toggleFormatTextarea(prefix, suffix, placeholder);
            return;
        }

        // 对于 contenteditable 元素，使用 Selection API
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        const selectedText = selection.toString();

        // 如果有选中文本
        if (selectedText) {
            // 检查是否已经有格式
            const container = range.commonAncestorContainer;
            const textContent = container.textContent || '';
            const startOffset = range.startOffset;
            const endOffset = range.endOffset;

            const beforeText = textContent.substring(Math.max(0, startOffset - prefix.length), startOffset);
            const afterText = textContent.substring(endOffset, Math.min(textContent.length, endOffset + suffix.length));

            if (beforeText === prefix && afterText === suffix) {
                // 移除格式
                const newRange = document.createRange();
                newRange.setStart(container, startOffset - prefix.length);
                newRange.setEnd(container, endOffset + suffix.length);
                newRange.deleteContents();
                newRange.insertNode(document.createTextNode(selectedText));
            } else {
                // 添加格式
                range.deleteContents();
                range.insertNode(document.createTextNode(prefix + selectedText + suffix));
            }
        } else {
            // 没有选中文本，插入占位符
            range.insertNode(document.createTextNode(prefix + placeholder + suffix));
        }

        // 触发 input 事件，让 OutlineItem 知道内容已更改
        this.element.dispatchEvent(new Event('input', { bubbles: true }));
    }

    /**
     * 为 textarea 元素切换格式
     */
    private toggleFormatTextarea(prefix: string, suffix: string, placeholder: string): void {
        const textarea = this.element as HTMLTextAreaElement;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = textarea.value.substring(start, end);
        const beforeText = textarea.value.substring(0, start);
        const afterText = textarea.value.substring(end);

        let newText: string;
        let newCursorPos: number;

        if (selectedText) {
            // 检查是否已经有格式
            const hasPrefixBefore = beforeText.endsWith(prefix);
            const hasSuffixAfter = afterText.startsWith(suffix);

            if (hasPrefixBefore && hasSuffixAfter) {
                // 移除格式
                newText = beforeText.slice(0, -prefix.length) + selectedText + afterText.slice(suffix.length);
                newCursorPos = start - prefix.length;
            } else {
                // 添加格式
                newText = beforeText + prefix + selectedText + suffix + afterText;
                newCursorPos = start + prefix.length + selectedText.length + suffix.length;
            }
        } else {
            // 没有选中文本，插入占位符
            newText = beforeText + prefix + placeholder + suffix + afterText;
            newCursorPos = start + prefix.length + placeholder.length + suffix.length;
        }

        textarea.value = newText;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        textarea.focus();

        // 触发 input 事件
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }

    /**
     * 插入内部链接
     */
    private insertLink(): void {
        if (this.element instanceof HTMLTextAreaElement) {
            this.insertLinkTextarea();
            return;
        }

        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        const selectedText = selection.toString();

        // 使用选中的文本作为链接文本，或使用占位符
        const linkText = selectedText || '链接文本';
        const linkMarkdown = `[[${linkText}]]`;

        range.deleteContents();
        range.insertNode(document.createTextNode(linkMarkdown));

        // 触发 input 事件
        this.element.dispatchEvent(new Event('input', { bubbles: true }));
    }

    /**
     * 为 textarea 插入内部链接
     */
    private insertLinkTextarea(): void {
        const textarea = this.element as HTMLTextAreaElement;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = textarea.value.substring(start, end);
        const linkText = selectedText || '链接文本';
        const linkMarkdown = `[[${linkText}]]`;

        const beforeText = textarea.value.substring(0, start);
        const afterText = textarea.value.substring(end);

        textarea.value = beforeText + linkMarkdown + afterText;
        const newCursorPos = start + linkMarkdown.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        textarea.focus();

        textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }

    /**
     * 插入外部链接
     */
    private insertExternalLink(): void {
        if (this.element instanceof HTMLTextAreaElement) {
            this.insertExternalLinkTextarea();
            return;
        }

        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        const selectedText = selection.toString();

        // 使用选中的文本作为链接文本，或使用占位符
        const linkText = selectedText || '链接文本';
        const linkMarkdown = `[${linkText}](https://example.com)`;

        range.deleteContents();
        range.insertNode(document.createTextNode(linkMarkdown));

        // 触发 input 事件
        this.element.dispatchEvent(new Event('input', { bubbles: true }));
    }

    /**
     * 为 textarea 插入外部链接
     */
    private insertExternalLinkTextarea(): void {
        const textarea = this.element as HTMLTextAreaElement;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = textarea.value.substring(start, end);
        const linkText = selectedText || '链接文本';
        const linkMarkdown = `[${linkText}](https://example.com)`;

        const beforeText = textarea.value.substring(0, start);
        const afterText = textarea.value.substring(end);

        textarea.value = beforeText + linkMarkdown + afterText;
        const newCursorPos = start + linkMarkdown.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        textarea.focus();

        textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }

    /**
     * 插入文本
     */
    private insertText(text: string): void {
        if (this.element instanceof HTMLTextAreaElement) {
            const textarea = this.element as HTMLTextAreaElement;
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const beforeText = textarea.value.substring(0, start);
            const afterText = textarea.value.substring(end);

            textarea.value = beforeText + text + afterText;
            const newCursorPos = start + text.length;
            textarea.setSelectionRange(newCursorPos, newCursorPos);
            textarea.focus();

            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            return;
        }

        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(text));

        // 触发 input 事件
        this.element.dispatchEvent(new Event('input', { bubbles: true }));
    }

    /**
     * 解绑事件
     */
    unbind(): void {
        // 事件监听器会在元素销毁时自动清理
    }
}
