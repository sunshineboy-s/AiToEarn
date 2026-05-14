export interface DouyinLikeData {
  videoId: string
  alreadyLiked: boolean
  likeCount?: string
}

export interface DouyinReplyData {
  videoId: string
  comment: string
}

export interface DouyinSearchItem {
  videoId: string
  title: string
  url: string
  authorName?: string
  likeCount?: string
  thumbnail?: string
}

export interface DouyinSearchData {
  keyword: string
  items: DouyinSearchItem[]
}
