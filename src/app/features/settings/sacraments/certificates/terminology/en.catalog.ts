import { DenominationType, LiturgicalTerminology, SacramentEngineType } from '../models/certificate';

type TerminologyKey = `${DenominationType}:${SacramentEngineType}`;

const CATHOLIC_BAPTISM: LiturgicalTerminology = {
  sacramentTitle: 'Certificate of Baptism',
  subtitle: 'Sacramental Register',
  recipientLabel: 'Child’s full name',
  dateLabel: 'Date of Baptism',
  placeLabel: 'Place of Baptism',
  ministerLabel: 'Parish Priest',
  registrarLabel: 'Parish Registrar',
  sponsorsLabel: 'Godparents',
  fatherLabel: 'Father',
  motherLabel: 'Mother',
  brideLabel: 'Bride',
  groomLabel: 'Groom',
  witnessesLabel: 'Witnesses',
  sealLabel: 'Parish Seal',
  registryBookLabel: 'Book',
  registryPageLabel: 'Page',
  registryEntryLabel: 'Entry No.',
  certificateNumberLabel: 'Certificate number',
  issuedAtLabel: 'Date of Issuance',
  nameAsRecordedLabel: 'Name as recorded',
  baptismalStatusLabel: 'Baptismal status',
  parishResidenceLabel: 'Parish / residence',
  witness1Label: 'Witness 1',
  witness2Label: 'Witness 2',
  dateOfBirthLabel: 'Date of birth',
  placeOfBirthLabel: 'Place of birth',
  verifyHint: 'Scan to confirm this certificate',
  issuedNotice: 'Issued from the parish sacramental register',
};

const CATHOLIC_MATRIMONY: LiturgicalTerminology = {
  ...CATHOLIC_BAPTISM,
  sacramentTitle: 'Certificate of Holy Matrimony',
  recipientLabel: 'Spouse',
  dateLabel: 'Date of Marriage',
  placeLabel: 'Place of Marriage',
  ministerLabel: 'Celebrant',
  fatherLabel: "Father's Name",
  motherLabel: "Mother's Name",
  certificateNumberLabel: 'Certificate No.',
};

const CATHOLIC_CONFIRMATION: LiturgicalTerminology = {
  ...CATHOLIC_BAPTISM,
  sacramentTitle: 'Certificate of Confirmation',
  recipientLabel: 'Confirmand',
  dateLabel: 'Date of Confirmation',
  placeLabel: 'Place of Confirmation',
  sponsorsLabel: 'Sponsor',
  ministerLabel: 'Bishop / Minister',
};

const CATHOLIC_CHRISMATION: LiturgicalTerminology = {
  ...CATHOLIC_CONFIRMATION,
  sacramentTitle: 'Certificate of Chrismation',
  dateLabel: 'Date of Chrismation',
  placeLabel: 'Place of Chrismation',
  ministerLabel: 'Celebrant',
};

const CATHOLIC_COMMUNION: LiturgicalTerminology = {
  ...CATHOLIC_BAPTISM,
  sacramentTitle: 'Certificate of First Holy Communion',
  recipientLabel: 'Communicant',
  dateLabel: 'Date of First Holy Communion',
  placeLabel: 'Place of First Holy Communion',
};

const CSI_BAPTISM: LiturgicalTerminology = {
  ...CATHOLIC_BAPTISM,
  sacramentTitle: 'Certificate of Baptism',
  subtitle: 'Church of South India',
  ministerLabel: 'Presbyter',
  registrarLabel: 'Church Secretary',
  sponsorsLabel: 'Sponsors',
  sealLabel: 'Church Seal',
};

const CSI_MATRIMONY: LiturgicalTerminology = {
  ...CSI_BAPTISM,
  sacramentTitle: 'Certificate of Holy Matrimony',
  dateLabel: 'Date of Marriage',
  placeLabel: 'Place of Marriage',
  ministerLabel: 'Presbyter',
  brideLabel: 'Bride',
  groomLabel: 'Groom',
  motherLabel: "Mother's Name",
  fatherLabel: "Father's Name",
  certificateNumberLabel: 'Certificate No.',
};

