import React, { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/primitives/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { normalizeAndPresentError } from '@/shared/lib/errorHandling/runtimeError';

interface CreateBatchDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateBatch: (name: string, description?: string) => Promise<string>;
  trigger?: React.ReactNode;
}

export function CreateBatchDialog({ isOpen, onOpenChange, onCreateBatch, trigger }: CreateBatchDialogProps) {
  const [newBatchName, setNewBatchName] = useState('');
  const [newBatchDescription, setNewBatchDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateBatch = async () => {
    if (!newBatchName.trim()) return;

    setIsCreating(true);
    try {
      await onCreateBatch(newBatchName.trim(), newBatchDescription.trim() || undefined);
      setNewBatchName('');
      setNewBatchDescription('');
      onOpenChange(false);
    } catch (error) {
      normalizeAndPresentError(error, { context: 'BatchSelector', showToast: false });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Batch</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="batch-name">Batch Name</Label>
            <Input
              id="batch-name"
              value={newBatchName}
              onChange={(e) => setNewBatchName(e.target.value)}
              placeholder="Enter batch name..."
            />
          </div>
          <div>
            <Label htmlFor="batch-description">Description (optional)</Label>
            <Textarea
              id="batch-description"
              value={newBatchDescription}
              onChange={(e) => setNewBatchDescription(e.target.value)}
              placeholder="Describe this batch..."
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateBatch}
              disabled={!newBatchName.trim() || isCreating}
            >
              {isCreating ? 'Creating...' : 'Create Batch'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
