import * as React from "react"
import { useUserUIState } from "@/shared/hooks/useUserUIState"

export type AIInputMode = "voice" | "text"

interface AIInputModeContextValue {
  mode: AIInputMode
  setMode: (mode: AIInputMode) => void
  isLoading: boolean
}

const AIInputModeContext = React.createContext<AIInputModeContextValue | null>(null)

export function AIInputModeProvider({ children }: { children: React.ReactNode }) {
  const { value, update, isLoading } = useUserUIState('aiInputMode', { mode: 'voice' })

  const setMode = React.useCallback((mode: AIInputMode) => {
    update({ mode })
  }, [update])

  // Memoize context value to prevent unnecessary re-renders of consumers
  const contextValue = React.useMemo(() => ({
    mode: value.mode,
    setMode,
    isLoading
  }), [value.mode, setMode, isLoading])

  return (
    <AIInputModeContext.Provider value={contextValue}>
      {children}
    </AIInputModeContext.Provider>
  )
}

export function useAIInputMode() {
  const context = React.useContext(AIInputModeContext)
  if (!context) {
    throw new Error(
      'useAIInputMode must be used within an AIInputModeProvider. ' +
      'Make sure the component is rendered inside the AIInputModeProvider tree.'
    )
  }
  return context
}
