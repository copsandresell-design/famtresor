import { Button } from './Button'
import { Modal } from './Modal'

interface Props {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmModal({ open, title, message, confirmLabel = 'Confirmer', danger, onConfirm, onClose }: Props) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="mb-5 text-sm text-slate-600 dark:text-slate-300">{message}</p>
      <div className="flex justify-end gap-2">
        <Button variant="soft" onClick={onClose}>
          Annuler
        </Button>
        <Button
          variant={danger ? 'danger' : 'primary'}
          onClick={() => {
            onConfirm()
            onClose()
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
