"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAreaManager } from "@/lib/session";

export async function createBrand(formData: FormData) {
  await requireAreaManager();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const colorHex = String(formData.get("colorHex") ?? "#1e3a5f");
  const count = await prisma.brand.count();
  await prisma.brand.create({ data: { name, colorHex, sortOrder: count } });
  revalidatePath("/brands");
}

export async function updateBrand(id: string, formData: FormData) {
  await requireAreaManager();
  await prisma.brand.update({
    where: { id },
    data: {
      name: String(formData.get("name") ?? "").trim(),
      colorHex: String(formData.get("colorHex") ?? "#1e3a5f"),
      active: formData.get("active") === "on",
    },
  });
  revalidatePath("/brands");
}

export async function deleteBrand(formData: FormData) {
  await requireAreaManager();
  const id = String(formData.get("id"));
  const used = await prisma.product.count({ where: { brandId: id } });
  if (used > 0) {
    await prisma.brand.update({ where: { id }, data: { active: false } });
  } else {
    await prisma.brand.delete({ where: { id } });
  }
  revalidatePath("/brands");
}

export async function createCategory(formData: FormData) {
  await requireAreaManager();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const count = await prisma.category.count();
  await prisma.category.upsert({
    where: { name },
    create: { name, sortOrder: count },
    update: {},
  });
  revalidatePath("/brands");
}

export async function deleteCategory(formData: FormData) {
  await requireAreaManager();
  const id = String(formData.get("id"));
  await prisma.category.delete({ where: { id } });
  revalidatePath("/brands");
}
