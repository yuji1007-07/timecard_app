import { requireUser } from "@/lib/session";
import { ConfirmView } from "./confirm-view";

export const dynamic = "force-dynamic";

export default async function ConfirmPage() {
  await requireUser();
  return <ConfirmView />;
}
