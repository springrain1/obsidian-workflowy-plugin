import { OutlineBlock, MarkdownParseResult } from './types';
import { generateId } from './utils';

export class OutlineParser {
    
    /**
     * 将 Markdown 文本解析为大纲块结构
     * 支持所有 Markdown 元素类型
     * 
     * 策略：
     * 1. 列表项：逐行解析，构建层级结构（WorkFlowy 风格）
     * 2. 其他内容：合并连续的非列表行为一个块，交给 Obsidian 渲染器处理
     */
    parseMarkdown(content: string): MarkdownParseResult {
        const lines = content.split('\n');
        const flatBlocks: OutlineBlock[] = [];
        let totalBlocks = 0;
        let maxLevel = 0;

        // 用于累积连续的非列表内容
        let nonListLines: string[] = [];

        const flushNonListBlock = () => {
            if (nonListLines.length > 0) {
                const blockContent = nonListLines.join('\n').trim();
                if (blockContent) {
                    flatBlocks.push({
                        id: generateId(),
                        type: 'paragraph',  // 统一作为段落，让 Obsidian 渲染器处理
                        content: blockContent,
                        level: 0,
                        collapsed: false,
                        children: [],
                        editable: true,
                        useObsidianRenderer: true
                    });
                    totalBlocks++;
                }
                nonListLines = [];
            }
        };

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            // 检测列表项
            const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
            if (listMatch) {
                // 先刷新之前累积的非列表内容
                flushNonListBlock();

                const [, indent, , text] = listMatch;
                // 计算缩进层级：优先检测Tab，其次检测空格（兼容性）
                const tabCount = (indent.match(/\t/g) || []).length;
                const spaceCount = (indent.match(/ /g) || []).length;
                const level = tabCount > 0 ? tabCount : Math.floor(spaceCount / 2); // Tab优先，否则每2个空格为一级
                maxLevel = Math.max(maxLevel, level);

                // 检测待办事项
                let isTodo = false;
                let todoCompleted = false;
                let content = text;
                
                const todoMatch = text.match(/^\[([ xX])\]\s+(.*)$/);
                if (todoMatch) {
                    isTodo = true;
                    todoCompleted = todoMatch[1].toLowerCase() === 'x';
                    content = todoMatch[2];
                }

                // 检查后续行是否是续行（缩进但没有列表标记）
                let j = i + 1;
                while (j < lines.length) {
                    const nextLine = lines[j];
                    const nextTrimmed = nextLine.trim();
                    
                    // 空行跳过
                    if (!nextTrimmed) {
                        j++;
                        continue;
                    }
                    
                    // 检查是否是续行（有缩进但没有列表标记）
                    const continuationMatch = nextLine.match(/^(\s+)([^-*+\d].*)$/);
                    if (continuationMatch) {
                        const [, nextIndent, continuationText] = continuationMatch;
                        // 续行的缩进应该比列表项多（至少2个空格或1个tab）
                        const nextIndentLength = nextIndent.length;
                        const currentIndentLength = indent.length;
                        
                        if (nextIndentLength > currentIndentLength) {
                            // 这是续行，添加到内容中
                            content += '\n' + continuationText.trim();
                            j++;
                        } else {
                            break;
                        }
                    } else {
                        // 不是续行，退出
                        break;
                    }
                }
                
                // 更新索引，跳过已处理的续行
                i = j - 1;

                flatBlocks.push({
                    id: generateId(),
                    type: 'list',
                    content,
                    level,
                    collapsed: false,
                    children: [],
                    isTodo,
                    todoCompleted,
                    editable: true,
                    useObsidianRenderer: false  // 列表项使用 WorkFlowy 风格渲染
                });
                totalBlocks++;
                continue;
            }

            // 非列表内容：累积到 nonListLines
            nonListLines.push(line);
        }

        // 处理最后剩余的非列表内容
        flushNonListBlock();

        // 构建层级关系（只对列表项）
        const blocks = this.buildHierarchy(flatBlocks);

