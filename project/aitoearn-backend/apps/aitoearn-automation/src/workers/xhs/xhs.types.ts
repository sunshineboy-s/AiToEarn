export interface ActionResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

export interface XhsLikeData {
  noteId: string
  alreadyLiked: boolean
  likeCount?: string
}

export interface XhsReplyData {
  noteId: string
  comment: string
}

export interface XhsSearchItem {
  noteId: string
  title: string
  url: string
  authorName?: string
  likeCount?: string
  thumbnail?: string
}

export interface XhsSearchData {
  keyword: string
  items: XhsSearchItem[]
}
