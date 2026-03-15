import { api, RiskAppetite } from '@/lib/api';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import { Heading } from '@/components/ui/heading';
import { Button, ButtonText } from '@/components/ui/button';
import { Pressable } from '@/components/ui/pressable';

type Option = {
  value: RiskAppetite;
  label: string;
  description: string;
  color: string;
  selectedBg: string;
};

const OPTIONS: Option[] = [
  {
    value: 'low',
    label: 'Low',
    description: 'Conservative trades, smaller positions, longer durations.',
    color: 'text-success-600',
    selectedBg: 'bg-success-50 border-success-400',
  },
  {
    value: 'medium',
    label: 'Medium',
    description: 'Balanced approach, moderate positions and durations.',
    color: 'text-warning-600',
    selectedBg: 'bg-warning-50 border-warning-400',
  },
  {
    value: 'high',
    label: 'High',
    description: 'Aggressive trades, larger positions, shorter durations.',
    color: 'text-error-600',
    selectedBg: 'bg-error-50 border-error-400',
  },
];

export default function NewPlan() {
  const router = useRouter();
  const [selected, setSelected] = useState<RiskAppetite | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const plan = await api.plans.create(selected);
      router.replace(`/plans/${plan.id}`);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  return (
    <Box className="flex-1 bg-background-50 px-4 pt-safe">
      <Box className="py-5">
        <Heading size="2xl">New Plan</Heading>
        <Text className="text-typography-500 mt-1">
          Choose your risk appetite. The agent will suggest trading pairs accordingly.
        </Text>
      </Box>

      <Box className="gap-3 mt-2">
        {OPTIONS.map((opt) => {
          const isSelected = selected === opt.value;
          return (
            <Pressable key={opt.value} onPress={() => setSelected(opt.value)}>
              <Box
                className={`rounded-2xl p-4 border-2 ${
                  isSelected ? opt.selectedBg : 'bg-background-0 border-outline-100'
                }`}
              >
                <Text className={`text-lg font-bold ${opt.color}`}>{opt.label}</Text>
                <Text className="text-typography-500 text-sm mt-1">{opt.description}</Text>
              </Box>
            </Pressable>
          );
        })}
      </Box>

      <Box className="mt-auto pb-8">
        <Button
          size="lg"
          className="rounded-full"
          isDisabled={!selected || loading}
          onPress={handleCreate}
        >
          <ButtonText>{loading ? 'Creating…' : 'Create Plan'}</ButtonText>
        </Button>
      </Box>
    </Box>
  );
}
