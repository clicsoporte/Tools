
/**
 * @fileoverview The main login page for the application.
 * It handles user authentication and provides a form for password recovery.
 */

"use client";

import { Button, buttonVariants } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  DialogTrigger,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useRouter } from "next/navigation";
import { Network } from "lucide-react";
import React, { useEffect, useState } from "react";
import type { User, Company } from "../modules/core/types";
import { useToast } from "../modules/core/hooks/use-toast";
import { Skeleton } from "../components/ui/skeleton";
import { login, getAllUsers, saveAllUsers } from "../modules/core/lib/auth-client";
import { getCompanyData } from "../modules/core/lib/company-client";

/**
 * Renders the login page.
 * It includes the main login form and a dialog-based password recovery flow.
 */
export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyData, setCompanyData] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // State for password recovery flow
  const [isRecoveryDialogOpen, setRecoveryDialogOpen] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState(1); // 1: Email, 2: Question, 3: New Password
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [userForRecovery, setUserForRecovery] = useState<User | null>(null);
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  useEffect(() => {
    const loadCompanyInfo = async () => {
        try {
            setIsLoading(true);
            const data = await getCompanyData();
            setCompanyData(data);
        } catch (error) {
            console.error("Failed to load company data:", error);
            // Show a generic name if company data fails to load
            setCompanyData({ name: "IntraTool Hub" } as Company);
        } finally {
            setIsLoading(false);
        }
    }
    loadCompanyInfo();
  }, []);

  /**
   * Handles the login form submission.
   */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const loggedIn = await login(email, password);

    if (loggedIn) {
      router.push("/dashboard");
    } else {
      toast({
        title: "Credenciales Incorrectas",
        description: "El correo o la contraseña no son correctos. Inténtalo de nuevo o usa la opción de recuperación.",
        variant: "destructive",
      });
    }
  };

  /**
   * Starts the password recovery process by finding the user by email.
   */
  const handleRecoveryStart = async () => {
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
    }
  }

  /**
   * Verifies the user's answer to the security question.
   */
  const handleRecoveryAnswer = () => {
    if (userForRecovery && securityAnswer.toLowerCase() === userForRecovery.securityAnswer?.toLowerCase()) {
        setRecoveryStep(3);
    } else {
        toast({
            title: "Respuesta Incorrecta",
            description: "La respuesta no coincide. Por favor, inténtalo de nuevo.",
            variant: "destructive",
        });
    }
  }

  /**
   * Sets the new password for the user after successful recovery.
   */
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
    
    const allUsers = await getAllUsers();
    const updatedUsers = allUsers.map(u => 
        u.id === userForRecovery.id ? { ...u, password: newPassword } : u
    );

    await saveAllUsers(updatedUsers); 
    
    toast({
        title: "Contraseña Actualizada",
        description: "Tu contraseña ha sido cambiada. Ya puedes iniciar sesión.",
    });

    resetRecovery();
    setRecoveryDialogOpen(false);
  }
  
  /**
   * Resets the state of the password recovery dialog.
   */
  const resetRecovery = () => {
    setRecoveryEmail("");
    setSecurityAnswer("");
    setUserForRecovery(null);
    setNewPassword("");
    setConfirmNewPassword("");
    setRecoveryStep(1);
  }

  // Show a skeleton loader while company data is being fetched.
  if (isLoading || !companyData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm shadow-2xl">
           <CardHeader className="text-center">
             <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Network className="h-8 w-8" />
             </div>
             <Skeleton className="h-8 w-48 mx-auto" />
             <Skeleton className="h-6 w-64 mx-auto mt-2" />
           </CardHeader>
           <CardContent className="space-y-4">
             <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
             </div>
             <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
             </div>
           </CardContent>
           <CardFooter>
             <Skeleton className="h-10 w-full" />
           </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm shadow-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Network className="h-8 w-8" />
          </div>
          <CardTitle className="text-3xl font-bold">{companyData.systemName || "IntraTool Hub"}</CardTitle>
          <CardDescription>
            Inicia sesión para acceder a tus herramientas
          </CardDescription>
        </CardHeader>
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
                <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full">
              Iniciar Sesión
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
