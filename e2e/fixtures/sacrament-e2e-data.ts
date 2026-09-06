export interface SacramentE2eMemberFixture {
  key: string;
  searchName: string;
  firstName: string;
  lastName: string;
  dob: string;
  dobDisplay: string;
  gender: 'male' | 'female';
  genderDisplay: string;
  father: string | null;
  mother: string | null;
  fatherDisplay: string;
  motherDisplay: string;
  memberId: string;
  personId: string;
  familyId: string;
}

const emptyParent = '—';

export const SACRAMENT_E2E_FAMILY = {
  bothParents: {
    id: 'e2e00001-0001-4000-8000-000000000001',
    name: 'E2E BothParents Family',
    code: 'E2E-BOTH',
    label: 'E2E BothParents Family (E2E-BOTH)',
  },
} as const;

export const SACRAMENT_E2E_MEMBERS: Record<string, SacramentE2eMemberFixture> = {
  bothParents: {
    key: 'bothParents',
    searchName: 'E2E Olivia BothParents',
    firstName: 'E2E Olivia',
    lastName: 'BothParents',
    dob: '2003-09-27',
    dobDisplay: '27 Sep 2003',
    gender: 'female',
    genderDisplay: 'Female',
    father: 'John E2E Anderson',
    mother: 'Mary E2E Anderson',
    fatherDisplay: 'John E2E Anderson',
    motherDisplay: 'Mary E2E Anderson',
    memberId: 'e2e00003-0001-4000-8000-000000000013',
    personId: 'e2e00002-0001-4000-8000-000000000013',
    familyId: SACRAMENT_E2E_FAMILY.bothParents.id,
  },
  memberA: {
    key: 'memberA',
    searchName: 'E2E Member Alpha',
    firstName: 'E2E Member',
    lastName: 'Alpha',
    dob: '1995-03-14',
    dobDisplay: '14 Mar 1995',
    gender: 'male',
    genderDisplay: 'Male',
    father: 'Alpha Father',
    mother: 'Alpha Mother',
    fatherDisplay: 'Alpha Father',
    motherDisplay: 'Alpha Mother',
    memberId: 'e2e00003-0001-4000-8000-0000000020',
    personId: 'e2e00002-0001-4000-8000-0000000020',
    familyId: 'e2e00001-0001-4000-8000-000000000002',
  },
  memberB: {
    key: 'memberB',
    searchName: 'E2E Member Beta',
    firstName: 'E2E Member',
    lastName: 'Beta',
    dob: '1998-11-02',
    dobDisplay: '2 Nov 1998',
    gender: 'female',
    genderDisplay: 'Female',
    father: 'Beta Father',
    mother: 'Beta Mother',
    fatherDisplay: 'Beta Father',
    motherDisplay: 'Beta Mother',
    memberId: 'e2e00003-0001-4000-8000-0000000021',
    personId: 'e2e00002-0001-4000-8000-0000000021',
    familyId: 'e2e00001-0001-4000-8000-000000000003',
  },
  fatherOnly: {
    key: 'fatherOnly',
    searchName: 'E2E James FatherOnly',
    firstName: 'E2E James',
    lastName: 'FatherOnly',
    dob: '2001-06-01',
    dobDisplay: '1 Jun 2001',
    gender: 'male',
    genderDisplay: 'Male',
    father: 'James E2E Sr',
    mother: null,
    fatherDisplay: 'James E2E Sr',
    motherDisplay: emptyParent,
    memberId: 'e2e00003-0001-4000-8000-0000000022',
    personId: 'e2e00002-0001-4000-8000-0000000022',
    familyId: 'e2e00001-0001-4000-8000-000000000004',
  },
  motherOnly: {
    key: 'motherOnly',
    searchName: 'E2E Sarah MotherOnly',
    firstName: 'E2E Sarah',
    lastName: 'MotherOnly',
    dob: '2002-07-02',
    dobDisplay: '2 Jul 2002',
    gender: 'female',
    genderDisplay: 'Female',
    father: null,
    mother: 'Sarah E2E Sr',
    fatherDisplay: emptyParent,
    motherDisplay: 'Sarah E2E Sr',
    memberId: 'e2e00003-0001-4000-8000-0000000023',
    personId: 'e2e00002-0001-4000-8000-0000000023',
    familyId: 'e2e00001-0001-4000-8000-000000000005',
  },
  noParents: {
    key: 'noParents',
    searchName: 'E2E Alex NoParents',
    firstName: 'E2E Alex',
    lastName: 'NoParents',
    dob: '2004-08-03',
    dobDisplay: '3 Aug 2004',
    gender: 'male',
    genderDisplay: 'Male',
    father: null,
    mother: null,
    fatherDisplay: emptyParent,
    motherDisplay: emptyParent,
    memberId: 'e2e00003-0001-4000-8000-0000000024',
    personId: 'e2e00002-0001-4000-8000-0000000024',
    familyId: 'e2e00001-0001-4000-8000-000000000006',
  },
};

export const SACRAMENT_E2E_ENTRY_URL = '/sacraments/register?create=1';

export const SACRAMENT_E2E_BAPTISM = {
  placeAdministered: 'E2E St. Test Parish',
  birthPlace: 'E2E Test City',
  ministerName: 'Rev. E2E Test Minister',
  notesMarker: 'sacrament-e2e-baptism',
} as const;
