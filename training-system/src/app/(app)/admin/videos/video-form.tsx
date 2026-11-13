"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { AUDIENCES, CATEGORIES, REQUIRED_SCOPES } from "@/lib/constants";
import { createVideo, updateVideo } from "./actions";
import { keepForm } from "@/lib/keep-form";

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export type EditableVideo = {
  id: string;
  title: string;
  youtubeUrl: string;
  duration: string;
  category: string;
  audience: string;
  requiredScope: string;
  dueDate: string;
  description: string;
  sortOrder: number;
  isPublished: boolean;
};

function Fields({ video }: { video?: EditableVideo }) {
  return (
    <>
      <div className="space-y-1.5 md:col-span-2">
        <Label>タイトル *</Label>
        <Input name="title" defaultValue={video?.title} required />
      </div>
      <div className="space-y-1.5 md:col-span-2">
        <Label>YouTube の URL（限定公開）</Label>
        <Input name="youtubeUrl" defaultValue={video?.youtubeUrl} placeholder="https://youtu.be/xxxxxxxxxxx" autoComplete="off" inputMode="url" />
        <p className="text-xs text-muted-foreground">空のままだと、スタッフ側には「準備中」と表示されます。サムネイルは URL から自動で取得します。</p>
      </div>
      <div className="space-y-1.5">
        <Label>動画の長さ（分:秒） *</Label>
        <Input name="duration" defaultValue={video?.duration} required placeholder="5:15" />
        <p className="text-xs text-muted-foreground">視聴完了（90%）の計算に使います。YouTube に表示される長さと同じにしてください。</p>
      </div>
      <div className="space-y-1.5">
        <Label>カテゴリ *</Label>
        <select name="category" className={selectClass} defaultValue={video?.category ?? "COMMON"}>
          {Object.entries(CATEGORIES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">「全部門共通」は全ブランド、それ以外はそのブランドのスタッフだけに表示します。</p>
      </div>
      <div className="space-y-1.5">
        <Label>対象役職 *</Label>
        <select name="audience" className={selectClass} defaultValue={video?.audience ?? "ALL"}>
          {Object.entries(AUDIENCES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">「個人指定した人だけ」にすると、下の「個人指定」で選んだスタッフにしか表示されません。</p>
      </div>
      <div className="space-y-1.5">
        <Label>必修の範囲 *</Label>
        <select name="requiredScope" className={selectClass} defaultValue={video?.requiredScope ?? "NONE"}>
          {Object.entries(REQUIRED_SCOPES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label>期限</Label>
        <Input name="dueDate" type="date" defaultValue={video?.dueDate} />
      </div>
      <div className="space-y-1.5">
        <Label>並び順（小さいほど上）</Label>
        <Input name="sortOrder" type="number" defaultValue={video?.sortOrder ?? 0} />
      </div>
      <div className="space-y-1.5">
        <Label>公開 *</Label>
        <select name="isPublished" className={selectClass} defaultValue={video && !video.isPublished ? "0" : "1"}>
          <option value="1">公開（対象スタッフに表示）</option>
          <option value="0">非公開（本部だけ見える）</option>
        </select>
      </div>
      <div className="space-y-1.5 md:col-span-2">
        <Label>説明文</Label>
        <Textarea name="description" rows={3} defaultValue={video?.description} />
      </div>
    </>
  );
}

export function NewVideoForm() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createVideo, null);
  const router = useRouter();
  useEffect(() => {
    // 登録できたら、その動画の編集ページ（テスト問題の登録）へ
    if (state?.success && state.id) router.push(`/admin/videos/${state.id}`);
  }, [state, router]);

  return (
    <div>
      <Button onClick={() => setOpen((v) => !v)} variant={open ? "outline" : "default"}>
        {open ? "キャンセル" : "＋ 動画を追加"}
      </Button>
      {open && (
        <Card className="mt-3 text-left">
          <CardContent className="pt-5">
            <form onSubmit={keepForm(action)} className="grid gap-4 md:grid-cols-2">
              <Fields />
              <div className="flex items-center gap-3 md:col-span-2">
                <Button type="submit" disabled={pending}>
                  {pending ? "登録中..." : "登録する"}
                </Button>
                {state?.error && <span className="text-sm text-destructive">{state.error}</span>}
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function EditVideoForm({ video }: { video: EditableVideo }) {
  const [state, action, pending] = useActionState(updateVideo, null);
  const router = useRouter();
  useEffect(() => {
    if (state?.success) router.refresh();
  }, [state, router]);
  return (
    <form onSubmit={keepForm(action)} className="grid gap-4 md:grid-cols-2">
      <input type="hidden" name="id" value={video.id} />
      <Fields video={video} />
      <div className="flex items-center gap-3 md:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "保存中..." : "動画を更新する"}
        </Button>
        {state?.error && <span className="text-sm text-destructive">{state.error}</span>}
        {state?.success && <span className="text-sm text-green-600">{state.message}</span>}
      </div>
    </form>
  );
}
