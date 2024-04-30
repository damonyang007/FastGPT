import type { NextApiRequest, NextApiResponse } from 'next';
import { authApp } from '@fastgpt/service/support/permission/auth/app';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { sseErrRes, jsonRes } from '@fastgpt/service/common/response';
import { addLog } from '@fastgpt/service/common/system/log';
import { ChatRoleEnum, ChatSourceEnum } from '@fastgpt/global/core/chat/constants';
import { SseResponseEventEnum } from '@fastgpt/global/core/workflow/runtime/constants';
import { dispatchWorkFlow } from '@fastgpt/service/core/workflow/dispatch';
import type { ChatCompletionCreateParams } from '@fastgpt/global/core/ai/type.d';
import type { ChatCompletionMessageParam } from '@fastgpt/global/core/ai/type.d';
import {
  getDefaultEntryNodeIds,
  initWorkflowEdgeStatus,
  storeNodes2RuntimeNodes,
  textAdaptGptResponse
} from '@fastgpt/global/core/workflow/runtime/utils';
import { GPTMessages2Chats, chatValue2RuntimePrompt } from '@fastgpt/global/core/chat/adapt';
import { getChatItems } from '@fastgpt/service/core/chat/controller';
import { saveChat } from '@/service/utils/chat/saveChat';
import { responseWrite } from '@fastgpt/service/common/response';
import { pushChatUsage } from '@/service/support/wallet/usage/push';
import { authOutLinkChatStart } from '@/service/support/permission/auth/outLink';
import { pushResult2Remote, addOutLinkUsage } from '@fastgpt/service/support/outLink/tools';
import requestIp from 'request-ip';
import { getUsageSourceByAuthType } from '@fastgpt/global/support/wallet/usage/tools';
import { authTeamSpaceToken } from '@/service/support/permission/auth/team';
import { filterPublicNodeResponseData } from '@fastgpt/global/core/chat/utils';
import { updateApiKeyUsage } from '@fastgpt/service/support/openapi/tools';
import { connectToDatabase } from '@/service/mongo';
import { getUserChatInfoAndAuthTeamPoints } from '@/service/support/permission/auth/team';
import { AuthUserTypeEnum } from '@fastgpt/global/support/permission/constant';
import { MongoApp } from '@fastgpt/service/core/app/schema';
import { UserModelSchema } from '@fastgpt/global/support/user/type';
import { AppSchema } from '@fastgpt/global/core/app/type';
import { AuthOutLinkChatProps } from '@fastgpt/global/support/outLink/api';
import { MongoChat } from '@fastgpt/service/core/chat/chatSchema';
import { ChatErrEnum } from '@fastgpt/global/common/error/code/chat';
import { OutLinkChatAuthProps } from '@fastgpt/global/support/permission/chat';
import { UserChatItemType } from '@fastgpt/global/core/chat/type';
import { DispatchNodeResponseKeyEnum } from '@fastgpt/global/core/workflow/runtime/constants';
import { getAIApi } from '@fastgpt/service/core/ai/config';
import { uploadMongoImg } from '@fastgpt/service/common/file/image/controller';
import { setEntryEntries } from '@fastgpt/service/core/workflow/dispatchV1/utils';
type FastGptWebChatProps = {
  chatId?: string; // undefined: nonuse history, '': new chat, 'xxxxx': use history
  appId?: string;
};

export type Props = ChatCompletionCreateParams &
  FastGptWebChatProps &
  OutLinkChatAuthProps & {
    messages: ChatCompletionMessageParam[];
    stream?: boolean;
    detail?: boolean;
    variables: Record<string, any>;
  };
export type ChatResponseType = {
  newChatId: string;
  quoteLen?: number;
};

