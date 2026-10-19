import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useWorkflow } from '@/lib/workflow-data';

// Deletes one of the current person's drafts after confirmation.
export function DeleteDraftButton({ lessonId, title, size = 'sm', onDeleted }: { lessonId: string; title: string; size?: 'sm' | 'default'; onDeleted?: () => void }) {
  const { deleteLesson } = useWorkflow();
  const confirmDelete = async () => {
    if (!(await deleteLesson(lessonId))) return;
    toast.success(`Deleted draft${title ? ` “${title}”` : ''}.`);
    onDeleted?.();
  };
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" size={size} variant="outline" className="text-red-700 hover:bg-red-50 hover:text-red-800"><Trash2 className="size-4" />Delete</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this draft?</AlertDialogTitle>
          <AlertDialogDescription>“{title || 'Untitled draft'}” will be removed. This can't be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep draft</AlertDialogCancel>
          <AlertDialogAction className="bg-red-700 text-white hover:bg-red-800" onClick={() => void confirmDelete()}>Delete draft</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
