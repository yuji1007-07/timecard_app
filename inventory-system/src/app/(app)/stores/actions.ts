"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAreaManager } from "@/lib/session";

const storeSchema = z.object({
  name: z.string().min(1, "店舗名は必須です"),
  businessType: z.enum(["SEIKOTSU", "SHINKYU", "ESTHE", "COMPLEX"]),
  isHeadquarters: z.boolean().optional(),
  area: z.string().optional(),
  directorName: z.string().optional(),
  managerName: z.string().optional(),
  openDate: z.string().optional(),
  status: z.enum(["ACTIVE", "SUSPENDED", "CLOSED"]),
  pinCode: z.string().optional(),
  sortOrder: z.coerce.number().int().optional(),
});

function parse(formData: FormData) {
  return storeSchema.parse({
    name: formData.get("name"),
    businessType: formData.get("businessType"),
    isHeadquarters: formData.get("isHeadquarters") === "on",
    area: formData.get("area") || undefined,
    directorName: formData.get("directorName") || undefined,
    managerName: formData.get("managerName") || undefined,
    openDate: formData.get("openDate") || undefined,
    status: formData.get("status"),
    pinCode: formData.get("pinCode") || undefined,
    sortOrder: formData.get("sortOrder") || undefined,
  });
}

export async function createStore(formData: FormData) {
  await requireAreaManager();
  const d = parse(formData);
  await prisma.store.create({
    data: {
      name: d.name,
      businessType: d.businessType,
      isHeadquarters: d.isHeadquarters ?? false,
      area: d.area,
      directorName: d.directorName,
      managerName: d.managerName,
      openDate: d.openDate ? new Date(d.openDate) : null,
      status: d.status,
      pinCode: d.pinCode || null,
      sortOrder: d.sortOrder ?? 0,
    },
  });
  revalidatePath("/stores");
}

export async function updateStore(id: string, formData: FormData) {
  await requireAreaManager();
  const d = parse(formData);
  await prisma.store.update({
    where: { id },
    data: {
      name: d.name,
      businessType: d.businessType,
      isHeadquarters: d.isHeadquarters ?? false,
      area: d.area,
      directorName: d.directorName,
      managerName: d.managerName,
      openDate: d.openDate ? new Date(d.openDate) : null,
      status: d.status,
      pinCode: d.pinCode || null,
      sortOrder: d.sortOrder ?? 0,
    },
  });
  revalidatePath("/stores");
}

export async function deleteStore(formData: FormData) {
  await requireAreaManager();
  const id = String(formData.get("id"));
  const txCount = await prisma.transaction.count({ where: { storeId: id } });
  if (txCount > 0) {
    // 取引履歴がある店舗は削除せず休止扱いにする（データ保全）
    await prisma.store.update({ where: { id }, data: { status: "CLOSED" } });
  } else {
    await prisma.store.delete({ where: { id } });
  }
  revalidatePath("/stores");
}
