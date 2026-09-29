import { DenominationType, SacramentEngineType } from '../models/certificate';

export interface DenominationSacramentCapability {
  denomination: DenominationType;
  sacrament: SacramentEngineType;
  supported: boolean;
  confirmationMode: 'CONFIRMATION' | 'CHRISMATION' | null;
  firstCommunionOptional: boolean;
}

const ALL_DENOMS: DenominationType[] = [
  'ROMAN_CATHOLIC',
  'EASTERN_RITE',
  'CSI',
  'ANGLICAN',
  'LUTHERAN',
  'NON_DENOM',
  'GENERIC',
];

function firstCommunionOptional(denomination: DenominationType): boolean {
  return denomination !== 'ROMAN_CATHOLIC' && denomination !== 'EASTERN_RITE';
}

function confirmationMode(
  denomination: DenominationType
): 'CONFIRMATION' | 'CHRISMATION' | null {
  if (denomination === 'EASTERN_RITE') {
    return 'CHRISMATION';
  }
  return 'CONFIRMATION';
}

export const DENOMINATION_SACRAMENT_CAPABILITIES: DenominationSacramentCapability[] =
  ALL_DENOMS.flatMap((denomination) => {
    const optional = firstCommunionOptional(denomination);
    const mode = confirmationMode(denomination);
    return [
      {
        denomination,
        sacrament: 'BAPTISM',
        supported: true,
        confirmationMode: null,
        firstCommunionOptional: optional,
      },
      {
        denomination,
        sacrament: 'CONFIRMATION',
        supported: denomination !== 'EASTERN_RITE',
        confirmationMode: denomination === 'EASTERN_RITE' ? null : 'CONFIRMATION',
        firstCommunionOptional: optional,
      },
      {
        denomination,
        sacrament: 'CHRISMATION',
        supported: denomination === 'EASTERN_RITE',
        confirmationMode: denomination === 'EASTERN_RITE' ? 'CHRISMATION' : null,
        firstCommunionOptional: optional,
      },
      {
        denomination,
        sacrament: 'FIRST_HOLY_COMMUNION',
        supported: true,
        confirmationMode: null,
        firstCommunionOptional: optional,
      },
      {
        denomination,
        sacrament: 'HOLY_MATRIMONY',
        supported: true,
        confirmationMode: null,
        firstCommunionOptional: optional,
      },
    ] satisfies DenominationSacramentCapability[];
  });

export function capabilityFor(
  denomination: DenominationType,
  sacrament: SacramentEngineType
): DenominationSacramentCapability | undefined {
  return DENOMINATION_SACRAMENT_CAPABILITIES.find(
    (row) => row.denomination === denomination && row.sacrament === sacrament
  );
}

export function isSacramentSupported(
  denomination: DenominationType,
  sacrament: SacramentEngineType
): boolean {
  return capabilityFor(denomination, sacrament)?.supported === true;
}

export function confirmationEngineType(
  denomination: DenominationType
): 'CONFIRMATION' | 'CHRISMATION' {
  return confirmationMode(denomination) === 'CHRISMATION' ? 'CHRISMATION' : 'CONFIRMATION';
}

export function mapDbSacramentToEngineType(
  dbCode: string,
  denomination: DenominationType
): SacramentEngineType {
  const code = (dbCode || '').toUpperCase().trim();
  if (code === 'BAPTISM') {
    return 'BAPTISM';
  }
  if (code === 'CONFIRMATION') {
    return confirmationEngineType(denomination);
  }
  if (code === 'EUCHARIST' || code === 'FIRST_COMMUNION' || code === 'FIRST_HOLY_COMMUNION') {
    return 'FIRST_HOLY_COMMUNION';
  }
  if (code === 'MATRIMONY' || code === 'MARRIAGE' || code === 'WEDDING' || code === 'HOLY_MATRIMONY') {
    return 'HOLY_MATRIMONY';
  }
  if (code === 'ANOINTING' || code === 'ANOINTING_SICK' || code === 'ANOINTINGOFTHESICK') {
    return 'ANOINTING_OF_THE_SICK';
  }
  if (code === 'HOLY_ORDERS' || code === 'HOLYORDERS' || code === 'ORDINATION') {
    return 'HOLY_ORDERS';
  }
  if (code === 'RECONCILIATION' || code === 'CONFESSION' || code === 'PENANCE') {
    return 'RECONCILIATION';
  }
  return 'GENERIC_REGISTRY';
}
