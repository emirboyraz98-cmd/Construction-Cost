"use client";

import Link from "next/link";
import { useTransition } from "react";
import { KeyRoundIcon, LogOutIcon, UsersIcon } from "lucide-react";
import { logoutAction } from "@/app/(app)/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLE_LABELS } from "@/lib/auth/roles";
import type { ShellUser } from "./types";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("tr-TR"))
    .join("");
}

export function UserMenu({ user, canManageUsers }: { user: ShellUser; canManageUsers: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex shrink-0 items-center gap-2 rounded-md p-1 text-sm outline-none hover:bg-background/70 focus-visible:ring-[3px] focus-visible:ring-ring/50"
        aria-label="Kullanıcı menüsü"
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {initials(user.name)}
        </span>
        <span className="hidden max-w-40 truncate pr-1 lg:inline">{user.name}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>
          <p className="truncate">{user.name}</p>
          <p className="truncate text-xs font-normal text-muted-foreground">{user.email}</p>
          <p className="text-xs font-normal text-muted-foreground">{ROLE_LABELS[user.role]}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings/account">
            <KeyRoundIcon />
            Hesabım / şifre değiştir
          </Link>
        </DropdownMenuItem>
        {canManageUsers && (
          <DropdownMenuItem asChild>
            <Link href="/settings/users">
              <UsersIcon />
              Kullanıcılar
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={pending}
          onSelect={() => {
            // Paylaşılan telefonda önceki kullanıcının çevrimdışı sayfası kalmasın.
            navigator.serviceWorker?.controller?.postMessage("clear-pages");
            startTransition(() => logoutAction());
          }}
        >
          <LogOutIcon />
          Çıkış yap
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