const CSI_CONFIRMATION: LiturgicalTerminology = {
  ...CSI_BAPTISM,
  sacramentTitle: 'Certificate of Confirmation',
  recipientLabel: 'Confirmand',
  dateLabel: 'Date of Confirmation',
  placeLabel: 'Place of Confirmation',
  sponsorsLabel: 'Sponsors',
  ministerLabel: 'Bishop / Presbyter',
};

const CSI_COMMUNION: LiturgicalTerminology = {
  ...CSI_BAPTISM,
  sacramentTitle: 'Certificate of First Communion',
  recipientLabel: 'Communicant',
  dateLabel: 'Date of First Communion',
  placeLabel: 'Place of First Communion',
};

const ANGLICAN_BAPTISM: LiturgicalTerminology = {
  ...CSI_BAPTISM,
  subtitle: 'Anglican Communion',
  ministerLabel: 'Priest',
  registrarLabel: 'Parish Clerk',
};

const LUTHERAN_BAPTISM: LiturgicalTerminology = {
  ...CATHOLIC_BAPTISM,
  subtitle: 'Parish Register',
  ministerLabel: 'Pastor',
  registrarLabel: 'Parish Secretary',
  sponsorsLabel: 'Sponsors',
  sealLabel: 'Church Seal',
};

const GENERIC_BAPTISM: LiturgicalTerminology = {
  ...LUTHERAN_BAPTISM,
  subtitle: 'Church Register',
  ministerLabel: 'Minister',
};

const GENERIC_REGISTRY: LiturgicalTerminology = {
  ...GENERIC_BAPTISM,
  sacramentTitle: 'Sacramental Certificate',
  recipientLabel: 'Recipient',
  dateLabel: 'Date',
  placeLabel: 'Place',
};

const CATHOLIC_ANOINTING: LiturgicalTerminology = {
  ...CATHOLIC_BAPTISM,
  sacramentTitle: 'Certificate of Anointing of the Sick',
  recipientLabel: 'Recipient',
  dateLabel: 'Date of Anointing',
  placeLabel: 'Place of Anointing',
  ministerLabel: 'Ministering Priest',
};

const CATHOLIC_HOLY_ORDERS: LiturgicalTerminology = {
  ...CATHOLIC_BAPTISM,
  sacramentTitle: 'Certificate of Holy Orders',
  recipientLabel: 'Candidate',
  dateLabel: 'Date of Ordination',
  placeLabel: 'Place of Ordination',
  ministerLabel: 'Ordaining Bishop',
};

const CATHOLIC_RECONCILIATION: LiturgicalTerminology = {
  ...CATHOLIC_BAPTISM,
  sacramentTitle: 'Certificate of Reconciliation',
  recipientLabel: 'Penitent',
  dateLabel: 'Date',
  placeLabel: 'Place',
  ministerLabel: 'Confessor',
};

function fill(
  base: LiturgicalTerminology,
  overrides: Partial<LiturgicalTerminology>
): LiturgicalTerminology {
  return { ...base, ...overrides };
}

