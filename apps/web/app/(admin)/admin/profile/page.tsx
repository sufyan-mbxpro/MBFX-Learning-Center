import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@repo/auth";
import { loadOwnProfile } from "@repo/core";
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components/avatar";
import { Badge } from "@repo/ui/components/badge";
import { AdminPage, AdminSection } from "../_components/admin-page.tsx";
import { ChangePasswordForm, ProfileForm } from "./profile-forms.tsx";

// The signed-in admin's own profile (changes-01, image-6): identity card,
// editable personal info, password change, account details. No permission
// key — this page only ever reads/writes the caller's own row; the layout's
// STAFF gate already ran.
export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/admin/sign-in");
  const [t, profile] = await Promise.all([
    getTranslations("admin"),
    loadOwnProfile(session.user.id),
  ]);
  if (!profile) redirect("/admin/sign-in");

  const initials = profile.name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <AdminPage title={t("profile")} description={t("profileSubtitle")}>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <AdminSection className="items-center text-center lg:w-72 lg:shrink-0">
          <Avatar className="size-20">
            {profile.image && <AvatarImage src={profile.image} alt="" />}
            <AvatarFallback className="text-xl">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold">{profile.name}</p>
            <p className="text-sm text-muted-foreground">{profile.email}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-1.5">
            {profile.roleNames.map((role) => (
              <Badge key={role} variant="secondary">
                {role}
              </Badge>
            ))}
          </div>
        </AdminSection>

        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <AdminSection title={t("personalInformation")}>
            <ProfileForm
              initial={{
                name: profile.name,
                firstName: profile.firstName ?? "",
                lastName: profile.lastName ?? "",
                phone: profile.phone ?? "",
              }}
              labels={{
                name: t("nameCol"),
                firstName: t("firstNameCol"),
                lastName: t("lastNameCol"),
                phone: t("phoneCol"),
                save: t("save"),
                saved: t("saved"),
              }}
            />
          </AdminSection>

          <AdminSection title={t("changePassword")}>
            <ChangePasswordForm
              labels={{
                currentPassword: t("currentPassword"),
                newPassword: t("newPassword"),
                confirmPassword: t("confirmPassword"),
                change: t("changePassword"),
                changed: t("passwordChanged"),
                mismatch: t("passwordMismatch"),
              }}
            />
          </AdminSection>

          <AdminSection title={t("accountInformation")}>
            <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
              <dt className="text-muted-foreground">{t("created")}</dt>
              <dd>{profile.createdAt.toISOString().slice(0, 10)}</dd>
              <dt className="text-muted-foreground">{t("lastLogin")}</dt>
              <dd>{profile.lastLoginAt?.toISOString().slice(0, 10) ?? "—"}</dd>
            </dl>
          </AdminSection>
        </div>
      </div>
    </AdminPage>
  );
}
