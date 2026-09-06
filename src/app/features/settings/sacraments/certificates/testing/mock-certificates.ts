import {
  BaptismCertificateData,
  MatrimonyCertificateData,
} from '../models/certificate';

const catholicChurch = {
  name: 'St. Mary’s Cathedral Parish',
  diocese: 'Archdiocese of Verapoly',
  address: 'Cathedral Road, Kochi, Kerala',
  logoUrl: null,
  sealUrl: null,
  denominationCode: 'CATHOLIC',
  denominationType: 'ROMAN_CATHOLIC' as const,
  parishCode: 'st-marys-cathedral',
};

const csiChurch = {
  name: 'CSI St. Thomas Church',
  diocese: 'CSI Madhya Kerala Diocese',
  address: 'Baker Junction, Kottayam, Kerala',
  logoUrl: null,
  sealUrl: null,
  denominationCode: 'CSI',
  denominationType: 'CSI' as const,
  parishCode: 'csi-st-thomas',
};

const genericChurch = {
  name: 'Grace Community Church',
  diocese: null,
  address: '12 Oak Street, Parish Town',
  logoUrl: null,
  sealUrl: null,
  denominationCode: 'NON_DENOM',
  denominationType: 'NON_DENOM' as const,
  parishCode: 'grace-community',
};

export const MOCK_CATHOLIC_BAPTISM: BaptismCertificateData = {
  church: catholicChurch,
  sacramentType: 'BAPTISM',
  dateOfEvent: '2018-04-15',
  placeOfEvent: 'St. Mary’s Cathedral',
  registry: {
    bookNumber: 'B-12',
    pageNumber: '48',
    registryEntry: '112',
    certificateNumber: 'BAP-2018-0112',
  },
  locale: 'en',
  paper: 'A4',
  themeId: 'catholic',
  emblem: 'CHI_RHO',
  certificateTitle: 'Certificate of Baptism',
  subtitle: 'Sacramental Register',
  recipientName: 'Maria Teresa Joseph',
  dateOfBirth: '2018-03-01',
  placeOfBirth: 'Kochi',
  fatherName: 'Joseph Mathew',
  motherName: 'Anita Joseph',
  sponsors: ['Thomas Kurian', 'Elizabeth Kurian'],
  ministerName: 'Fr. Paul George',
  ministerTitle: 'Fr.',
};

export const MOCK_CSI_BAPTISM: BaptismCertificateData = {
  church: csiChurch,
  sacramentType: 'BAPTISM',
  dateOfEvent: '2019-06-09',
  placeOfEvent: 'CSI St. Thomas Church',
  registry: {
    bookNumber: '1',
    pageNumber: '22',
    certificateNumber: 'CSI-B-2019-022',
  },
  locale: 'en',
  paper: 'A4',
  themeId: 'csi',
  emblem: 'CROSS',
  certificateTitle: 'Certificate of Baptism',
  subtitle: 'Church of South India',
  recipientName: 'Arun Varghese',
  dateOfBirth: '2019-05-02',
  placeOfBirth: 'Kottayam',
  fatherName: 'Varghese Thomas',
  motherName: 'Latha Varghese',
  sponsors: ['Mathew John', 'Susan John'],
  ministerName: 'Rev. Philip Abraham',
  ministerTitle: 'Rev.',
};

export const MOCK_GENERIC_BAPTISM: BaptismCertificateData = {
  church: genericChurch,
  sacramentType: 'BAPTISM',
  dateOfEvent: '2021-01-10',
  placeOfEvent: 'Grace Community Church',
  registry: { certificateNumber: 'GEN-B-21-004' },
  locale: 'en',
  paper: 'A4',
  themeId: 'generic',
  emblem: 'CROSS',
  certificateTitle: 'Certificate of Baptism',
  subtitle: 'Church Register',
  recipientName: 'Hannah Grace Miller',
  fatherName: 'David Miller',
  motherName: 'Sarah Miller',
  sponsors: ['Rachel Clark'],
  ministerName: 'Pastor James Reed',
};

