import { useEffect, type RefObject } from 'react'
import { useBlocker } from 'react-router-dom'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/Dialog'

export function UnsavedChanges({ dirty, allowLeave }: { dirty: boolean; allowLeave: RefObject<boolean> }) {
  const blocker = useBlocker(() => dirty && !allowLeave.current)
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => {
      if (allowLeave.current) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty, allowLeave])

  return (
    <Dialog open={blocker.state === 'blocked'} onOpenChange={(open) => { if (!open && blocker.state === 'blocked') blocker.reset() }}>
      <DialogContent>
        <DialogTitle>Leave without saving?</DialogTitle>
        <DialogDescription>Your profile changes will be lost.</DialogDescription>
        <div className="flex justify-end gap-4 text-[12px]">
          <button onClick={() => blocker.state === 'blocked' && blocker.reset()} className="border border-foreground px-3 py-2">Keep editing</button>
          <button onClick={() => blocker.state === 'blocked' && blocker.proceed()} className="underline underline-offset-2">Leave without saving</button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
