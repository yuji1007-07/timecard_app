import { requireUser } from "@/lib/session";
import { listApplicationsFor } from "@/lib/data";
import { CustomerList } from "./customer-list";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const user = await requireUser();
  // 店舗ログイン中は自店のデータだけに絞る（本部は全店）
  const apps = await listApplicationsFor(user);
  return <CustomerList apps={apps} storeLocked={!user.isAdmin} />;
}
