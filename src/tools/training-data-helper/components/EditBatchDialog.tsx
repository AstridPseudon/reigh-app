import React from 'react';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/primitives/label';
import { Textarea } from '@/shared/components/ui/textarea';

interface EditBatchDialogProps {
  isOpen: boolean;
  editName: string;
  editDescription: string;
  isUpdating: boolean;
  onOpenChange: (open: boolean) => void;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onUpdate: () => Promise<void>;
}

export function EditBatchDialog({
  isOpen,
  editName,
  editDescription,
  isUpdating,
  onOpenChange,
  onNameChange,
  onDescriptionChange,
  onUpdate,
}: EditBatchDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Batch</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="edit-batch-name">Batch Name</Label>
            <Input
              id="edit-batch-name"
              value={editName}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Enter batch name..."
            />
          </div>

          <div>
            <Label htmlFor="edit-batch-description">Description (optional)</Label>
            <Textarea
              id="edit-batch-description"
              value={editDescription}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder="Describe this batch..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button
              onClick={onUpdate}
              disabled={!editName.trim() || isUpdating}
            >
              {isUpdating ? 'Updating...' : 'Update Batch'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
