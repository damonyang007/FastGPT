import { AppDetailType } from '@fastgpt/global/core/app/type.d';
import type { OutLinkEditType } from '@fastgpt/global/support/outLink/type.d';
import { ModelType, AppSortType } from '@fastgpt/global/support/permission/constant';

export const defaultApp: AppDetailType = {
  _id: '',
  name: '应用加载中',
  type: 'simple',
  avatar: '/icon/logo.svg',
  intro: '',
  updateTime: Date.now(),
  modules: [],
  teamId: '',
  tmbId: '',
  permission: 'private',
  isOwner: false,
  canWrite: false,
  teamTags: [''],
  isShow: ModelType.MINE,
  appType: AppSortType.PERSON,
  edges: [],
  version: 'v2'
};

export const defaultOutLinkForm: OutLinkEditType = {
  name: '',
  responseDetail: false,
  limit: {
    QPM: 100,
    maxUsagePoints: -1
  }
};

export enum TTSTypeEnum {
  none = 'none',
  web = 'web',
  model = 'model'
}
