import { useVoiceRecording } from "@/shared/hooks/useVoiceRecording";

type UseAgentVoiceOptions = {
  onTranscription: (text: string) => void;
  onError?: (error: string) => void;
};

export function useAgentVoice({ onTranscription, onError }: UseAgentVoiceOptions) {
  const {
    startRecording,
    stopRecording,
    toggleRecording,
    isRecording,
    isProcessing,
    audioLevel,
    remainingSeconds,
  } = useVoiceRecording({
    task: "transcribe_only",
    onError,
    onResult: ({ transcription }) => {
      onTranscription(transcription);
    },
  });

  return {
    startRecording,
    stopRecording,
    toggleRecording,
    isRecording,
    isProcessing,
    audioLevel,
    remainingSeconds,
  };
}
