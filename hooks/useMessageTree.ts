import { useMemo } from 'react'
import { Comment } from '../types'

/**
 * Custom hook to build and manage the message tree for a chat room.
 * Handles OP message prepending, comment nesting, sorting, and branch folding logic.
 */
export const useMessageTree = (
    postId: string,
    opPostData: any,
    allComments: Comment[],
    focusCommentId: string | null,
    expandedThreads: Record<string, boolean>,
    getDisplayAuthor: (name: string) => string
) => {
    return useMemo(() => {
        if (!opPostData || !allComments.length || !focusCommentId) return []

        // 1. Prepare OP Message
        const opMessage: Comment = {
            id: 'op-message',
            post_id: postId,
            author: opPostData.author,
            content: opPostData.content,
            content_cn: opPostData.content_cn,
            upvotes: 0,
            depth: -1,
            parent_id: null,
            created_at: new Date().toISOString(),
            enrichment: {
                sentence_segments: opPostData.sentence_segments,
                cultural_notes: opPostData.cultural_notes || [],
            } as any,
        }

        const rootComment = allComments.find((c) => c.id === focusCommentId)
        if (!rootComment) return [opMessage]

        // 2. Build Children Map
        const childrenMap = new Map<string, Comment[]>()
        const opChildren: Comment[] = []
        allComments.forEach((c) => {
            if (c.parent_id === 'op-message') {
                opChildren.push(c)
            } else if (c.parent_id) {
                if (!childrenMap.has(c.parent_id)) childrenMap.set(c.parent_id, [])
                childrenMap.get(c.parent_id)?.push(c)
            }
        })

        const countDescendants = (pid: string): number => {
            const children = childrenMap.get(pid) || []
            return (
                children.length +
                children.reduce((acc, c) => acc + countDescendants(c.id), 0)
            )
        }

        const result: any[] = [opMessage]

        /**
         * Recursively traverse the tree, building the flat message list with folding markers.
         */
        const traverse = (parentId: string, currentDepth: number) => {
            const children = childrenMap.get(parentId) || []
            if (children.length === 0) return

            // [Folding Logic] If relative depth >= 2 and not explicitly expanded, show expand button
            if (currentDepth >= 2 && !expandedThreads[parentId]) {
                result.push({
                    id: `expand-btn-${parentId}`,
                    isExpandButton: true,
                    parentId: parentId,
                    hiddenCount: countDescendants(parentId),
                })
                return
            }

            // Sort children: Local first, then by upvotes
            children.sort((a, b) => {
                if (a.isLocal && !b.isLocal) return -1
                if (!a.isLocal && b.isLocal) return 1
                return (b.upvotes || 0) - (a.upvotes || 0)
            })

            children.forEach((child) => {
                const parentNode =
                    allComments.find((p) => p.id === parentId) ||
                    (parentId === 'op-message' ? opMessage : null)

                result.push({
                    ...child,
                    replyToName: getDisplayAuthor(parentNode?.author || ''),
                    replyText: parentNode?.content,
                })
                traverse(child.id, currentDepth + 1)
            })

            // Add collapse button if depth >= 2 and thread is expanded
            if (currentDepth >= 2 && expandedThreads[parentId]) {
                result.push({
                    id: `collapse-btn-${parentId}`,
                    isCollapseButton: true,
                    parentId: parentId,
                })
            }
        }

        const traverseOpChildren = (nodes: Comment[]) => {
            nodes.sort(
                (a, b) =>
                    new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
            )
            nodes.forEach((child) => {
                result.push({
                    ...child,
                    replyToName: 'OP',
                    replyText: opMessage.content,
                })
                traverse(child.id, 1)
            })
        }

        traverseOpChildren(opChildren)
        result.push({ ...rootComment, replyToName: 'OP' })
        traverse(focusCommentId, 1)

        return result
    }, [allComments, focusCommentId, opPostData, expandedThreads, postId, getDisplayAuthor])
}
