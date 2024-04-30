import { SseResponseEventEnum } from '@fastgpt/global/core/workflow/runtime/constants';
import { getErrText } from '@fastgpt/global/common/error/utils';
import type { ChatHistoryItemResType } from '@fastgpt/global/core/chat/type.d';
import type { StartChatFnProps } from '@/components/ChatBox/type.d';
import { getToken } from '@/web/support/user/auth';
import { DispatchNodeResponseKeyEnum } from '@fastgpt/global/core/workflow/runtime/constants';
import dayjs from 'dayjs';

type ImageFetchProps = {
  url?: string;
  data: Record<string, any>;
  onMessage: StartChatFnProps['generatingMessage'];
  abortCtrl: AbortController;
};
type ImageResponseType = {
  responseText: string;
  [DispatchNodeResponseKeyEnum.nodeResponse]: ChatHistoryItemResType[];
};
class FatalError extends Error {}

export const ImageFetch = ({
  url = '/api/v1/images/generations',
  data,
  onMessage,
  abortCtrl
}: ImageFetchProps) =>
  new Promise<ImageResponseType>(async (resolve, reject) => {
    const timeoutId = setTimeout(() => {
      abortCtrl.abort('Time out');
    }, 60000);

    // response data
    let responseText = '';
    let responseQueue: (
      | { event: SseResponseEventEnum.fastAnswer | SseResponseEventEnum.answer; text: string }
      | {
          event:
            | SseResponseEventEnum.toolCall
            | SseResponseEventEnum.toolParams
            | SseResponseEventEnum.toolResponse;
          [key: string]: any;
        }
    )[] = [];
    let errMsg: string | undefined;
    let responseData: ChatHistoryItemResType[] = [];
    let finished = false;

    const finish = () => {
      if (errMsg !== undefined) {
        return failedFinish();
      }
      return resolve({
        responseText,
        responseData
      });
    };
    const failedFinish = (err?: any) => {
      finished = true;
      reject({
        message: getErrText(err, errMsg ?? '响应过程出现异常~'),
        responseText
      });
    };
    const isAnswerEvent = (event: `${SseResponseEventEnum}`) =>
      event === SseResponseEventEnum.answer || event === SseResponseEventEnum.fastAnswer;

    function animateResponseText() {
      if (abortCtrl.signal.aborted) {
        responseQueue.forEach((item) => {
          onMessage(item);
          if (isAnswerEvent(item.event)) {
            responseText = item.text;
          }
        });
        return finish();
      }
      if (responseQueue.length > 0) {
        const fetchCount = Math.max(1, Math.round(responseQueue.length / 30));
        for (let i = 0; i < fetchCount; i++) {
          const item = responseQueue[i];
          onMessage(item);
          if (isAnswerEvent(item.event)) {
            responseText += item.text;
          }
        }

        responseQueue = responseQueue.slice(fetchCount);
      }
      if (finished && responseQueue.length === 0) {
        return finish();
      }
      requestAnimationFrame(animateResponseText);
    }
    // start animation
    animateResponseText();

    try {
      const variables = data?.variables || {};
      variables.cTime = dayjs().format('YYYY-MM-DD HH:mm:ss');
      // send request
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          token: getToken()
        },
        signal: abortCtrl.signal,
        body: JSON.stringify({
          ...data,
          variables
        })
      })
        .then((res) => {
          if (res.status === 200) {
            return res.json();
          } else {
            failedFinish('请求错误，请稍后再试...');
          }
        })
        .then((body) => {
          if (body) {
            onMessage({
              event: SseResponseEventEnum.flowNodeStatus,
              status: 'running',
              name: 'AI 对话'
            });
            const text = body.data.result.choices?.[0]?.delta?.content || '';
            const event = SseResponseEventEnum.answer;
            responseQueue.push({
              event,
              text: text
            });
            responseData = body.data.responseData;
          }
          finished = true;
          return;
        });
    } catch (err: any) {
      clearTimeout(timeoutId);

      if (abortCtrl.signal.aborted) {
        finished = true;

        return;
      }
      console.log(err, 'fetch error');
      failedFinish(err);
    }
  });