        return {
            blocks,
            metadata: {
                totalBlocks,
                maxLevel
            }
        };
    }

    /**
     * 构建列表项的层级关系
     * 非列表项作为顶级块，列表项按缩进构建树形结构
     */
    private buildHierarchy(flatBlocks: OutlineBlock[]): OutlineBlock[] {
        const result: OutlineBlock[] = [];
        const stack: OutlineBlock[] = [];

        for (const block of flatBlocks) {
            // 非列表项直接作为顶级块
            if (block.type !== 'list') {
                result.push(block);
                stack.length = 0; // 清空栈
                continue;
            }

            // 列表项：构建层级关系
            while (stack.length > 0 && stack[stack.length - 1].level >= block.level) {
                stack.pop();
            }

            if (stack.length === 0) {
                result.push(block);
            } else {
                const parent = stack[stack.length - 1];
                parent.children.push(block);
                block.parent = parent;
            }

            stack.push(block);
        }

        return result;
    }
    
    /**
     * 将大纲块结构转换为 Markdown 文本
     * 支持所有块类型
     */
    blocksToMarkdown(blocks: OutlineBlock[]): string {
        const lines: string[] = [];

        function processBlock(block: OutlineBlock, parentLevel: number = 0) {
            switch (block.type) {
                case 'heading':
                    const hashes = '#'.repeat(block.headingLevel || 1);
                    lines.push(`${hashes} ${block.content}`);
                    break;

                case 'code':
                    lines.push('```' + (block.codeLanguage || ''));
                    lines.push(block.content);
                    lines.push('```');
                    break;

                case 'quote':
                    const quotes = '>'.repeat(block.quoteLevel || 1);
                    lines.push(`${quotes} ${block.content}`);
                    break;

                case 'horizontal':
                    lines.push('---');
                    break;

                case 'paragraph':
                    lines.push(block.content);
                    break;

                case 'blank':
                    lines.push('');
                    break;

                case 'list':
                    const indent = '\t'.repeat(block.level);
                    let content = block.content;

                    // 如果是待办事项，添加复选框标记
                    if (block.isTodo) {
                        const checkbox = block.todoCompleted ? '[x]' : '[ ]';
                        content = `${checkbox} ${content}`;
                    }

                    // 将内容中的换行符转换为 Markdown 列表项的续行格式
                    if (content.includes('\n')) {
                        const contentLines = content.split('\n');
                        const firstLine = `${indent}- ${contentLines[0]}`;
                        const continuationLines = contentLines.slice(1).map(
                            line => `${indent}  ${line}`
                        );
                        lines.push(firstLine);
                        lines.push(...continuationLines);
                    } else {
                        lines.push(`${indent}- ${content}`);
                    }

                    // 递归处理子块
                    for (const child of block.children) {
                        processBlock(child, block.level);
                    }
                    break;
            }

            // 非列表项的子块（如果有的话）
            if (block.type !== 'list') {
                for (const child of block.children) {
                    processBlock(child, parentLevel);
                }
            }
        }

        for (const block of blocks) {
            processBlock(block);
        }

        return lines.join('\n');
    }
    
    /**
     * 更新单个块的内容
     */
    updateBlockContent(blocks: OutlineBlock[], blockId: string, newContent: string): OutlineBlock[] {
        function updateInBlocks(blockList: OutlineBlock[]): OutlineBlock[] {
            return blockList.map(block => {
                if (block.id === blockId) {
                    return { ...block, content: newContent };
                }
                return {
                    ...block,
                    children: updateInBlocks(block.children)
                };
            });
        }
        
        return updateInBlocks(blocks);
    }
    
    /**
     * 插入新块
     */
    insertBlock(blocks: OutlineBlock[], newBlock: OutlineBlock, afterBlockId?: string): OutlineBlock[] {
        if (!afterBlockId) {
            return [...blocks, newBlock];
        }
        
        function insertInBlocks(blockList: OutlineBlock[]): OutlineBlock[] {
            const result: OutlineBlock[] = [];
            
            for (const block of blockList) {
                result.push({
                    ...block,
                    children: insertInBlocks(block.children)
                });
                
                if (block.id === afterBlockId) {
                    result.push(newBlock);
                }
            }
            
            return result;
        }
        
        return insertInBlocks(blocks);
    }
    
    /**
     * 删除块
     */
    deleteBlock(blocks: OutlineBlock[], blockId: string): OutlineBlock[] {
        function deleteFromBlocks(blockList: OutlineBlock[]): OutlineBlock[] {
            return blockList
                .filter(block => block.id !== blockId)
                .map(block => ({
                    ...block,
                    children: deleteFromBlocks(block.children)
                }));
        }
        
        return deleteFromBlocks(blocks);
    }
}