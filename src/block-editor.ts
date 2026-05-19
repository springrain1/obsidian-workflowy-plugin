import { OutlineBlock, BlockPosition, WorkflowyState } from './types';
import { generateId, findBlockById, findParentBlock, getAllBlocks } from './utils';
import { OutlineParser } from './outline-parser';

export class BlockEditor {
    private state: WorkflowyState;
    private parser: OutlineParser;
    private undoStack: WorkflowyState[] = [];
    private redoStack: WorkflowyState[] = [];

    constructor() {
        this.state = {
            blocks: [],
            focusedBlockId: null,
            collapsedBlocks: new Set(),
            selectedBlocks: new Set()
        };
        this.parser = new OutlineParser();
    }

    // 状态管理
    getState(): WorkflowyState {
        return { ...this.state };
    }

    setState(newState: Partial<WorkflowyState>, saveHistory: boolean = true): void {
        if (saveHistory) {
            this.saveToUndoStack();
        }
        this.state = { ...this.state, ...newState };
    }

    /**
     * 深拷贝状态（避免引用问题）
     * 使用自定义深拷贝避免循环引用问题（如parent属性）
     */
    private cloneState(state: WorkflowyState): WorkflowyState {
        return {
            blocks: this.deepCloneBlocks(state.blocks),
            focusedBlockId: state.focusedBlockId,
            collapsedBlocks: new Set(state.collapsedBlocks),
            selectedBlocks: new Set(state.selectedBlocks)
        };
    }

    /**
     * 深拷贝blocks数组（跳过循环引用属性如parent）
     */
    private deepCloneBlocks(blocks: OutlineBlock[]): OutlineBlock[] {
        return blocks.map(block => ({
            id: block.id,
            type: block.type || 'list', // 默认为列表类型
            content: block.content,
            level: block.level,
            collapsed: block.collapsed,
            isTodo: block.isTodo,
            todoCompleted: block.todoCompleted,
            children: this.deepCloneBlocks(block.children),
            // 新增的属性
            headingLevel: block.headingLevel,
            codeLanguage: block.codeLanguage,
            quoteLevel: block.quoteLevel,
            editable: block.editable,
            useObsidianRenderer: block.useObsidianRenderer,
            // 注意：不复制parent等可能导致循环引用的属性
        }));
    }

    // 撤销/重做
    private saveToUndoStack(): void {
        // 深拷贝状态，避免引用问题
        this.undoStack.push(this.cloneState(this.state));
        if (this.undoStack.length > 50) {
            this.undoStack.shift();
        }
        this.redoStack = []; // 清空重做栈
    }

    undo(): boolean {
        if (this.undoStack.length === 0) {
            return false;
        }

        // 深拷贝当前状态到重做栈
        this.redoStack.push(this.cloneState(this.state));

        // 恢复上一个状态（已经是深拷贝）
        const previousState = this.undoStack.pop()!;
        this.state = previousState;

        return true;
    }

    redo(): boolean {
        if (this.redoStack.length === 0) {
            return false;
        }

        // 深拷贝当前状态到撤销栈
        this.undoStack.push(this.cloneState(this.state));

        // 恢复下一个状态（已经是深拷贝）
        const nextState = this.redoStack.pop()!;
        this.state = nextState;

        return true;
    }

    // 块操作
    createNewBlock(afterBlockId?: string): OutlineBlock {
        const newBlock: OutlineBlock = {
            id: generateId(),
            type: 'list', // 新建块默认为列表项
            content: '',
            children: [],
            level: 0,
            collapsed: false
        };

        if (afterBlockId) {
            const afterBlock = findBlockById(this.state.blocks, afterBlockId);
            if (afterBlock) {
                newBlock.level = afterBlock.level;
            }
        }

        const newBlocks = this.parser.insertBlock(this.state.blocks, newBlock, afterBlockId);
        this.setState({
            blocks: newBlocks,
            focusedBlockId: newBlock.id
        });

        return newBlock;
    }

