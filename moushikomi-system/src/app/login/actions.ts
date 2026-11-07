"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";

export async function authenticate(
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  try {
    await signIn("credentials", {
      loginId: formData.get("loginId"),
      password: formData.get("password"),
      redirectTo: "/home",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return "ユーザーIDまたはパスワードが正しくありません。";
    }
    throw error;
  }
  return undefined;
}
