import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import LibraryClient from "./LibraryClient";

export default async function LibraryPage() {
  const user = await getSessionUser();
  if (!user) redirect("/signin?next=/library");

  const assets = await prisma.asset.findMany({
    where: { userId: user.id },
    select: { id: true, name: true, kind: true, size: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return <LibraryClient assets={assets} />;
}