type AuthResponseType = {
  teamId: string;
  tmbId: string;
  user: UserModelSchema;
  app: AppSchema;
  responseDetail?: boolean;
  authType: `${AuthUserTypeEnum}`;
  apikey?: string;
  canWrite: boolean;
  outLinkUserId?: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const {
    chatId,
    appId,
    // share chat
    shareId,
    outLinkUid,
    // team chat
    teamId: spaceTeamId,
    teamToken,
    detail = false,
    messages = [],
    variables = {}
  } = req.body as Props;
  try {
    const originIp = requestIp.getClientIp(req);
    await connectToDatabase();
    // body data check
    if (!messages) {
      throw new Error('Prams Error');
    }
    if (!Array.isArray(messages)) {
      throw new Error('messages is not array');
    }
    if (messages.length === 0) {
      throw new Error('messages is empty');
    }

    const chatMessages = GPTMessages2Chats(messages);
    if (chatMessages[chatMessages.length - 1].obj !== ChatRoleEnum.Human) {
      chatMessages.pop();
    }

    // user question
    const question = chatMessages.pop() as UserChatItemType;
    if (!question) {
      throw new Error('Question is empty');
    }

    const { text, files } = chatValue2RuntimePrompt(question.value);

    const { teamId, tmbId, user, app, responseDetail, authType, apikey, canWrite, outLinkUserId } =
      await (async () => {
        // share chat
        if (shareId && outLinkUid) {
          return authShareChat({
            shareId,
            outLinkUid,
            chatId,
            ip: originIp,
            question: text
          });
        }
        // team space chat
        if (spaceTeamId && appId && teamToken) {
          return authTeamSpaceChat({
            teamId: spaceTeamId,
            teamToken,
            appId,
            chatId
          });
        }

        /* parse req: api or token */
        return authHeaderRequest({
          req,
          appId,
          chatId,
          detail
        });
      })();
    // get and concat history
    const { history } = await getChatItems({
      appId: app._id,
      chatId,
      limit: 30,
      field: `dataId obj value`
    });
    const concatHistories = history.concat(chatMessages);
    const responseChatItemId: string | undefined = messages[messages.length - 1].dataId;
    let chatModule = setEntryEntries(app.modules).filter(
      (item: any) => item.moduleId == 'chatModule'
    );
    const model = chatModule[0].inputs.filter((item: any) => item.key === 'model');
    let runningTime = Date.now();

    const ai = getAIApi();
    const result = await ai.images.generate({
      prompt: text,
      model: model[0].value,
      size: '1024x1024'
    });
    const imageUrl = result.data[0].url;
    const imageContent = result.data[0].revised_prompt;

    const imageResult = await uploadImagesByUrl(imageUrl as string, teamId);
    const imageContentUrl =
      getCurrentServerLocation() == '' ? imageUrl : `${getCurrentServerLocation()}${imageResult}`;
    // save chat
    let assistantResponses: any[] = [
      {
        type: 'text',
        text: {
          content: `![img](${imageContentUrl}) ${imageContent}`
        }
      }
    ];
    const source = (() => {
      if (shareId) {
        return ChatSourceEnum.share;
      }
      if (authType === 'apikey') {
        return ChatSourceEnum.api;
      }
      if (spaceTeamId) {
        return ChatSourceEnum.team;
      }
      return ChatSourceEnum.online;
    })();

    const time = Date.now();
    let flowResponses: any[] = [
      {
        moduleName: 'AI 对话',
        moduleType: 'chatNode',
        totalPoints: 0,
        model: model[0].value,
        tokens: 0,
        query: text,
        maxToken: 2000,
        historyPreview: [
          {
            obj: 'Human',
            value: text
          },
          {
            obj: 'AI',
            value: imageContent
          }
        ],
        contextTotalLen: 2,
        runningTime: (time - runningTime) / 1000
      }
    ];
    if (chatId) {
      const isOwnerUse = !shareId && !spaceTeamId && String(tmbId) === String(app.tmbId);
      await saveChat({
        chatId,
        appId: app._id,
        teamId,
        tmbId: tmbId,
        variables,
        isUpdateUseTime: isOwnerUse && source === ChatSourceEnum.online, // owner update use time
        shareId,
        outLinkUid: outLinkUserId,
        source,
        content: [
          question,
          {
            dataId: responseChatItemId,
            obj: ChatRoleEnum.AI,
            value: assistantResponses,
            [DispatchNodeResponseKeyEnum.nodeResponse]: flowResponses
          }
        ],
        metadata: {
          originIp
        }
      });
    }

    addLog.info(`generations running time: ${(Date.now() - runningTime) / 1000}s`);

    return jsonRes(res, {
      data: {
        result: {
          id: chatId || '',
          model: '',
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 1 },
          choices: [
            {
              delta: { role: 'assistant', content: `![img](${imageContentUrl}) ${imageContent}` },
              finish_reason: 'stop',
              index: 0
            }
          ]
        },
        responseData: flowResponses
      }
    });
  } catch (err) {
    jsonRes(res, {
      code: 500,
      error: err
    });
  }
}