const sacredHeartChurch = {
  name: 'Sacred Heart Church',
  diocese: 'Diocese of Kuzhithurai',
  address: 'Kadayal, Kanniyakumari, Tamil Nadu',
  logoUrl: null,
  sealUrl: null,
  denominationCode: 'CATHOLIC',
  denominationType: 'ROMAN_CATHOLIC' as const,
  parishCode: 'sacred-heart-kadayal',
};

export const MOCK_CATHOLIC_MARRIAGE: MatrimonyCertificateData = {
  church: sacredHeartChurch,
  sacramentType: 'HOLY_MATRIMONY',
  dateOfEvent: '2024-12-28',
  placeOfEvent: 'Sacred Heart Church, Kadayal',
  registry: {
    bookNumber: 'M-4',
    pageNumber: '9',
    registryEntry: '42',
    certificateNumber: 'MAR-2024-009',
  },
  locale: 'en',
  paper: 'A4',
  themeId: 'catholic',
  emblem: 'CHI_RHO',
  certificateTitle: 'Certificate of Holy Matrimony',
  subtitle: 'Sacramental Register',
  issuedAt: '2025-01-06',
  brideName: 'Anna Maria D’Souza',
  groomName: 'Rohan Francis',
  groom: {
    fullName: 'Rohan Francis',
    baptismalStatusLabel: 'Baptized Catholic · Roman Catholic Church',
    fatherName: 'Joseph Francis',
    motherName: 'Mary Francis',
    parishResidence: 'Sacred Heart Church, Kadayal',
  },
  bride: {
    fullName: 'Anna Maria D’Souza',
    baptismalStatusLabel: 'Baptized Catholic · Roman Catholic Church',
    fatherName: 'Peter D’Souza',
    motherName: 'Lina D’Souza',
    parishResidence: 'Sacred Heart Church, Kadayal',
  },
  witnesses: ['Peter D’Souza', 'Lina Francis'],
  ministerName: 'Fr. Paul George',
  ministerTitle: 'Fr.',
};

export const MOCK_CSI_MARRIAGE: MatrimonyCertificateData = {
  church: csiChurch,
  sacramentType: 'HOLY_MATRIMONY',
  dateOfEvent: '2023-11-11',
  placeOfEvent: 'CSI St. Thomas Church',
  registry: { certificateNumber: 'CSI-M-2023-018' },
  locale: 'en',
  paper: 'A4',
  themeId: 'csi',
  emblem: 'CROSS',
  certificateTitle: 'Certificate of Holy Matrimony',
  subtitle: 'Church of South India',
  brideName: 'Meera Jacob',
  groomName: 'Samuel George',
  witnesses: ['Jacob Thomas', 'Ruth George'],
  ministerName: 'Rev. Philip Abraham',
  ministerTitle: 'Rev.',
};

export const MOCK_GENERIC_MARRIAGE: MatrimonyCertificateData = {
  church: genericChurch,
  sacramentType: 'HOLY_MATRIMONY',
  dateOfEvent: '2022-05-21',
  placeOfEvent: 'Grace Community Church',
  registry: { certificateNumber: 'GEN-M-22-007' },
  locale: 'en',
  paper: 'A4',
  themeId: 'generic',
  emblem: 'CROSS',
  certificateTitle: 'Certificate of Holy Matrimony',
  subtitle: 'Church Register',
  brideName: 'Emily Rose Carter',
  groomName: 'Daniel Lee Brooks',
  witnesses: ['Michael Carter', 'Olivia Brooks'],
  ministerName: 'Pastor James Reed',
};

export const MOCK_LONG_NAME_BAPTISM: BaptismCertificateData = {
  ...MOCK_CATHOLIC_BAPTISM,
  recipientName:
    'Maria Teresa Josephine Alexandra Cecilia of the Immaculate Heart of Mary Joseph-Mathew',
};

export const MOCK_CERTIFICATES = {
  catholicBaptism: MOCK_CATHOLIC_BAPTISM,
  csiBaptism: MOCK_CSI_BAPTISM,
  genericBaptism: MOCK_GENERIC_BAPTISM,
  catholicMarriage: MOCK_CATHOLIC_MARRIAGE,
  csiMarriage: MOCK_CSI_MARRIAGE,
  genericMarriage: MOCK_GENERIC_MARRIAGE,
  longNameBaptism: MOCK_LONG_NAME_BAPTISM,
};
