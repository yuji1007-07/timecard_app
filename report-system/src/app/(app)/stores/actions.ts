"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAreaManager } from "@/lib/session";

const storeSchema = z.object({
  name: z.string().min(1, "店舗名は必須です"),
  businessType: z.enum(["SEIKOTSU", "SHINKYU", "ESTHE", "COMPLEX"]),
  area: z.string().optional(),
  directorName: z.string().optional(),
  managerName: z.string().optional(),
  openDate: z.string().optional(),
  status: z.enum(["ACTIVE", "SUSPENDED", "CLOSED"]).default("ACTIVE"),
});

export async function createStore(_prev: unknown, formData: FormData) {
  await requireAreaManager();
  const parsed = storeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const d = parsed.data;
  const count = await prisma.store.count();
  await prisma.store.create({
    data: {
      name: d.name,
      businessType: d.businessType,
      area: d.area || null,
      directorName: d.directorName || null,
      managerName: d.managerName || null,
      openDate: d.openDate ? new Date(d.openDate) : null,
      status: d.status,
      sortOrder: count + 1,
    },
  });
  revalidatePath("/stores");
  return { success: true };
}

export async function updateStore(_prev: unknown, formData: FormData) {
  await requireAreaManager();
  const id = String(formData.get("id"));
  const parsed = storeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  await prisma.store.update({
    where: { id },
    data: {
      name: d.name,
      businessType: d.businessType,
      area: d.area || null,
      directorName: d.directorName || null,
      managerName: d.managerName || null,
      openDate: d.openDate ? new Date(d.openDate) : null,
      status: d.status,
    },
  });
  revalidatePath("/stores");
  revalidatePath(`/stores/${id}`);
  return { success: true };
}

export async function createDepartment(_prev: unknown, formData: FormData) {
  await requireAreaManager();
  const schema = z.object({
    storeId: z.string().min(1),
    name: z.string().min(1, "部門名は必須です"),
    businessType: z.enum(["SEIKOTSU", "SHINKYU", "ESTHE"]),
    managerName: z.string().optional(),
  });
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const count = await prisma.department.count({ where: { storeId: d.storeId } });
  await prisma.department.create({
    data: { storeId: d.storeId, name: d.name, businessType: d.businessType, managerName: d.managerName || null, sortOrder: count + 1 },
  });
  revalidatePath(`/stores/${d.storeId}`);
  return { success: true };
}