    createChildBlock(parentBlockId: string): OutlineBlock {
        const parentBlock = findBlockById(this.state.blocks, parentBlockId);
        if (!parentBlock) {
            console.error('[BlockEditor] Parent block not found:', parentBlockId);
            return this.createNewBlock(parentBlockId);
        }

        const newBlock: OutlineBlock = {
            id: generateId(),
            type: 'list', // 子块默认为列表项
            content: '',
            children: [],
            level: parentBlock.level + 1,
            collapsed: false
        };

        // 将新块添加为父块的第一个子块
        const newBlocks = this.addChildBlock(this.state.blocks, parentBlockId, newBlock);
        this.setState({
            blocks: newBlocks,
            focusedBlockId: newBlock.id
        });

        return newBlock;
    }

    private addChildBlock(blocks: OutlineBlock[], parentId: string, childBlock: OutlineBlock): OutlineBlock[] {
        return blocks.map(block => {
            if (block.id === parentId) {
                return {
                    ...block,
                    children: [...block.children, childBlock]
                };
            }
            return {
                ...block,
                children: this.addChildBlock(block.children, parentId, childBlock)
            };
        });
    }

    deleteBlock(blockId: string): boolean {
        const block = findBlockById(this.state.blocks, blockId);
        if (!block) return false;

        // 如果有子块，将子块提升到父级
        const parent = findParentBlock(this.state.blocks, blockId);
        let newBlocks = this.parser.deleteBlock(this.state.blocks, blockId);

        if (block.children.length > 0 && parent) {
            // 将子块插入到父级中
            for (const child of block.children) {
                child.level = block.level;
                newBlocks = this.parser.insertBlock(newBlocks, child, blockId);
            }
        }

        this.setState({ blocks: newBlocks });
        return true;
    }

    updateBlockContent(blockId: string, content: string): void {
        const newBlocks = this.parser.updateBlockContent(this.state.blocks, blockId, content);
        this.setState({ blocks: newBlocks });
    }

    // 缩进操作
    indentBlock(blockId: string): boolean {
        const block = findBlockById(this.state.blocks, blockId);
        if (!block) return false;

        const allBlocks = getAllBlocks(this.state.blocks);
        const currentIndex = allBlocks.findIndex(b => b.id === blockId);

        if (currentIndex <= 0) return false;

        const prevBlock = allBlocks[currentIndex - 1];

        // 移除当前块
        let newBlocks = this.parser.deleteBlock(this.state.blocks, blockId);

        // 将块添加为前一个块的子块
        const updatedBlock = { ...block, level: prevBlock.level + 1 };

        // 找到前一个块并添加子块
        function addAsChild(blocks: OutlineBlock[]): OutlineBlock[] {
            return blocks.map(b => {
                if (b.id === prevBlock.id) {
                    return { ...b, children: [...b.children, updatedBlock] };
                }
                return { ...b, children: addAsChild(b.children) };
            });
        }

        newBlocks = addAsChild(newBlocks);
        this.setState({ blocks: newBlocks });
        return true;
    }

    outdentBlock(blockId: string): boolean {
        const block = findBlockById(this.state.blocks, blockId);
        const parent = findParentBlock(this.state.blocks, blockId);

        if (!block || !parent || block.level === 0) return false;

        // 移除当前块
        let newBlocks = this.parser.deleteBlock(this.state.blocks, blockId);

        // 将块提升到父级的同级
        const updatedBlock = { ...block, level: parent.level };

        // 找到祖父级并插入
        const grandParent = findParentBlock(this.state.blocks, parent.id);
        if (grandParent) {
            // 插入到父块之后
            newBlocks = this.parser.insertBlock(newBlocks, updatedBlock, parent.id);
        } else {
            // 插入到顶级
            newBlocks.push(updatedBlock);
        }

        this.setState({ blocks: newBlocks });
        return true;
    }

