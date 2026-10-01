import { MassCelebrationSummary } from '../services/mass-intentions-api.service';
import { formatMassDayTime } from './mass-celebration-display';

export interface MassDestinationSelectOption {
  id: string;
  celebrated_on: string;
  optionLabel: string;
}

export function toMassDestinationSelectOptions(
  masses: MassCelebrationSummary[]
): MassDestinationSelectOption[] {
  const sorted = [...masses].sort((a, b) => {
    const day = a.celebrated_on.localeCompare(b.celebrated_on);
    if (day !== 0) {
      return day;
    }
    return (a.celebrated_at ?? '').localeCompare(b.celebrated_at ?? '');
  });

  return sorted.map((mass) => {
    const when = formatMassDayTime(mass.celebrated_on, mass.celebrated_at ?? null);
    const place = mass.place?.trim();
    const optionLabel = place ? `${when} · ${place}` : when;

    return {
      id: String(mass.id),
      celebrated_on: mass.celebrated_on,
      optionLabel,
    };
  });
}
