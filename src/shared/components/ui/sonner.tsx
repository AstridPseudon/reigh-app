import { Toast } from "@base-ui-components/react/toast"
import { toastManager, ToastItem, toast } from "./toast"

interface ToasterProps {
  /** Max toasts visible at once. @default 3 */
  limit?: number
  /** Default timeout in ms. @default 5000 */
  timeout?: number
}

function ToastList() {
  const { toasts } = Toast.useToastManager()

  return (
    <Toast.Viewport
      className="fixed bottom-0 right-0 z-[100002] flex max-h-screen w-full flex-col gap-2 p-4 md:max-w-[420px]"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </Toast.Viewport>
  )
}

const Toaster = ({ limit = 3, timeout = 5000 }: ToasterProps = {}) => {
  return (
    <Toast.Provider toastManager={toastManager} timeout={timeout} limit={limit}>
      <ToastList />
    </Toast.Provider>
  )
}

export { Toaster, toast }
