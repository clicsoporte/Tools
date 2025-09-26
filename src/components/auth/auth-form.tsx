/**
 * @fileoverview Client component for handling the authentication form,
 * including login and password recovery.
 */
"use client";

import { Button } from "../ui/button";
import {
  CardContent,
  CardFooter,
} from "../ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  DialogTrigger,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import React, { useState } from "react";
import type { User } from "@/modules/core/types";
import { useToast } from "@/modules/core/hooks/use-toast";
import { login, getAllUsers, saveAllUsers } from "@/modules/core/lib/auth-client";
import { logInfo, logWarn } from "@/modules/core/lib/logger";

interface AuthFormProps {
  clientInfo: {
    ip: string;
    host: string;
  };
}

/**
 * Renders the login form and handles the password recovery flow.
 * Receives clientInfo from a server component to use in logging.
 */
export function AuthForm({ clientInfo }: AuthFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  // State for password recovery flow
  const [isRecoveryDialogOpen, setRecoveryDialogOpen] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState(1); // 1: Email, 2: Question, 3: New Password
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [userForRecovery, setUserForRecovery] = useState<User | null>(null);
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    const loggedIn = await login(email, password);

    if (loggedIn) {
      router.refresh(); // Crucial for re-triggering layout/page logic
      router.push("/dashboard");
    } else {
      toast({
        title: "Credenciales Incorrectas",
        description: "El correo o la contraseña no son correctos. Inténtalo de nuevo o usa la opción de recuperación.",
        variant: "destructive",
      });
      setIsLoggingIn(false);
    }
  };

  const handleRecoveryStart = async () => {
    await logInfo(`Password recovery initiated for email: ${recoveryEmail}`, clientInfo);
    const allUsers: User[] = await getAllUsers();
    const user = allUsers.find(u => u.email === recoveryEmail);

    if (user && user.securityQuestion) {
        setUserForRecovery(user);
        setRecoveryStep(2);
    } else {
        toast({
            title: "Error de Recuperación",
            description: "El correo no fue encontrado o no tiene una pregunta de seguridad configurada.",
            variant: "destructive",
        })
        await logWarn(`Password recovery failed for email: ${recoveryEmail} (user not found or no security question)`, clientInfo);
    }
  }

  const handleRecoveryAnswer = async () => {
    if (userForRecovery && securityAnswer.toLowerCase() === userForRecovery.securityAnswer?.toLowerCase()) {
        await logInfo(`Password recovery security question passed for user: ${userForRecovery.name}`, clientInfo);
        setRecoveryStep(3);
    } else {
        toast({
            title: "Respuesta Incorrecta",
            description: "La respuesta no coincide. Por favor, inténtalo de nuevo.",
            variant: "destructive",
        });
        if(userForRecovery) {
          await logWarn(`Password recovery security question failed for user: ${userForRecovery.name}`, clientInfo);
        }
    }
  }

  const handleSetNewPassword = async () => {
    if (!userForRecovery) return;

    if (newPassword.length < 6) {
        toast({ title: "Contraseña Débil", description: "La nueva contraseña debe tener al menos 6 caracteres.", variant: "destructive"});
        return;
    }

    if (newPassword !== confirmNewPassword) {
        toast({ title: "Error", description: "Las contraseñas no coinciden.", variant: "destructive"});
        return;
    }
    
    // We fetch all users again to ensure we have the latest data before saving.
    const allUsers = await getAllUsers();
    const updatedUsers = allUsers.map(u => {
        if (u.id === userForRecovery.id) {
            // Important: We should only update the password field.
            return { ...u, password: newPassword };
        }
        return u;
    });

    await saveAllUsers(updatedUsers); 
    
    await logWarn(`Password for user ${userForRecovery.name} was reset via recovery process.`, clientInfo);
    toast({
        title: "Contraseña Actualizada",
        description: "Tu contraseña ha sido cambiada. Ya puedes iniciar sesión.",
    });

    resetRecovery();
    setRecoveryDialogOpen(false);
  }
  
  const resetRecovery = () => {
    setRecoveryEmail("");
    setSecurityAnswer("");
    setUserForRecovery(null);
    setNewPassword("");
    setConfirmNewPassword("");
    setRecoveryStep(1);
  }

  return (
    <form onSubmit={handleLogin}>
        <CardContent className="space-y-4">
        <div className="space-y-2">
            <Label htmlFor="email">Correo Electrónico</Label>
            <Input
            id="email"
            type="email"
            placeholder="usuario@ejemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            suppressHydrationWarning
            />
        </div>
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <Label htmlFor="password">Contraseña</Label>
                <Dialog open={isRecoveryDialogOpen} onOpenChange={(open) => { setRecoveryDialogOpen(open); if(!open) resetRecovery(); }}>
                    <DialogTrigger asChild>
                        <button type="button" className="text-sm font-medium text-primary hover:underline">
                            ¿Olvidaste tu contraseña?
                        </button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Recuperación de Acceso</DialogTitle>
                            <DialogDescription>
                                {recoveryStep === 1 && "Ingresa tu correo electrónico para encontrar tu pregunta de seguridad."}
                                {recoveryStep === 2 && "Responde tu pregunta de seguridad para continuar."}
                                {recoveryStep === 3 && "Crea tu nueva contraseña para recuperar el acceso."}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            {recoveryStep === 1 && (
                                <div className="space-y-2">
                                    <Label htmlFor="recovery-email">Correo Electrónico</Label>
                                    <Input 
                                        id="recovery-email"
                                        type="email"
                                        value={recoveryEmail}
                                        onChange={e => setRecoveryEmail(e.target.value)}
                                        placeholder="tu@correo.com"
                                    />
                                </div>
                            )}
                            {recoveryStep === 2 && userForRecovery && (
                                <div className="space-y-2">
                                    <p className="font-medium text-sm">{userForRecovery.securityQuestion}</p>
                                    <Label htmlFor="recovery-answer">Tu Respuesta</Label>
                                    <Input 
                                        id="recovery-answer"
                                        value={securityAnswer}
                                        onChange={e => setSecurityAnswer(e.target.value)}
                                        placeholder="Ingresa tu respuesta secreta"
                                    />
                                </div>
                            )}
                            {recoveryStep === 3 && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="new-password">Nueva Contraseña</Label>
                                        <Input 
                                            id="new-password"
                                            type="password"
                                            value={newPassword}
                                            onChange={e => setNewPassword(e.target.value)}
                                            placeholder="Introduce la nueva contraseña"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="confirm-new-password">Confirmar Nueva Contraseña</Label>
                                        <Input 
                                            id="confirm-new-password"
                                            type="password"
                                            value={confirmNewPassword}
                                            onChange={e => setConfirmNewPassword(e.target.value)}
                                            placeholder="Confirma la nueva contraseña"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                        <DialogFooter>
                            <DialogClose asChild>
                                <Button variant="ghost" type="button">Cancelar</Button>
                            </DialogClose>
                            {recoveryStep === 1 && <Button onClick={handleRecoveryStart} type="button">Buscar</Button>}
                            {recoveryStep === 2 && <Button onClick={handleRecoveryAnswer} type="button">Verificar</Button>}
                            {recoveryStep === 3 && <Button onClick={handleSetNewPassword} type="button">Guardar Contraseña</Button>}
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
            <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required suppressHydrationWarning />
        </div>
        </CardContent>
        <CardFooter>
        <Button type="submit" className="w-full" disabled={isLoggingIn}>
            {isLoggingIn && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Iniciar Sesión
        </Button>
        </CardFooter>
    </form>
  );
}
