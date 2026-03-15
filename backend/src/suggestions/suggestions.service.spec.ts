import { SuggestionsService } from './suggestions.service';
import type { Suggestion } from './suggestions.types';

describe('SuggestionsService', () => {
  let service: SuggestionsService;

  beforeEach(() => {
    service = new SuggestionsService();
  });

  it.each(['LOW', 'MEDIUM', 'HIGH'] as const)(
    'returns suggestions for %s risk appetite',
    (risk) => {
      const results = service.getSuggestions(risk);
      expect(results.length).toBeGreaterThan(0);
    },
  );

  it.each(['LOW', 'MEDIUM', 'HIGH'] as const)(
    'all %s suggestions have the correct riskLevel',
    (risk) => {
      const results = service.getSuggestions(risk);
      results.forEach((s) => expect(s.riskLevel).toBe(risk));
    },
  );

  it.each(['LOW', 'MEDIUM', 'HIGH'] as const)(
    'all %s suggestions have the required shape',
    (risk) => {
      const results = service.getSuggestions(risk);
      results.forEach((s: Suggestion) => {
        expect(s).toHaveProperty('pair');
        expect(s).toHaveProperty('direction');
        expect(s).toHaveProperty('duration');
        expect(s).toHaveProperty('reason');
        expect(s).toHaveProperty('riskLevel');
        expect(['LONG', 'SHORT']).toContain(s.direction);
      });
    },
  );
});