const CATALOG: Record<string, LiturgicalTerminology> = {
  'ROMAN_CATHOLIC:BAPTISM': CATHOLIC_BAPTISM,
  'ROMAN_CATHOLIC:HOLY_MATRIMONY': CATHOLIC_MATRIMONY,
  'ROMAN_CATHOLIC:CONFIRMATION': CATHOLIC_CONFIRMATION,
  'ROMAN_CATHOLIC:CHRISMATION': CATHOLIC_CHRISMATION,
  'ROMAN_CATHOLIC:FIRST_HOLY_COMMUNION': CATHOLIC_COMMUNION,
  'ROMAN_CATHOLIC:ANOINTING_OF_THE_SICK': CATHOLIC_ANOINTING,
  'ROMAN_CATHOLIC:HOLY_ORDERS': CATHOLIC_HOLY_ORDERS,
  'ROMAN_CATHOLIC:RECONCILIATION': CATHOLIC_RECONCILIATION,
  'ROMAN_CATHOLIC:GENERIC_REGISTRY': fill(GENERIC_REGISTRY, {
    ministerLabel: 'Parish Priest',
    sealLabel: 'Parish Seal',
  }),

  'EASTERN_RITE:BAPTISM': fill(CATHOLIC_BAPTISM, { ministerLabel: 'Celebrant' }),
  'EASTERN_RITE:HOLY_MATRIMONY': fill(CATHOLIC_MATRIMONY, { ministerLabel: 'Celebrant' }),
  'EASTERN_RITE:CONFIRMATION': CATHOLIC_CHRISMATION,
  'EASTERN_RITE:CHRISMATION': CATHOLIC_CHRISMATION,
  'EASTERN_RITE:FIRST_HOLY_COMMUNION': CATHOLIC_COMMUNION,
  'EASTERN_RITE:ANOINTING_OF_THE_SICK': fill(CATHOLIC_ANOINTING, { ministerLabel: 'Celebrant' }),
  'EASTERN_RITE:HOLY_ORDERS': fill(CATHOLIC_HOLY_ORDERS, { ministerLabel: 'Ordaining Bishop' }),
  'EASTERN_RITE:RECONCILIATION': fill(CATHOLIC_RECONCILIATION, { ministerLabel: 'Celebrant' }),
  'EASTERN_RITE:GENERIC_REGISTRY': fill(GENERIC_REGISTRY, { ministerLabel: 'Celebrant' }),

  'CSI:BAPTISM': CSI_BAPTISM,
  'CSI:HOLY_MATRIMONY': CSI_MATRIMONY,
  'CSI:CONFIRMATION': CSI_CONFIRMATION,
  'CSI:CHRISMATION': CSI_CONFIRMATION,
  'CSI:FIRST_HOLY_COMMUNION': CSI_COMMUNION,
  'CSI:ANOINTING_OF_THE_SICK': fill(CSI_BAPTISM, {
    sacramentTitle: 'Certificate of Anointing of the Sick',
    recipientLabel: 'Recipient',
    dateLabel: 'Date of Anointing',
    placeLabel: 'Place of Anointing',
    ministerLabel: 'Presbyter',
  }),
  'CSI:HOLY_ORDERS': fill(CSI_BAPTISM, {
    sacramentTitle: 'Certificate of Holy Orders',
    recipientLabel: 'Candidate',
    dateLabel: 'Date of Ordination',
    placeLabel: 'Place of Ordination',
    ministerLabel: 'Bishop / Presbyter',
  }),
  'CSI:RECONCILIATION': fill(CSI_BAPTISM, {
    sacramentTitle: 'Certificate of Reconciliation',
    recipientLabel: 'Penitent',
    dateLabel: 'Date',
    placeLabel: 'Place',
    ministerLabel: 'Presbyter',
  }),
  'CSI:GENERIC_REGISTRY': fill(GENERIC_REGISTRY, {
    subtitle: 'Church of South India',
    ministerLabel: 'Presbyter',
    sealLabel: 'Church Seal',
  }),

  'ANGLICAN:BAPTISM': ANGLICAN_BAPTISM,
  'ANGLICAN:HOLY_MATRIMONY': fill(CSI_MATRIMONY, {
    subtitle: 'Anglican Communion',
    ministerLabel: 'Priest',
  }),
  'ANGLICAN:CONFIRMATION': fill(CSI_CONFIRMATION, {
    subtitle: 'Anglican Communion',
    ministerLabel: 'Bishop / Priest',
  }),
  'ANGLICAN:CHRISMATION': fill(CSI_CONFIRMATION, { subtitle: 'Anglican Communion' }),
  'ANGLICAN:FIRST_HOLY_COMMUNION': fill(CSI_COMMUNION, { subtitle: 'Anglican Communion' }),
  'ANGLICAN:ANOINTING_OF_THE_SICK': fill(CATHOLIC_ANOINTING, {
    subtitle: 'Anglican Communion',
    ministerLabel: 'Priest',
  }),
  'ANGLICAN:HOLY_ORDERS': fill(CATHOLIC_HOLY_ORDERS, {
    subtitle: 'Anglican Communion',
    ministerLabel: 'Bishop',
  }),
  'ANGLICAN:RECONCILIATION': fill(CATHOLIC_RECONCILIATION, {
    subtitle: 'Anglican Communion',
    ministerLabel: 'Priest',
  }),
  'ANGLICAN:GENERIC_REGISTRY': fill(GENERIC_REGISTRY, {
    subtitle: 'Anglican Communion',
    ministerLabel: 'Priest',
  }),

  'LUTHERAN:BAPTISM': LUTHERAN_BAPTISM,
  'LUTHERAN:HOLY_MATRIMONY': fill(CATHOLIC_MATRIMONY, {
    ministerLabel: 'Pastor',
    sealLabel: 'Church Seal',
  }),
  'LUTHERAN:CONFIRMATION': fill(CATHOLIC_CONFIRMATION, { ministerLabel: 'Pastor' }),
  'LUTHERAN:CHRISMATION': fill(CATHOLIC_CONFIRMATION, { ministerLabel: 'Pastor' }),
  'LUTHERAN:FIRST_HOLY_COMMUNION': fill(CATHOLIC_COMMUNION, { ministerLabel: 'Pastor' }),
  'LUTHERAN:ANOINTING_OF_THE_SICK': fill(CATHOLIC_ANOINTING, { ministerLabel: 'Pastor' }),
  'LUTHERAN:HOLY_ORDERS': fill(CATHOLIC_HOLY_ORDERS, { ministerLabel: 'Bishop' }),
  'LUTHERAN:RECONCILIATION': fill(CATHOLIC_RECONCILIATION, { ministerLabel: 'Pastor' }),
  'LUTHERAN:GENERIC_REGISTRY': fill(GENERIC_REGISTRY, { ministerLabel: 'Pastor' }),

  'NON_DENOM:BAPTISM': GENERIC_BAPTISM,
  'NON_DENOM:HOLY_MATRIMONY': fill(CATHOLIC_MATRIMONY, {
    ministerLabel: 'Minister',
    brideLabel: 'Spouse',
    groomLabel: 'Spouse',
    sealLabel: 'Church Seal',
  }),
  'NON_DENOM:CONFIRMATION': fill(CATHOLIC_CONFIRMATION, { ministerLabel: 'Minister' }),
  'NON_DENOM:CHRISMATION': fill(CATHOLIC_CONFIRMATION, { ministerLabel: 'Minister' }),
  'NON_DENOM:FIRST_HOLY_COMMUNION': fill(CATHOLIC_COMMUNION, { ministerLabel: 'Minister' }),
  'NON_DENOM:ANOINTING_OF_THE_SICK': fill(CATHOLIC_ANOINTING, { ministerLabel: 'Minister' }),
  'NON_DENOM:HOLY_ORDERS': fill(CATHOLIC_HOLY_ORDERS, { ministerLabel: 'Minister' }),
  'NON_DENOM:RECONCILIATION': fill(CATHOLIC_RECONCILIATION, { ministerLabel: 'Minister' }),
  'NON_DENOM:GENERIC_REGISTRY': GENERIC_REGISTRY,

  'GENERIC:BAPTISM': GENERIC_BAPTISM,
  'GENERIC:HOLY_MATRIMONY': fill(CATHOLIC_MATRIMONY, { ministerLabel: 'Minister' }),
  'GENERIC:CONFIRMATION': fill(CATHOLIC_CONFIRMATION, { ministerLabel: 'Minister' }),
  'GENERIC:CHRISMATION': fill(CATHOLIC_CONFIRMATION, { ministerLabel: 'Minister' }),
  'GENERIC:FIRST_HOLY_COMMUNION': fill(CATHOLIC_COMMUNION, { ministerLabel: 'Minister' }),
  'GENERIC:ANOINTING_OF_THE_SICK': fill(CATHOLIC_ANOINTING, { ministerLabel: 'Minister' }),
  'GENERIC:HOLY_ORDERS': fill(CATHOLIC_HOLY_ORDERS, { ministerLabel: 'Minister' }),
  'GENERIC:RECONCILIATION': fill(CATHOLIC_RECONCILIATION, { ministerLabel: 'Minister' }),
  'GENERIC:GENERIC_REGISTRY': GENERIC_REGISTRY,
};

export function liturgicalTerminology(
  denomination: DenominationType,
  sacrament: SacramentEngineType
): LiturgicalTerminology {
  const key = `${denomination}:${sacrament}` as TerminologyKey;
  return CATALOG[key] ?? GENERIC_REGISTRY;
}
