const API_URL = 'http://localhost:8080';

export type RiskAppetite = 'low' | 'medium' | 'high';

export type TradingPlan = {
  id: string;
  risk_appetite: RiskAppetite;
  status: 'draft' | 'active' | 'completed';
  created_at: string;
};

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${await res.text()}`);
  }

  return res.json();
}

export const api = {
  plans: {
    list: () => request<TradingPlan[]>('/api/plans'),

    get: (id: string) => request<TradingPlan>(`/api/plans/${id}`),

    create: (riskAppetite: RiskAppetite) =>
      request<TradingPlan>('/api/plans', {
        method: 'POST',
        body: JSON.stringify({ risk_appetite: riskAppetite }),
      }),
  },
};
