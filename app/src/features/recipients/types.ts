import type { AssistanceNeed, Relationship } from '@/constants/labels';
import type { Address } from '@/features/profile/types';

/** Pessoa que recebe o cuidado (cadastrada pelo cliente). */
export type CareRecipient = {
  id: string;
  fullName: string;
  relationship: Relationship;
  assistanceNeeds: AssistanceNeed[];
  address: Address;
  createdAt: string | null;
  updatedAt: string | null;
};

export type AddressInput = {
  street: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
};

export type CareRecipientInput = {
  fullName: string;
  relationship: Relationship;
  assistanceNeeds: AssistanceNeed[];
  address?: AddressInput;
};
