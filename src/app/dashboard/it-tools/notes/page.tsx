/**
 * @fileoverview Main page for the IT Notes sub-module.
 */
'use client';

import React from 'react';
import { useItNotes } from '@/modules/it-tools/hooks/useItNotes';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { PlusCircle, Edit2, Trash2, Search, FilterX, Loader2, BookCopy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function ItNotesPage() {
    const { state, actions, selectors } = useItNotes();
    const { isLoading, isSubmitting, isFormOpen, searchTerm, moduleFilter, noteToEdit, noteToDelete } = state;

    if (isLoading) {
        return (
            <main className="flex-1 p-4 md:p-6 lg:p-8">
                <Card>
                    <CardHeader><Skeleton className="h-8 w-64" /><Skeleton className="h-5 w-96 mt-2" /></CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <Skeleton className="h-48 w-full" />
                        <Skeleton className="h-48 w-full" />
                        <Skeleton className="h-48 w-full" />
                    </CardContent>
                </Card>
            </main>
        );
    }
    
    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8">
            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <CardTitle>Notas Técnicas de TI</CardTitle>
                            <CardDescription>Base de conocimiento para procedimientos, guías y soluciones de TI.</CardDescription>
                        </div>
                        <Button onClick={() => actions.openForm()}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Nueva Nota
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col md:flex-row gap-4 mb-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Buscar por título o contenido..." value={searchTerm} onChange={(e) => actions.setSearchTerm(e.target.value)} className="pl-8" />
                        </div>
                        <Select value={moduleFilter} onValueChange={actions.setModuleFilter}>
                            <SelectTrigger className="w-full md:w-[240px]">
                                <SelectValue placeholder="Filtrar por módulo..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos los Módulos</SelectItem>
                                {selectors.moduleOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Button variant="ghost" onClick={actions.clearFilters}><FilterX className="mr-2 h-4 w-4" /> Limpiar</Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {selectors.filteredNotes.length > 0 ? selectors.filteredNotes.map(note => (
                            <Card key={note.id} className="flex flex-col">
                                <CardHeader>
                                    <CardTitle className="text-lg">{note.title}</CardTitle>
                                    {note.linkedModule && <Badge variant="secondary">{selectors.getModuleName(note.linkedModule)}</Badge>}
                                </CardHeader>
                                <CardContent className="flex-1">
                                    <p className="text-sm text-muted-foreground line-clamp-4">{note.content}</p>
                                </CardContent>
                                <CardFooter className="flex justify-between items-center text-xs text-muted-foreground">
                                    <span>{note.createdBy} - {format(parseISO(note.createdAt), 'dd/MM/yy')}</span>
                                    <div className="flex gap-1">
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => actions.openForm(note)}><Edit2 className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => actions.setNoteToDelete(note)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                    </div>
                                </CardFooter>
                            </Card>
                        )) : (
                            <div className="col-span-full text-center py-10 text-muted-foreground">
                                No se encontraron notas que coincidan con los filtros.
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Dialog open={isFormOpen} onOpenChange={actions.setIsFormOpen}>
                <DialogContent className="sm:max-w-[625px]">
                    <DialogHeader>
                        <DialogTitle>{noteToEdit ? 'Editar Nota' : 'Crear Nueva Nota'}</DialogTitle>
                        <DialogDescription>Completa los detalles de la nota técnica.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="title">Título</Label>
                            <Input id="title" value={state.currentTitle} onChange={(e) => actions.setCurrentTitle(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="content">Contenido</Label>
                            <Textarea id="content" value={state.currentContent} onChange={(e) => actions.setCurrentContent(e.target.value)} rows={8} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="linked-module">Módulo Vinculado (Opcional)</Label>
                            <Select value={state.currentLinkedModule || 'none'} onValueChange={actions.setCurrentLinkedModule}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Ninguno</SelectItem>
                                    {selectors.moduleOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
                        <Button onClick={actions.handleSave} disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            {noteToEdit ? 'Guardar Cambios' : 'Crear Nota'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

             <AlertDialog open={!!noteToDelete} onOpenChange={(open) => !open && actions.setNoteToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Confirmar eliminación?</AlertDialogTitle>
                        <AlertDialogDescription>Esta acción eliminará la nota permanentemente y no se puede deshacer.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={actions.handleDelete} disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </main>
    );
}
