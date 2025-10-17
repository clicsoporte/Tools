/**
 * @fileoverview A component for displaying a notification bell icon with a badge
 * and a dropdown list of recent notifications.
 */
"use client";

import { useAuth } from "@/modules/core/hooks/useAuth";
import { markNotificationAsRead, markAllNotificationsAsRead } from "@/modules/core/lib/notifications-actions";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, CheckCheck } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

export function NotificationBell() {
    const { user, unreadNotificationsCount, notifications, fetchUnreadNotifications, unreadSuggestionsCount } = useAuth();
    const totalUnread = unreadNotificationsCount + unreadSuggestionsCount;

    const handleMarkAsRead = async (id: number) => {
        if (!user) return;
        await markNotificationAsRead(id, user.id);
        await fetchUnreadNotifications();
    };

    const handleMarkAllAsRead = async () => {
        if (!user) return;
        await markAllNotificationsAsRead(user.id);
        await fetchUnreadNotifications();
    };

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    <Bell className={cn("h-5 w-5", totalUnread > 0 && "animate-pulse fill-yellow-400 text-yellow-600")} />
                    {totalUnread > 0 && (
                        <div className="absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
                            {totalUnread}
                        </div>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0">
                <div className="p-4 border-b">
                    <h4 className="font-medium leading-none">Notificaciones</h4>
                    <p className="text-sm text-muted-foreground">
                        Tienes {totalUnread} notificaciones sin leer.
                    </p>
                </div>
                <ScrollArea className="h-72">
                    <div className="p-4 space-y-4">
                        {notifications.length > 0 ? notifications.map(n => (
                             <Link key={n.id} href={n.href} passHref>
                                <div className="p-2 rounded-md hover:bg-muted cursor-pointer" onClick={() => handleMarkAsRead(n.id)}>
                                    <p className={cn("text-sm font-medium", !n.isRead && "font-bold")}>{n.message}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {formatDistanceToNow(new Date(n.timestamp), { addSuffix: true, locale: es })}
                                    </p>
                                </div>
                            </Link>
                        )) : (
                            <p className="text-center text-sm text-muted-foreground py-8">No hay notificaciones.</p>
                        )}
                    </div>
                </ScrollArea>
                {notifications.length > 0 && (
                    <div className="p-2 border-t text-center">
                        <Button variant="link" size="sm" onClick={handleMarkAllAsRead}>
                            <CheckCheck className="mr-2 h-4 w-4" />
                            Marcar todas como leídas
                        </Button>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}
