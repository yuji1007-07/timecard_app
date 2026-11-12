// YouTube の URL から動画IDとサムネイルを取り出す

/** 限定公開URL（watch?v= / youtu.be / embed / shorts / live）から動画IDを取る。取れなければ null */
export function youtubeId(url: string | null | undefined): string | null {
  const u = (url ?? "").trim();
  if (!u) return null;
  const m =
    /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/))([A-Za-z0-9_-]{11})/.exec(u) ??
    /^([A-Za-z0-9_-]{11})$/.exec(u);
  return m ? m[1] : null;
}

/** サムネイル画像のURL */
export function youtubeThumbnail(url: string | null | undefined): string | null {
  const id = youtubeId(url);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}
