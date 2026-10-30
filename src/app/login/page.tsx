import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Building2Icon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSessionUser } from "@/server/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Giriş" };

export default async function LoginPage() {
  if (await getSessionUser()) redirect("/");

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="justify-items-center text-center">
          <div className="mb-1 flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Building2Icon className="size-6" />
          </div>
          <CardTitle className="text-xl">İnşaat Maliyet</CardTitle>
          <CardDescription>Devam etmek için giriş yapın</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