const authShareChat = async ({
  chatId,
  ...data
}: AuthOutLinkChatProps & {
  shareId: string;
  chatId?: string;
}): Promise<AuthResponseType> => {
  const { teamId, tmbId, user, appId, authType, responseDetail, uid } =
    await authOutLinkChatStart(data);
  const app = await MongoApp.findById(appId).lean();

  if (!app) {
    return Promise.reject('app is empty');
  }

  // get chat
  const chat = await MongoChat.findOne({ appId, chatId }).lean();
  if (chat && (chat.shareId !== data.shareId || chat.outLinkUid !== uid)) {
    return Promise.reject(ChatErrEnum.unAuthChat);
  }

  return {
    teamId,
    tmbId,
    user,
    app,
    responseDetail,
    apikey: '',
    authType,
    canWrite: false,
    outLinkUserId: uid
  };
};
const authTeamSpaceChat = async ({
  appId,
  teamId,
  teamToken,
  chatId
}: {
  appId: string;
  teamId: string;
  teamToken: string;
  chatId?: string;
}): Promise<AuthResponseType> => {
  const { uid } = await authTeamSpaceToken({
    teamId,
    teamToken
  });

  const app = await MongoApp.findById(appId).lean();
  if (!app) {
    return Promise.reject('app is empty');
  }

  const [chat, { user }] = await Promise.all([
    MongoChat.findOne({ appId, chatId }).lean(),
    getUserChatInfoAndAuthTeamPoints(app.tmbId)
  ]);

  if (chat && (String(chat.teamId) !== teamId || chat.outLinkUid !== uid)) {
    return Promise.reject(ChatErrEnum.unAuthChat);
  }

  return {
    teamId,
    tmbId: app.tmbId,
    user,
    app,
    responseDetail: true,
    authType: AuthUserTypeEnum.outLink,
    apikey: '',
    canWrite: false,
    outLinkUserId: uid
  };
};
const authHeaderRequest = async ({
  req,
  appId,
  chatId,
  detail
}: {
  req: NextApiRequest;
  appId?: string;
  chatId?: string;
  detail?: boolean;
}): Promise<AuthResponseType> => {
  const {
    appId: apiKeyAppId,
    teamId,
    tmbId,
    authType,
    apikey,
    canWrite: apiKeyCanWrite
  } = await authCert({
    req,
    authToken: true,
    authApiKey: true
  });

  const { app, canWrite } = await (async () => {
    if (authType === AuthUserTypeEnum.apikey) {
      if (!apiKeyAppId) {
        return Promise.reject(
          'Key is error. You need to use the app key rather than the account key.'
        );
      }
      const app = await MongoApp.findById(apiKeyAppId);

      if (!app) {
        return Promise.reject('app is empty');
      }

      appId = String(app._id);

      return {
        app,
        canWrite: apiKeyCanWrite
      };
    } else {
      // token auth
      if (!appId) {
        return Promise.reject('appId is empty');
      }
      const { app, canWrite } = await authApp({
        req,
        authToken: true,
        appId,
        per: 'r'
      });

      return {
        app,

        canWrite: canWrite
      };
    }
  })();

  const [{ user }, chat] = await Promise.all([
    getUserChatInfoAndAuthTeamPoints(tmbId),
    MongoChat.findOne({ appId, chatId }).lean()
  ]);

  if (chat && (String(chat.teamId) !== teamId || String(chat.tmbId) !== tmbId)) {
    return Promise.reject(ChatErrEnum.unAuthChat);
  }

  return {
    teamId,
    tmbId,
    user,
    app,
    responseDetail: detail,
    apikey,
    authType,
    canWrite
  };
};

const uploadImagesByUrl = async (imgUrl: string, teamId: string) => {
  try {
    const response = await fetch(imgUrl);
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    var base64String = arrayBufferToBase64(arrayBuffer);
    return uploadMongoImg({
      teamId,
      type: 'chatImage',
      base64Img: 'data:image/jpeg;base64,' + base64String
    });
  } catch (error) {
    throw new Error('源数据错误，存储失败');
  }
};

function arrayBufferToBase64(buffer: ArrayBuffer) {
  var binary = '';
  var bytes = new Uint8Array(buffer);
  var len = bytes.byteLength;
  for (var i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  // 对二进制字符串进行base64编码
  return btoa(binary);
}

const getCurrentServerLocation = () => {
  const url = process.env.REDIRECT_URI ? process.env.REDIRECT_URI : '';
  return url != '' ? url.split('/login/auth')[0] : '';
};