    // 移动操作（在同一父级的兄弟节点间上/下移动）
    private replaceChildren(blocks: OutlineBlock[], parentId: string, newChildren: OutlineBlock[]): OutlineBlock[] {
        return blocks.map(b => {
            if (b.id === parentId) {
                return { ...b, children: newChildren };
            }
            if (b.children && b.children.length > 0) {
                return { ...b, children: this.replaceChildren(b.children, parentId, newChildren) };
            }
            return { ...b };
        });
    }

    private getParentAndSiblings(blockId: string): { parent: OutlineBlock | null, siblings: OutlineBlock[], index: number } | null {
        const parent = findParentBlock(this.state.blocks, blockId);
        const siblings = parent ? parent.children : this.state.blocks;
        const index = siblings.findIndex(b => b.id === blockId);
        if (index === -1) return null;
        return { parent: parent || null, siblings, index };
    }

    moveBlockUp(blockId: string): boolean {
        const info = this.getParentAndSiblings(blockId);
        if (!info) return false;
        const { parent, siblings, index } = info;
        if (index <= 0) return false;

        const newSiblings = siblings.slice();
        const tmp = newSiblings[index - 1];
        newSiblings[index - 1] = newSiblings[index];
        newSiblings[index] = tmp;

        let newBlocks: OutlineBlock[];
        if (parent) {
            newBlocks = this.replaceChildren(this.state.blocks, parent.id, newSiblings);
        } else {
            newBlocks = newSiblings;
        }
        this.setState({ blocks: newBlocks });
        return true;
    }

    moveBlockDown(blockId: string): boolean {
        const info = this.getParentAndSiblings(blockId);
        if (!info) return false;
        const { parent, siblings, index } = info;
        if (index >= siblings.length - 1) return false;

        const newSiblings = siblings.slice();
        const tmp = newSiblings[index + 1];
        newSiblings[index + 1] = newSiblings[index];
        newSiblings[index] = tmp;

        let newBlocks: OutlineBlock[];
        if (parent) {
            newBlocks = this.replaceChildren(this.state.blocks, parent.id, newSiblings);
        } else {
            newBlocks = newSiblings;
        }
        this.setState({ blocks: newBlocks });
        return true;
    }

    // 折叠操作
    toggleCollapse(blockId: string): boolean {
        const block = findBlockById(this.state.blocks, blockId);
        if (!block || block.children.length === 0) return false;

        const newCollapsed = new Set(this.state.collapsedBlocks);
        if (newCollapsed.has(blockId)) {
            newCollapsed.delete(blockId);
        } else {
            newCollapsed.add(blockId);
        }

        this.setState({ collapsedBlocks: newCollapsed }, false); // 不保存到撤销历史
        return true;
    }

    isCollapsed(blockId: string): boolean {
        return this.state.collapsedBlocks.has(blockId);
    }

    /**
     * 折叠指定块
     * 注意：与 toggleCollapse 不同，这里允许折叠没有子项的块
     * 这是为了与 obsidian-outliner 的行为保持一致
     */
    collapse(blockId: string): boolean {
        const block = findBlockById(this.state.blocks, blockId);
        if (!block) return false;

        if (!this.state.collapsedBlocks.has(blockId)) {
            const newCollapsed = new Set(this.state.collapsedBlocks);
            newCollapsed.add(blockId);
            this.setState({ collapsedBlocks: newCollapsed }, false);
            return true;
        }
        return false;
    }

    /**
     * 展开指定块
     */
    expand(blockId: string): boolean {
        if (this.state.collapsedBlocks.has(blockId)) {
            const newCollapsed = new Set(this.state.collapsedBlocks);
            newCollapsed.delete(blockId);
            this.setState({ collapsedBlocks: newCollapsed }, false);
            return true;
        }
        return false;
    }

