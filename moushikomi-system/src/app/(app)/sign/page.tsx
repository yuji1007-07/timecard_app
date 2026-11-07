import { requireUser } from "@/lib/session";
import { SignaturePad } from "./signature-pad";

export const dynamic = "force-dynamic";

export default async function SignPage() {
  await requireUser();
  return <SignaturePad />;
}
