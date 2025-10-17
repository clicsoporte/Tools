/**
 * @fileoverview A component for displaying a notification bell icon with a badge
 * and a dropdown list of recent notifications.
 */
"use client";

import { useAuth } from "@/modules/core/hooks/useAuth";
import { markNotificationAsRead, markAllNotificationsAsRead } from "@/modules/core/lib/notifications-actions";
import { markSuggestionAsRead } from "@/modules/core/lib/suggestions-actions";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, CheckCheck, MessageSquare } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { Notification } from "@/modules/core/types";

export function NotificationBell() {
    const { user, unreadNotificationsCount, notifications, fetchUnreadNotifications, unreadSuggestions, updateUnreadSuggestionsCount } = useAuth();
    const totalUnread = unreadNotificationsCount + unreadSuggestions.length;

    const combinedNotifications = [
        ...notifications,
        ...unreadSuggestions.map(s => ({
            id: `sugg-${s.id}`,
            userId: s.userId,
            message: `Nueva sugerencia de ${s.userName}`,
            href: '/dashboard/admin/suggestions',
            isRead: 0,
            timestamp: s.timestamp,
            isSuggestion: true,
            suggestionId: s.id,
        }) as Notification)
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());


    const handleMarkAsRead = async (notification: Notification) => {
        if (!user) return;

        if (notification.isSuggestion && notification.suggestionId) {
            await markSuggestionAsRead(notification.suggestionId);
            await updateUnreadSuggestionsCount();
        } else if (!notification.isSuggestion) {
            await markNotificationAsRead(notification.id as number, user.id);
        }
        // Fetch notifications after any read action to ensure consistency
        await fetchUnreadNotifications();
    };

    const handleMarkAllAsRead = async () => {
        if (!user || notifications.length === 0) return;
        const unreadSystemNotifIds = notifications.filter(n => !n.isRead).map(n => n.id as number);
        if(unreadSystemNotifIds.length > 0) {
            await markAllNotificationsAsRead(user.id);
        }
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
                        Tienes {totalUnread} {totalUnread === 1 ? 'notificación' : 'notificaciones'} sin leer.
                    </p>
                </div>
                <ScrollArea className="h-72">
                    <div className="p-2 space-y-1">
                        {combinedNotifications.length > 0 ? combinedNotifications.map(n => (
                             <Link key={n.id} href={n.href} passHref>
                                <div className="p-2 rounded-md hover:bg-muted cursor-pointer" onClick={() => handleMarkAsRead(n)}>
                                    <div className="flex items-start gap-2">
                                        {n.isSuggestion && <MessageSquare className="h-4 w-4 mt-0.5 text-green-600 flex-shrink-0" />}
                                        <p className={cn("text-sm", n.isRead === 0 && "font-bold")}>{n.message}</p>
                                    </div>
                                    <p className="text-xs text-muted-foreground ml-6">
                                        {formatDistanceToNow(new Date(n.timestamp), { addSuffix: true, locale: es })}
                                    </p>
                                </div>
                            </Link>
                        )) : (
                            <p className="text-center text-sm text-muted-foreground py-8">No hay notificaciones.</p>
                        )}
                    </div>
                </ScrollArea>
                {notifications.filter(n => !n.isRead).length > 0 && (
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
