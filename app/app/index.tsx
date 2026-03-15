import { api, TradingPlan } from '@/lib/api';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl } from 'react-native';
import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import { Heading } from '@/components/ui/heading';
import { Button, ButtonText } from '@/components/ui/button';
import { Pressable } from '@/components/ui/pressable';

const RISK_COLOR: Record<string, string> = {
  low: 'text-success-600',
  medium: 'text-warning-600',
  high: 'text-error-600',
};

const STATUS_COLOR: Record<string, string> = {
  draft: 'text-typography-400',
  active: 'text-success-600',
  completed: 'text-typography-400',
};

function PlanCard({ plan }: { plan: TradingPlan }) {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.push(`/plans/${plan.id}`)}>
      <Box className="bg-background-0 rounded-2xl p-4 mb-3 border border-outline-100">
        <Box className="flex-row justify-between items-center mb-1">
          <Text className={`text-sm font-semibold uppercase ${RISK_COLOR[plan.risk_appetite]}`}>
            {plan.risk_appetite} risk
          </Text>
          <Text className={`text-xs ${STATUS_COLOR[plan.status]}`}>
            {plan.status}
          </Text>
        </Box>
        <Text className="text-typography-400 text-xs mt-1">
          {new Date(plan.created_at).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
          })}
        </Text>
      </Box>
    </Pressable>
  );
}

export default function Home() {
  const router = useRouter();
  const [plans, setPlans] = useState<TradingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPlans = useCallback(async () => {
    try {
      const data = await api.plans.list();
      setPlans(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  return (
    <Box className="flex-1 bg-background-50 px-4 pt-safe">
      <Box className="flex-row justify-between items-center py-5">
        <Heading size="2xl">Plans</Heading>
        <Button
          size="sm"
          className="rounded-full"
          onPress={() => router.push('/plans/new')}
        >
          <ButtonText>+ New Plan</ButtonText>
        </Button>
      </Box>

      {loading ? (
        <Box className="flex-1 justify-center items-center">
          <ActivityIndicator />
        </Box>
      ) : plans.length === 0 ? (
        <Box className="flex-1 justify-center items-center gap-3">
          <Text className="text-typography-400 text-center">
            No trading plans yet.{'\n'}Create one to get started.
          </Text>
          <Button onPress={() => router.push('/plans/new')}>
            <ButtonText>Create your first plan</ButtonText>
          </Button>
        </Box>
      ) : (
        <FlatList
          data={plans}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => <PlanCard plan={item} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchPlans(); }}
            />
          }
        />
      )}
    </Box>
  );
}
