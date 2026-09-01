import { getSessionUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import ProfileClient from "./ProfileClient";

export default async function ProfileSettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/signin?next=/settings/profile");

  return <ProfileClient name={user.name} email={user.email} avatarUrl={user.avatarUrl} />;
}
