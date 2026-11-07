import { getAllowStoreEdit, requireAdmin } from "@/lib/session";
import { PageHeader } from "@/components/page-header";
import { HqSettingsForm, StoreEditSwitch } from "./settings-form";

export const dynamic = "force-dynamic";

// 本部設定（本部ログイン時のみ）。旧アプリ settingsView.js の移植
export default async function SettingsPage() {
  const me = await requireAdmin();
  const allowEdit = await getAllowStoreEdit();

  return (
    <div>
      <PageHeader title="本部設定" description="本部ログインのID・パスワードを変更できます（全店・全端末に反映）" />

      <div className="form-card max-w-[560px]">
        <div className="form-section">
          <h2 className="form-section__title">本部ログイン情報</h2>
          <HqSettingsForm currentLoginId={me.email ?? ""} />
        </div>

        <div className="form-section">
          <h2 className="form-section__title">店舗アカウントの権限</h2>
          <StoreEditSwitch initial={allowEdit} />
        </div>

        <div className="form-section">
          <p className="muted text-[13px] leading-7">
            ・変更後は、次回のログインから新しいID・パスワードが必要になります。
            <br />
            ・パスワードは忘れないよう、紙かパスワード管理アプリに控えてください。
            <br />
            ・店舗アカウント（store1007 など）のID・パスワードは「スタッフ管理」で変更します。
          </p>
        </div>
      </div>
    </div>
  );
}
