import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box,
  Grid,
  Flex,
  IconButton,
  useDisclosure,
  Drawer,
  DrawerBody,
  DrawerHeader,
  DrawerOverlay,
  DrawerContent
} from '@chakra-ui/react';
import { useRouter } from 'next/router';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@fastgpt/web/hooks/useToast';
import { serviceSideProps } from '@/web/common/utils/i18n';
import { useTranslation } from 'next-i18next';
import MyIcon from '@fastgpt/web/components/common/Icon';
import Avatar from '@/components/Avatar';
import MyTooltip from '@/components/MyTooltip';
import { useAppStore } from '@/web/core/app/store/useAppStore';
import { useUserStore } from '@/web/support/user/useUserStore';
import { useSystemStore } from '@/web/common/system/useSystemStore';
import { AppListItemType } from '@fastgpt/global/core/app/type.d';
import ChatBox from '@/components/ChatBox';
import type { ComponentRef, StartChatFnProps } from '@/components/ChatBox/type.d';
import { getGuideModule } from '@fastgpt/global/core/workflow/utils';
import { ModuleItemType } from '@fastgpt/global/core/module/type';
import { streamFetch } from '@/web/common/api/fetch';
import { checkChatSupportSelectFileByModules } from '@/web/core/chat/utils';
import { ModelType } from '@fastgpt/global/support/permission/constant';
import { getInitChatInfo } from '@/web/core/chat/api';
import { ImageFetch } from '@/web/common/api/imageFetch';

