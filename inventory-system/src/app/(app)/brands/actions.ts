"use server";

import { prisma } from "@/lib/prisma";
import { requireProductManager } from "@/lib/session";

export async function createBrand(formData: FormData) {
  await requireProductManager();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const colorHex = String(formData.get("colorHex") ?? "#1e3a5f");
  const count = await prisma.brand.count();
  await prisma.brand.create({ data: { name, colorHex, sortOrder: count } });
}

export async function updateBrand(id: string, formData: FormData) {
  await requireProductManager();
  await prisma.brand.update({
    where: { id },
    data: {
      name: String(formData.get("name") ?? "").trim(),
      colorHex: String(formData.get("colorHex") ?? "#1e3a5f"),
      active: formData.get("active") === "on",
    },
  });
}

export async function deleteBrand(formData: FormData) {
  await requireProductManager();
  const id = String(formData.get("id"));
  const used = await prisma.product.count({ where: { brandId: id } });
  if (used > 0) {
    await prisma.brand.update({ where: { id }, data: { active: false } });
  } else {
    await prisma.brand.delete({ where: { id } });
  }
}

export async function createCategory(formData: FormData) {
  await requireProductManager();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const count = await prisma.category.count();
  await prisma.category.upsert({
    where: { name },
    create: { name, sortOrder: count },
    update: {},
  });
}

export async function deleteCategory(formData: FormData) {
  await requireProductManager();
  const id = String(formData.get("id"));
  await prisma.category.delete({ where: { id } });
}