    /**
     * 切换待办状态
     */
    toggleTodo(blockId: string): boolean {
        const block = findBlockById(this.state.blocks, blockId);
        if (!block) return false;

        const updateTodoInBlocks = (blocks: OutlineBlock[]): OutlineBlock[] => {
            return blocks.map(b => {
                if (b.id === blockId) {
                    if (b.isTodo) {
                        // 已经是待办，切换完成状态
                        return { ...b, todoCompleted: !b.todoCompleted };
                    } else {
                        // 不是待办，转换为未完成的待办
                        return { ...b, isTodo: true, todoCompleted: false };
                    }
                }
                return {
                    ...b,
                    children: updateTodoInBlocks(b.children)
                };
            });
        };

        const newBlocks = updateTodoInBlocks(this.state.blocks);
        this.setState({ blocks: newBlocks });
        return true;
    }

    // 焦点管理
    focusBlock(blockId: string): void {
        this.setState({ focusedBlockId: blockId }, false); // 不保存到撤销历史
    }

    getFocusedBlock(): OutlineBlock | null {
        if (!this.state.focusedBlockId) return null;
        return findBlockById(this.state.blocks, this.state.focusedBlockId);
    }

    // 导航
    navigateUp(): boolean {
        const focused = this.getFocusedBlock();
        if (!focused) return false;

        const allBlocks = getAllBlocks(this.state.blocks);
        const currentIndex = allBlocks.findIndex(b => b.id === focused.id);

        if (currentIndex > 0) {
            this.focusBlock(allBlocks[currentIndex - 1].id);
            return true;
        }

        return false;
    }

    navigateDown(): boolean {
        const focused = this.getFocusedBlock();
        if (!focused) return false;

        const allBlocks = getAllBlocks(this.state.blocks);
        const currentIndex = allBlocks.findIndex(b => b.id === focused.id);

        if (currentIndex < allBlocks.length - 1) {
            this.focusBlock(allBlocks[currentIndex + 1].id);
            return true;
        }

        return false;
    }

    navigateLeft(): boolean {
        const focused = this.getFocusedBlock();
        if (!focused) return false;

        // 左箭头：移动到父级块
        const parent = findParentBlock(this.state.blocks, focused.id);
        if (parent) {
            this.focusBlock(parent.id);
            return true;
        }

        return false;
    }

    navigateRight(): boolean {
        const focused = this.getFocusedBlock();
        if (!focused) return false;

        // 右箭头：移动到第一个子块
        if (focused.children.length > 0) {
            this.focusBlock(focused.children[0].id);
            return true;
        }

        return false;
    }

    // 导出为 Markdown
    toMarkdown(): string {
        const markdown = this.parser.blocksToMarkdown(this.state.blocks);
        return markdown;
    }

    // 从 Markdown 加载
    loadFromMarkdown(content: string): void {
        const result = this.parser.parseMarkdown(content);
        this.setState({
            blocks: result.blocks,
            focusedBlockId: null,
            collapsedBlocks: new Set(),
            selectedBlocks: new Set()
        });
    }

    /**
     * 移动块到指定位置
     */
    moveBlock(sourceBlockId: string, targetBlockId: string, position: string): boolean {
        const allBlocks = getAllBlocks(this.state.blocks);
        const sourceBlock = allBlocks.find(b => b.id === sourceBlockId);
        const targetBlock = allBlocks.find(b => b.id === targetBlockId);
        
        if (!sourceBlock || !targetBlock) {
            return false;
        }

        // 检查是否会造成循环引用
        if (this.wouldCreateCycle(sourceBlockId, targetBlockId, position)) {
            return false;
        }

        // 1. 从原位置移除源块
        const newBlocks = this.removeBlockFromTree(this.state.blocks, sourceBlockId);
        
        // 2. 计算目标位置和层级（使用移除后的树来计算）
        const newAllBlocks = getAllBlocks(newBlocks);
        const newTargetBlock = newAllBlocks.find(b => b.id === targetBlockId);
        
        if (!newTargetBlock) {
            return false;
        }
        
        let targetLevel: number;
        let insertParentId: string | null = null;
        let insertIndex: number;

        if (position === 'child') {
            // 作为子项插入
            insertParentId = targetBlockId;
            insertIndex = 0; // 插入到子项列表的开头
            
            // 目标层级应该是父节点层级 + 1
            targetLevel = newTargetBlock.level + 1;
        } else {
            // 作为兄弟项插入
            insertParentId = this.findParentIdInBlocks(newBlocks, targetBlockId);
            
            // 目标层级应该与目标块相同
            targetLevel = newTargetBlock.level;
            
            // 找到目标块在兄弟列表中的位置
            const siblings = insertParentId ? 
                newAllBlocks.find(b => b.id === insertParentId)?.children || [] :
                newBlocks;
            const targetIndex = siblings.findIndex(b => b.id === targetBlockId);
            
            insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
        }

        // 3. 更新源块的层级
        const updatedSourceBlock = this.updateBlockLevel(sourceBlock, targetLevel);

        // 4. 插入到新位置
        const finalBlocks = this.insertBlockAtPosition(newBlocks, updatedSourceBlock, insertParentId, insertIndex);

        this.setState({ blocks: finalBlocks });
        return true;
    }