const ModelList = () => {
  const { toast } = useToast();
  const { t } = useTranslation();
  const router = useRouter();
  const { isPc } = useSystemStore();
  const { myApps, loadMyApps } = useAppStore();
  const [appCard, setAppCard] = useState<AppListItemType>();
  const ChatBoxRef = useRef<ComponentRef>(null);
  const { userInfo } = useUserStore();
  const { appDetail, loadAppDetail, clearAppModules } = useAppStore();

  /* 加载模型 */
  const { isFetching } = useQuery(['loadApps'], () => loadMyApps(true), {
    refetchOnMount: true
  });
  const { isOpen: isOpenSlider, onClose: onCloseSlider, onOpen: onOpenSlider } = useDisclosure();
  const [modules, setModules] = useState<ModuleItemType[]>([]);

  const startChat = useCallback(
    async ({ chatList, controller, generatingMessage, variables, messages }: StartChatFnProps) => {
      let historyMaxLen = 0;
      const prompts = messages.slice(-2);
      const res = await getInitChatInfo({});
      let data: any = {
        data: {
          messages: prompts,
          variables
        },
        onMessage: generatingMessage,
        abortSignal: controller
      };
      const history = chatList.slice(-historyMaxLen - 2, -2);

      // 流请求，获取数据
      const { responseText, responseData } =
        res.app.chatModels?.length == 1 && res.app.chatModels.includes('dall-e-3')
          ? await ImageFetch(data)
          : await streamFetch({
              url: '/api/core/chat/chatTest',
              data: {
                history,
                prompt: chatList[chatList.length - 2].value,
                modules,
                variables,
                appName: `调试-${appDetail.name}`
              },
              onMessage: generatingMessage,
              abortCtrl: controller
            });

      return { responseText, responseData };
    },
    [modules, appCard?._id, appDetail.name]
  );

  const resetChatBox = useCallback(() => {
    ChatBoxRef.current?.resetHistory([]);
    ChatBoxRef.current?.resetVariables();
  }, []);

  const getAppDetail = (id: string) => {
    loadAppDetail(id, true);
  };

  useEffect(() => {
    resetChatBox();
    setModules(appDetail.modules);
  }, [appDetail, resetChatBox]);

  return (
    <Flex flexDirection={'column'} h={'100%'} pt={[1, 5]} position={'relative'}>
      <Box display={['block', 'flex']} py={[0, 3]} px={5} alignItems={'center'}>
        <Box flex={1}>
          {isPc && (
            <>
              <Flex alignItems={'flex-end'}>
                <Box fontSize={['md', 'xl']} fontWeight={'bold'}>
                  {t('model.Model Library')}
                </Box>
              </Flex>
              <Box fontSize={'sm'} color={'myGray.600'}>
                {'浏览和测试全部模型服务，直观体验不同模型能力。'}
              </Box>
            </>
          )}
        </Box>
      </Box>
      <Grid
        py={[0, 3]}
        px={[5, '20px']}
        gridTemplateColumns={['1fr', 'repeat(2,1fr)', 'repeat(3,1fr)', 'repeat(4,1fr)']}
        gridGap={5}
      >
        {myApps
          .filter((app) => app.isShow === ModelType.MODEL_BASE)
          .map((app) => (
            <MyTooltip key={app._id}>
              <Box
                lineHeight={1.5}
                h={'100%'}
                py={3}
                px={5}
                cursor={'pointer'}
                borderWidth={'1.5px'}
                borderColor={'borderColor.low'}
                bg={'white'}
                borderRadius={'md'}
                userSelect={'none'}
                position={'relative'}
                display={'flex'}
                flexDirection={'column'}
                _hover={{
                  borderColor: 'primary.300',
                  boxShadow: '1.5'
                }}
                onClick={() => {
                  if (userInfo?.team.canWrite) {
                    router.push(`/model/detail?appId=${app._id}`);
                  } else {
                    router.push(`/chat?appId=${app._id}`);
                  }
                }}
                // onClick={() => {
                //   getAppDetail(app._id);
                //   setAppCard(app);
                //   onOpenSlider();
                // }}
              >
                <Flex alignItems={'center'} h={'38px'}>
                  <Avatar src={app.avatar} borderRadius={'md'} w={'28px'} />
                  <Box ml={3}>{app.name}</Box>
                </Flex>
                <Box
                  flex={1}
                  className={'textEllipsis3'}
                  py={2}
                  wordBreak={'break-all'}
                  fontSize={'sm'}
                  color={'myGray.600'}
                >
                  {app.intro || '这个模型还没写介绍~'}
                </Box>
                <Flex h={'34px'} alignItems={'flex-end'}>
                  <Box flex={1}>
                    {/* <PermissionIconText permission={app.permission} color={'myGray.600'} /> */}
                  </Box>
                  <IconButton
                    className="chat"
                    size={'xsSquare'}
                    variant={'whitePrimary'}
                    icon={
                      <MyTooltip label={'去聊天'}>
                        <MyIcon name={'core/chat/chatLight'} w={'14px'} />
                      </MyTooltip>
                    }
                    aria-label={'chat'}
                    // display={['', 'none']}
                    onClick={(e) => {
                      e.stopPropagation();
                      getAppDetail(app._id);
                      setAppCard(app);
                      onOpenSlider();
                    }}
                  />
                </Flex>
              </Box>
            </MyTooltip>
          ))}
      </Grid>
      <Drawer
        isOpen={isOpenSlider}
        placement="right"
        autoFocus={false}
        size={'lg'}
        onClose={onCloseSlider}
      >
        <DrawerOverlay />
        <DrawerContent>
          <DrawerHeader>
            <Flex px={[2, 5]}>
              <Box fontSize={['md', 'xl']} fontWeight={'bold'} flex={1}>
                <Flex alignItems={'center'} h={'38px'}>
                  <Avatar src={appCard?.avatar} borderRadius={'md'} w={'28px'} />
                  <Box ml={3}>{appCard?.name}</Box>
                </Flex>
              </Box>
              <MyTooltip label={t('core.chat.Restart')}>
                <IconButton
                  className="chat"
                  size={'smSquare'}
                  icon={<MyIcon name={'common/clearLight'} w={'14px'} />}
                  variant={'whiteDanger'}
                  borderRadius={'md'}
                  aria-label={'delete'}
                  onClick={(e) => {
                    e.stopPropagation();
                    resetChatBox();
                  }}
                />
              </MyTooltip>
            </Flex>
          </DrawerHeader>
          <DrawerBody>
            <ChatBox
              appId={''}
              ref={ChatBoxRef}
              appAvatar={appCard?.avatar}
              userAvatar={userInfo?.avatar}
              showMarkIcon
              userGuideModule={getGuideModule(modules)}
              showFileSelector={checkChatSupportSelectFileByModules(modules)}
              onStartChat={startChat}
              onDelMessage={() => {}}
            />
          </DrawerBody>
        </DrawerContent>
      </Drawer>
      {myApps.length === 0 && (
        <Flex mt={'35vh'} flexDirection={'column'} alignItems={'center'}>
          <MyIcon name="empty" w={'48px'} h={'48px'} color={'transparent'} />
          <Box mt={2} color={'myGray.500'}>
            还没有示例模型，等会儿再来！
          </Box>
        </Flex>
      )}
    </Flex>
  );
};

export async function getServerSideProps(content: any) {
  return {
    props: {
      ...(await serviceSideProps(content))
    }
  };
}

export default ModelList;
