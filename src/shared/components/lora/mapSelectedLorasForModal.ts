import type { LoraModel } from '@/domains/lora/types/lora';

interface SelectedLoraInput {
  id: string;
  name: string;
  strength: number;
}

export function mapSelectedLorasForModal(
  selectedLoras: SelectedLoraInput[],
  availableLoras: LoraModel[],
): Array<LoraModel & { strength: number }> {
  return selectedLoras.map((selectedLora) => {
    const fullLora = availableLoras.find(
      (availableLora) => availableLora['Model ID'] === selectedLora.id,
    );

    return {
      ...fullLora,
      'Model ID': selectedLora.id,
      Name: selectedLora.name,
      strength: selectedLora.strength,
    } as LoraModel & { strength: number };
  });
}
