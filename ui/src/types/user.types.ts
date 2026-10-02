export enum UserAccessType {
  ADMIN = 'admin',
  USER = 'user',
}
export type User = {
  fullName: string;
  email: string;
  accessType?: UserAccessType;
  id: string;
  isDeleted: boolean;
  emailStatus: string;
  countryOfOrigin: string;
  address: string;
  birthday: string;
  campus: string;
  lifestage: string;
  lifeGroup: string;
  isMember: boolean;
  isBaptised: boolean;
  ministryTeam: string;
  phoneNumber: number;
  hasFilledProfileForm: boolean;
};
