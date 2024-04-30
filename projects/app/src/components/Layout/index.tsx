import React, { useEffect, useMemo } from 'react';
import { Box, useColorMode, Flex } from '@chakra-ui/react';
import { useRouter } from 'next/router';
import { useLoading } from '@fastgpt/web/hooks/useLoading';
import { useSystemStore } from '@/web/common/system/useSystemStore';
import { throttle } from 'lodash';
import { useQuery } from '@tanstack/react-query';
import { useUserStore } from '@/web/support/user/useUserStore';
import { getUnreadCount } from '@/web/support/user/inform/api';
import dynamic from 'next/dynamic';
import { useToast } from '@fastgpt/web/hooks/useToast';
import { getTokenLogin } from '@/web/support/user/api';
import { getToken } from '@/web/support/user/auth';

import Auth from './auth';
import NavbarPhoneHome from './navbarPhoneHome';
import HomePage from '@/pages/home/index';
const Navbar = dynamic(() => import('./navbar'));
const NavbarPhone = dynamic(() => import('./navbarPhone'));
const UpdateInviteModal = dynamic(() => import('@/components/support/user/team/UpdateInviteModal'));
const NotSufficientModal = dynamic(() => import('@/components/support/wallet/NotSufficientModal'));
const SystemMsgModal = dynamic(() => import('@/components/support/user/inform/SystemMsgModal'));
const ImportantInform = dynamic(() => import('@/components/support/user/inform/ImportantInform'));

const pcUnShowLayoutRoute: Record<string, boolean> = {
  '/': true,
  '/login': true,
  '/login/auth': true,
  '/login/ding': true,
  '/login/provider': true,
  '/login/fastlogin': true,
  '/console': true,
  '/console/provider': true,
  '/console/fastlogin': true,
  '/chat/share': true,
  '/chat/team': true,
  '/app/edit': true,
  '/chat': true,
  '/tools/price': true,
  '/price': true
};
const phoneUnShowLayoutRoute: Record<string, boolean> = {
  '/': true,
  '/login': true,
  '/login/auth': true,
  '/login/ding': true,
  '/login/provider': true,
  '/login/fastlogin': true,
  '/console': true,
  '/console/provider': true,
  '/console/fastlogin': true,
  '/chat/share': true,
  '/chat/team': true,
  '/tools/price': true,
  '/price': true
};

const ordinaryUserLayoutRoute: Record<string, boolean> = {
  '/': true,
  '/login': true,
  '/login/auth': true,
  '/login/ding': true,
  '/console': true,
  '/home': true,
  '/home/chat': true,
  '/home/detail': true,
  '/account': true
};

const Layout = ({ children }: { children: JSX.Element }) => {
  const router = useRouter();
  const { toast } = useToast();
  const { colorMode, setColorMode } = useColorMode();
  const { Loading } = useLoading();
  const { loading, setScreenWidth, isPc, feConfigs, isNotSufficientModal } = useSystemStore();
  const { userInfo, setUserInfo } = useUserStore();

  const isChatPage = useMemo(
    () => router.pathname === '/chat' && Object.values(router.query).join('').length !== 0,
    [router.pathname, router.query]
  );

  const authRouter = async () => {
    const token = getToken();
    if (token != '') {
      const res = await getTokenLogin();
      if (!ordinaryUserLayoutRoute[router.pathname] && res?.manager == 0) {
        setUserInfo(null);
        router.replace('/login');
        toast({
          status: 'error',
          title: '无权访问'
        });
      }
    }
  };
  // 路由拦截
  useEffect(() => {
    authRouter();
  }, [router.pathname]);

  useEffect(() => {
    if (colorMode === 'dark' && router.pathname !== '/chat') {
      setColorMode('light');
    }
  }, [colorMode, router.pathname, setColorMode]);

  // listen screen width
  useEffect(() => {
    const resize = throttle(() => {
      setScreenWidth(document.documentElement.clientWidth);
    }, 300);

    window.addEventListener('resize', resize);

    resize();

    return () => {
      window.removeEventListener('resize', resize);
    };
  }, [setScreenWidth]);

  const { data, refetch: refetchUnRead } = useQuery(['getUnreadCount'], getUnreadCount, {
    enabled: !!userInfo && !!feConfigs.isPlus,
    refetchInterval: 10000
  });
  const unread = data?.unReadCount || 0;
  const importantInforms = data?.importantInforms || [];

  const isHideNavbar = !!pcUnShowLayoutRoute[router.pathname];

  return (
    <>
      <Box h={'100%'} bg={'myGray.100'}>
        {isPc === true && (
          <>
            {isHideNavbar ? (
              <Auth>{children}</Auth>
            ) : (
              <>
                {router.pathname.startsWith('/home') || userInfo?.manager == 0 ? (
                  <Auth>
                    <HomePage>{children}</HomePage>
                  </Auth>
                ) : (
                  <Auth>
                    <>
                      <Box h={'100%'} position={'fixed'} left={0} top={0} w={'64px'}>
                        <Navbar unread={unread} />
                      </Box>
                      <Box h={'100%'} ml={'70px'} overflow={'overlay'}>
                        {children}
                      </Box>
                    </>
                  </Auth>
                )}
              </>
            )}
          </>
        )}
        {isPc === false && (
          <>
            <Box h={'100%'} display={['block', 'none']}>
              {phoneUnShowLayoutRoute[router.pathname] || isChatPage ? (
                <Auth>{children}</Auth>
              ) : (
                <Auth>
                  <>
                    <Flex h={'100%'} flexDirection={'column'}>
                      <Box flex={'1 0 0'} h={0}>
                        {children}
                      </Box>
                      <Box h={'50px'} borderTop={'1px solid rgba(0,0,0,0.1)'}>
                        {router.pathname.startsWith('/home') || userInfo?.manager == 0 ? (
                          <>
                            <NavbarPhoneHome unread={0} />
                          </>
                        ) : (
                          <>
                            <NavbarPhone unread={unread} />
                          </>
                        )}
                      </Box>
                    </Flex>
                  </>
                </Auth>
              )}
            </Box>
          </>
        )}

        {!!userInfo && <UpdateInviteModal />}
        {isNotSufficientModal && !isHideNavbar && <NotSufficientModal />}
        {!!userInfo && <SystemMsgModal />}
        {!!userInfo && importantInforms.length > 0 && (
          <ImportantInform informs={importantInforms} refetch={refetchUnRead} />
        )}
      </Box>
      <Loading loading={loading} zIndex={999999} />
    </>
  );
};

export default Layout;
