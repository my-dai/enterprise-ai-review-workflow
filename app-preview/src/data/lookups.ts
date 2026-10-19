import type { IOperationResult } from '@microsoft/power-apps/data';

import { LL_AuthorsService } from '@/generated/services/LL_AuthorsService';
import { LL_CompaniesService } from '@/generated/services/LL_CompaniesService';
import { LL_CSIDivisionsService } from '@/generated/services/LL_CSIDivisionsService';
import { LL_CustomersService } from '@/generated/services/LL_CustomersService';
import { LL_DeliverySystemsService } from '@/generated/services/LL_DeliverySystemsService';
import { LL_DisciplinesService } from '@/generated/services/LL_DisciplinesService';
import { LL_Level1ManagersService } from '@/generated/services/LL_Level1ManagersService';
import { LL_QualityManagersService } from '@/generated/services/LL_QualityManagersService';
import { LL_SMEsService } from '@/generated/services/LL_SMEsService';
import { LL_TopicsService } from '@/generated/services/LL_TopicsService';

type LookupSource = {
  list: string;
  load: () => Promise<IOperationResult<{ Title?: string }[]>>;
};

// Each dropdown reads the Title column of a configured SharePoint list.
export const lookupSources = {
  topic: { list: 'LL_Topics', load: () => LL_TopicsService.getAll() },
  customer: { list: 'LL_Customers', load: () => LL_CustomersService.getAll() },
  discipline: { list: 'LL_Disciplines', load: () => LL_DisciplinesService.getAll() },
  csiDivision: { list: 'LL_CSIDivisions', load: () => LL_CSIDivisionsService.getAll() },
  company: { list: 'LL_Companies', load: () => LL_CompaniesService.getAll() },
  deliverySystem: { list: 'LL_DeliverySystems', load: () => LL_DeliverySystemsService.getAll() },
  author: { list: 'LL_Authors', load: () => LL_AuthorsService.getAll() },
  level1Manager: { list: 'LL_Level1Managers', load: () => LL_Level1ManagersService.getAll() },
  sme: { list: 'LL_SMEs', load: () => LL_SMEsService.getAll() },
  qualityManager: { list: 'LL_QualityManagers', load: () => LL_QualityManagersService.getAll() },
} satisfies Record<string, LookupSource>;

export type LookupKey = keyof typeof lookupSources;

type PeopleSource = {
  list: string;
  load: () => Promise<IOperationResult<{ Title?: string; Person?: { DisplayName?: string; Email?: string } }[]>>;
};

// People for each role come from the Person column of their list; Title is the fallback display name.
export const peopleSources = {
  author: lookupSources.author,
  level1Manager: lookupSources.level1Manager,
  sme: lookupSources.sme,
  qualityManager: lookupSources.qualityManager,
} satisfies Record<string, PeopleSource>;

export type PeopleKey = keyof typeof peopleSources;
