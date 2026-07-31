import { FamilyMember } from '@core/models/family.model';
import {
  countCompletedSacraments,
  SacramentTypeLike
} from './sacrament-completion.util';

export interface ProfileCompletionResult {
  percent: number;
  missingFields: string[];
}

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  return String(value).trim().length > 0;
}

export function getMemberDisplayName(member: FamilyMember): string {
  const fullNameFields = [
    (member as { full_name_display?: string }).full_name_display,
    (member as { full_name?: string }).full_name,
    (member as { fullName?: string }).fullName
  ];
  for (const full of fullNameFields) {
    if (typeof full === 'string' && full.trim().length > 0) {
      return full.trim();
    }
  }
  const parts = [member.first_name, member.middle_name, member.last_name]
    .filter((p): p is string => !!p && String(p).trim().length > 0)
    .map((p) => p.trim());
  const name = parts.join(' ').replace(/\s+/g, ' ').trim();
  return name || '—';
}

export function computeMemberProfileCompletion(
  member: FamilyMember,
  sacramentTypes: SacramentTypeLike[] = []
): ProfileCompletionResult {
  const checks: { field: string; ok: boolean; weight: number }[] = [
    { field: 'First name', ok: hasValue(member.first_name), weight: 12 },
    { field: 'Last name', ok: hasValue(member.last_name), weight: 12 },
    { field: 'Date of birth', ok: hasValue(member.date_of_birth), weight: 14 },
    { field: 'Gender', ok: hasValue(member.gender), weight: 10 },
    { field: 'Relationship', ok: hasValue(member.relationship_to_head), weight: 12 },
    {
      field: 'Contact',
      ok: hasValue(member.phone) || hasValue(member.email),
      weight: 15
    },
    { field: 'Marital status', ok: hasValue(member.marital_status), weight: 5 }
  ];

  const baseWeight = checks.reduce((s, c) => s + c.weight, 0);
  const baseEarned = checks.reduce((s, c) => s + (c.ok ? c.weight : 0), 0);

  let sacramentWeight = 0;
  let sacramentScore = 0;
  if (sacramentTypes.length > 0) {
    sacramentWeight = 20;
    const completed = countCompletedSacraments(member, sacramentTypes);
    sacramentScore = (completed / sacramentTypes.length) * sacramentWeight;
    if (completed === 0) {
      checks.push({ field: 'Sacraments', ok: false, weight: sacramentWeight });
    }
  }

  const totalWeight = baseWeight + sacramentWeight;
  const earned = baseEarned + sacramentScore;
  const percent =
    totalWeight > 0 ? Math.min(100, Math.round((earned / totalWeight) * 100)) : 0;
  const missingFields = checks.filter((c) => !c.ok).map((c) => c.field);
  return { percent, missingFields };
}

export function memberHasMissingInfo(completion: ProfileCompletionResult): boolean {
  return completion.percent < 50 || completion.missingFields.length > 2;
}