    /**
     * 检查移动是否会造成循环引用
     */
    private wouldCreateCycle(sourceBlockId: string, targetBlockId: string, position: string): boolean {
        if (position !== 'child') {
            return false; // before/after 不会造成循环引用
        }

        // 检查目标块是否是源块的后代
        return this.isDescendant(sourceBlockId, targetBlockId);
    }

    /**
     * 检查是否是后代关系
     */
    private isDescendant(ancestorId: string, descendantId: string): boolean {
        const allBlocks = getAllBlocks(this.state.blocks);
        const ancestor = allBlocks.find(b => b.id === ancestorId);
        
        if (!ancestor) return false;

        const checkChildren = (children: OutlineBlock[]): boolean => {
            for (const child of children) {
                if (child.id === descendantId) {
                    return true;
                }
                if (checkChildren(child.children)) {
                    return true;
                }
            }
            return false;
        };

        return checkChildren(ancestor.children);
    }

    /**
     * 从树中移除指定块
     */
    private removeBlockFromTree(blocks: OutlineBlock[], blockId: string): OutlineBlock[] {
        return blocks.map(block => {
            if (block.id === blockId) {
                return null; // 标记为删除
            }
            return {
                ...block,
                children: this.removeBlockFromTree(block.children, blockId)
            };
        }).filter(block => block !== null) as OutlineBlock[];
    }

    /**
     * 更新块及其所有子块的层级
     */
    private updateBlockLevel(block: OutlineBlock, newLevel: number): OutlineBlock {
        const levelDiff = newLevel - block.level;
        
        const updateLevel = (b: OutlineBlock): OutlineBlock => ({
            ...b,
            level: b.level + levelDiff,
            children: b.children.map(updateLevel)
        });

        return updateLevel(block);
    }

    /**
     * 在指定位置插入块
     */
    private insertBlockAtPosition(blocks: OutlineBlock[], blockToInsert: OutlineBlock, parentId: string | null, index: number): OutlineBlock[] {
        if (!parentId) {
            // 插入到根级别
            const newBlocks = [...blocks];
            newBlocks.splice(index, 0, blockToInsert);
            return newBlocks;
        }

        // 插入到指定父块的子项中
        return blocks.map(block => {
            if (block.id === parentId) {
                const newChildren = [...block.children];
                newChildren.splice(index, 0, blockToInsert);
                return { ...block, children: newChildren };
            }
            return {
                ...block,
                children: this.insertBlockAtPosition(block.children, blockToInsert, parentId, index)
            };
        });
    }

    /**
     * 查找父块ID
     */
    private findParentId(blockId: string): string | null {
        return this.findParentIdInBlocks(this.state.blocks, blockId);
    }

    /**
     * 在指定的块树中查找父块ID
     */
    private findParentIdInBlocks(blocks: OutlineBlock[], blockId: string): string | null {
        const allBlocks = getAllBlocks(blocks);
        
        for (const block of allBlocks) {
            if (block.children.some(child => child.id === blockId)) {
                return block.id;
            }
        }
        
        return null;
    }
}