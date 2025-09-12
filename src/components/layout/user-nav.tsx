
"use client";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "../ui/avatar";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import type { User } from "../../modules/core/types";
import Link from "next/link";
import { LogOut, User as UserIcon } from "lucide-react";
import { useState, useEffect } from "react";
import { Skeleton } from "../ui/skeleton";
import { getCurrentUser, logout } from "../../modules/core/lib/auth-client";
import { useRouter } from "next/navigation";


interface UserNavProps {
    user?: User | null;
}

export function UserNav({ user: propUser }: UserNavProps) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(propUser || null);

  useEffect(() => {
    const updateUserState = async () => {
      if (propUser) {
          setCurrentUser(propUser);
      } else {
          const user = await getCurrentUser();
          setCurrentUser(user);
      }
    };
    updateUserState();
  }, [propUser]);

  const handleLogout = () => {
    logout();
    router.push('/');
  }

  const getInitials = (name: string) => {
    if (!name) return "";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("");
  };

  if (!currentUser) {
    return (
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-9 rounded-full" />
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-9 w-9 rounded-full">
          <Avatar className="h-9 w-9">
            <AvatarImage src={currentUser.avatar} alt={currentUser.name} />
            <AvatarFallback>{getInitials(currentUser.name)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{currentUser.name}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {currentUser.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/dashboard/settings">
              <UserIcon className="mr-2 h-4 w-4" />
              <span>Perfil</span>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        
          <DropdownMenuItem onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            <span>Cerrar Sesión</span>
          </DropdownMenuItem>
        
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
